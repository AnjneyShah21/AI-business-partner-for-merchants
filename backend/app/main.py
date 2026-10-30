import json
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import current_actor, issue_session
from app.analytics import summarize_transactions
from app.core.config import get_settings
from app.core.db import Base, engine, get_db
from app.core.time import utc_aware
from app.models import ActionProposal, AuditEvent, Campaign, Conversation, Merchant, Membership, Message, Product, PurchaseOrder, Settlement, Transaction
from app.routes import router as business_router
from app.schemas import (ActionCreate, ActionOut, AssistantRequest, AssistantResponse, MerchantCreate,
                         MerchantOut, ProductCreate, ProductOut, SalesSummary)

cfg = get_settings()


@asynccontextmanager
async def lifespan(_app):
    if cfg.app_env == "production" and len(cfg.session_signing_key) < 32:
        raise RuntimeError("Production requires SESSION_SIGNING_KEY (32+ characters)")
    if cfg.app_env == "development":
        Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Merchant Business Partner API", version="0.1.0", openapi_url=None,
              docs_url=None, redoc_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=cfg.origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type", "Idempotency-Key"])
api = FastAPI(openapi_url="/openapi.json", docs_url="/docs", redoc_url=None)
app.mount("/api/v1", api)
api.include_router(business_router)


@api.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok", "environment": cfg.app_env}


@api.post("/merchants", response_model=MerchantOut, status_code=201)
def create_merchant(body: MerchantCreate, db: Session = Depends(get_db)):
    # Bootstrap provisioning is disabled in production. Production identity/OTP must be connected first.
    if cfg.app_env == "production":
        raise HTTPException(503, "Merchant provisioning requires the configured identity provider")
    merchant = Merchant(name=body.name, tier=body.tier)
    db.add(merchant)
    db.flush()
    subject = "local-owner"
    db.add(Membership(merchant_id=merchant.id, subject=subject, role="owner"))
    db.commit()
    db.refresh(merchant)
    return merchant


@api.post("/auth/local-session")
def local_session(merchant_id: str, db: Session = Depends(get_db)):
    if cfg.app_env == "production":
        raise HTTPException(404, "Not found")
    membership = db.scalar(select(Membership).where(Membership.merchant_id == merchant_id,
                                                   Membership.subject == "local-owner"))
    if not membership:
        raise HTTPException(404, "Merchant not found")
    try:
        token = issue_session("local-owner", merchant_id, membership.role)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    return {"access_token": token, "token_type": "bearer", "expires_in": cfg.session_ttl_minutes * 60,
            "environment": "local-development"}


@api.get("/me")
def me(actor=Depends(current_actor)):
    return actor


@api.get("/dashboard/sales", response_model=SalesSummary)
def sales_summary(days: int = Query(default=1, ge=1, le=365), actor=Depends(current_actor), db: Session = Depends(get_db)):
    start = datetime.now(timezone.utc) - timedelta(days=days)
    mid = actor["merchant_id"]
    txs = db.scalars(select(Transaction).where(Transaction.merchant_id == mid, Transaction.occurred_at >= start)).all()
    total, successful_count, refunds = summarize_transactions((t.amount, t.status) for t in txs)
    pending = db.scalar(select(func.coalesce(func.sum(Settlement.amount), 0)).where(
        Settlement.merchant_id == mid, Settlement.status == "pending")) or Decimal("0.00")
    return SalesSummary(currency="INR", collection_total=total, successful_transactions=successful_count,
                        refunds_total=refunds, pending_settlements=pending, source="merchant-import and provider records",
                        as_of=datetime.now(timezone.utc), data_available=bool(txs))


@api.get("/transactions")
def transactions(limit: int = Query(default=50, ge=1, le=200), actor=Depends(current_actor), db: Session = Depends(get_db)):
    rows = db.scalars(select(Transaction).where(Transaction.merchant_id == actor["merchant_id"])
                      .order_by(Transaction.occurred_at.desc()).limit(limit)).all()
    return [{"id": r.id, "external_id": r.external_id, "amount": str(r.amount), "status": r.status,
             "payment_method": r.payment_method, "occurred_at": r.occurred_at, "source": r.source} for r in rows]


@api.get("/cashflow/settlements")
def settlements(actor=Depends(current_actor), db: Session = Depends(get_db)):
    rows = db.scalars(select(Settlement).where(Settlement.merchant_id == actor["merchant_id"])
                      .order_by(Settlement.expected_at.desc()).limit(100)).all()
    return [{"id": r.id, "amount": str(r.amount), "status": r.status, "expected_at": r.expected_at,
             "settled_at": r.settled_at} for r in rows]


@api.get("/inventory", response_model=list[ProductOut])
def inventory(actor=Depends(current_actor), db: Session = Depends(get_db)):
    return db.scalars(select(Product).where(Product.merchant_id == actor["merchant_id"], Product.active.is_(True))).all()


@api.post("/inventory", response_model=ProductOut, status_code=201)
def add_product(body: ProductCreate, actor=Depends(current_actor), db: Session = Depends(get_db)):
    if actor["role"] not in {"owner", "admin", "manager"}:
        raise HTTPException(403, "Manager permission required")
    product = Product(**body.model_dump(), merchant_id=actor["merchant_id"])
    db.add(product); db.commit(); db.refresh(product)
    return product


@api.get("/inventory/alerts")
def inventory_alerts(actor=Depends(current_actor), db: Session = Depends(get_db)):
    rows = db.scalars(select(Product).where(Product.merchant_id == actor["merchant_id"], Product.active.is_(True),
                                            Product.quantity <= Product.reorder_level)).all()
    return [{"product_id": p.id, "name": p.name, "quantity": p.quantity, "reorder_level": p.reorder_level}
            for p in rows]


@api.post("/approvals", response_model=ActionOut, status_code=201)
def create_proposal(body: ActionCreate, actor=Depends(current_actor), db: Session = Depends(get_db)):
    if actor["role"] not in {"owner", "admin", "manager"}:
        raise HTTPException(403, "Manager permission required")
    action = ActionProposal(merchant_id=actor["merchant_id"], kind=body.kind,
                            payload=json.dumps(body.payload, separators=(",", ":")),
                            expires_at=datetime.now(timezone.utc) + timedelta(hours=24))
    db.add(action); db.commit(); db.refresh(action)
    db.add(AuditEvent(merchant_id=actor["merchant_id"], subject=actor["subject"], action="proposal.created", resource_id=action.id))
    db.commit()
    return action


@api.get("/approvals", response_model=list[ActionOut])
def list_proposals(actor=Depends(current_actor), db: Session = Depends(get_db)):
    return db.scalars(select(ActionProposal).where(ActionProposal.merchant_id == actor["merchant_id"])
                      .order_by(ActionProposal.created_at.desc())).all()


@api.post("/approvals/{proposal_id}/decision")
def decide_proposal(proposal_id: str, decision: str = Query(pattern="^(approve|reject)$"),
                    actor=Depends(current_actor), db: Session = Depends(get_db)):
    if actor["role"] not in {"owner", "admin", "manager"}:
        raise HTTPException(403, "Manager permission required")
    proposal = db.scalar(select(ActionProposal).where(ActionProposal.id == proposal_id,
                                                       ActionProposal.merchant_id == actor["merchant_id"]))
    if not proposal: raise HTTPException(404, "Proposal not found")
    if proposal.status != "pending": raise HTTPException(409, "Proposal already decided")
    if utc_aware(proposal.expires_at) <= datetime.now(timezone.utc):
        proposal.status = "expired"; db.commit(); raise HTTPException(410, "Proposal expired")
    # Approval records authorization only. Execution stays unavailable until a verified provider is installed.
    if decision == "approve":
        payload = json.loads(proposal.payload)
        if proposal.kind == "purchase_order" and payload.get("purchase_order_id"):
            order = db.scalar(select(PurchaseOrder).where(PurchaseOrder.id == payload["purchase_order_id"],
                                                           PurchaseOrder.merchant_id == actor["merchant_id"]))
            if order is None: raise HTTPException(409, "Purchase order no longer exists")
            order.status = "approved_pending_provider"
        if proposal.kind == "campaign" and payload.get("campaign_id"):
            campaign = db.scalar(select(Campaign).where(Campaign.id == payload["campaign_id"],
                                                         Campaign.merchant_id == actor["merchant_id"]))
            if campaign is None: raise HTTPException(409, "Campaign no longer exists")
            campaign.status = "approved_pending_provider"
        proposal.status = "approved_pending_provider"
    else:
        proposal.status = "rejected"
    db.add(AuditEvent(merchant_id=actor["merchant_id"], subject=actor["subject"], action=f"proposal.{decision}", resource_id=proposal.id))
    db.commit()
    return {"id": proposal.id, "status": proposal.status, "executed": False,
            "message": "No external action was executed; a verified provider adapter is required."}


@api.post("/assistant/query", response_model=AssistantResponse)
def assistant_query(body: AssistantRequest, actor=Depends(current_actor), db: Session = Depends(get_db)):
    # A no-model deterministic assistant is safer than inventing values. AI provider remains opt-in.
    q = body.question.casefold()
    conversation = None
    if body.conversation_id:
        conversation = db.scalar(select(Conversation).where(Conversation.id == body.conversation_id,
                                                     Conversation.merchant_id == actor["merchant_id"]))
        if not conversation:
            raise HTTPException(404, "Conversation not found")
        db.add(Message(conversation_id=conversation.id, role="user", content=body.question))

    def respond(answer: str, sources: list[str]):
        result = AssistantResponse(answer=answer, sources=sources)
        if conversation:
            db.add(Message(conversation_id=conversation.id, role="assistant", content=answer, sources=sources))
            db.commit()
        return result

    if any(term in q for term in ("sale", "collect", "today", "revenue")):
        summary = sales_summary(1, actor, db)
        answer = (f"Connected records show collections of ₹{summary.collection_total} across "
                  f"{summary.successful_transactions} successful transactions in the last day. "
                  f"Refunds are ₹{summary.refunds_total}. This is collections, not profit.")
        return respond(answer, ["/dashboard/sales?days=1"])
    if any(term in q for term in ("stock", "inventory", "reorder")):
        low = inventory_alerts(actor, db)
        if not low: return respond("No low-stock items are recorded in connected inventory.", ["/inventory/alerts"])
        names = ", ".join(f"{p['name']} ({p['quantity']} {p['unit'] if 'unit' in p else 'units'})" for p in low)
        return respond(f"These recorded items are at or below their reorder level: {names}.", ["/inventory/alerts"])
    if any(term in q for term in ("settlement", "cash flow", "cashflow", "pending payout")):
        items = settlements(actor, db)
        pending = [item for item in items if item["status"] == "pending"]
        total = sum((Decimal(item["amount"]) for item in pending), Decimal("0.00"))
        return respond(f"Connected provider records show ₹{total} pending across {len(pending)} settlements. This is a recorded status, not a guaranteed receipt date.",
                       ["/cashflow/settlements"])
    settings = get_settings()
    if settings.model_provider.casefold() == "gemini" and settings.gemini_api_key:
        from app.providers import ask_gemini
        try:
            answer = ask_gemini(body.question)
        except RuntimeError as exc:
            raise HTTPException(503, "AI is temporarily unavailable. Check the backend provider configuration and quota.") from exc
        return respond(answer, ["Gemini general guidance; merchant records were not sent"])
    return respond("I can answer from connected sales, settlement, and inventory records. This question needs a configured data source or AI provider before I can answer reliably.", [])
