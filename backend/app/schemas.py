from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class MerchantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    tier: str = Field(default="qr", pattern="^(qr|soundbox|pos|omnichannel)$")


class MerchantOut(BaseModel):
    id: str
    name: str
    tier: str
    currency: str
    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    sku: str | None = Field(default=None, max_length=80)
    quantity: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=0, ge=0)
    unit: str = Field(default="unit", max_length=24)


class ProductOut(ProductCreate):
    id: str
    model_config = ConfigDict(from_attributes=True)


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None


class AssistantResponse(BaseModel):
    answer: str
    sources: list[str]
    grounded: bool = True


class ActionCreate(BaseModel):
    kind: str = Field(pattern="^(purchase_order|campaign|credit_application|report_share)$")
    payload: dict


class ActionOut(BaseModel):
    id: str
    kind: str
    status: str
    expires_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SalesSummary(BaseModel):
    currency: str
    collection_total: Decimal
    successful_transactions: int
    refunds_total: Decimal
    pending_settlements: Decimal
    source: str
    as_of: datetime
    data_available: bool
