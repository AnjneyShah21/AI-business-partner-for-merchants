# Paytm AI Business Partner

Android merchant operations app and FastAPI service. The project now contains functional, tenant-scoped merchant workflows and an integration boundary for unavailable authorized services. It is **not approved or connected to Paytm private merchant APIs**, and is not a production financial product until the release gates are complete.

## Workspace

- `mobile/`: Expo Router Android app, SecureStore sessions, React Query API client and merchant modules.
- `backend/`: FastAPI modular monolith, SQLAlchemy models, Alembic migrations and tests.
- `contracts/openapi.yaml`: generated API contract.
- `docs/`: setup, integration, security and implementation status.
- `docker-compose.yml`: local PostgreSQL, Redis and API.

## Run locally

1. Copy `.env.example` to `.env`, replace the signing key with at least 32 random characters.
2. Run `docker compose up --build` from the repository root. The API migrates its local database on start.
3. Copy `mobile/.env.example` to `mobile/.env`, run `npm ci --legacy-peer-deps` in `mobile/`, then `npx expo start --dev-client`.
4. Local workspace setup is for development only. Do not enable it in a deployed environment.

After changing backend routes/schemas, regenerate the mobile contract types with `npm run generate:api` from `mobile/`.

The API base is `http://localhost:8000/api/v1` (Android emulator: `http://10.0.2.2:8000/api/v1`). Docs are available at `/api/v1/docs` and health at `/api/v1/health`.

## Implemented workflows

Sales summaries/comparisons, peak-hour and threshold analysis; settlement/cash-flow views; tenant-scoped inventory and stock movement ledger; supplier and purchase order drafts with approval proposals; customer records and consent updates; campaign drafts; provider-originated credit offer display; draft tax summaries; reports availability; staff and store records; persistent deterministic assistant conversations; in-app notification records; and an approval center that never claims execution without a provider confirmation.

## Production gates

OTP authentication, live payment/settlement ingestion, LLM and voice providers, lender offers/applications, statutory GST filing, campaign delivery, push notifications, durable workers, production observability/backups, compliance review and Android signing credentials still require authorized setup. Capabilities are reported by `/integrations/status`; absent services remain disabled. See [implementation status](docs/STATUS.md), [integration requirements](docs/INTEGRATIONS.md), [security controls](docs/SECURITY.md), and [deployment steps](docs/DEPLOYMENT.md).
