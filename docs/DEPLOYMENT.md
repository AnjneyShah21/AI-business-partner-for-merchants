# Local deployment and release gates

## Local backend

1. Copy the root `.env.example` to `.env`; replace `SESSION_SIGNING_KEY` with at least 32 random characters.
2. Sign in through `npx -y @elevenlabs/cli@latest onboard init`; the CLI writes the secret to ignored `.env.local`.
3. Run `docker compose --env-file .env --env-file .env.local up --build` from the repository root. The API applies Alembic migrations before starting.
4. The API is available at `http://localhost:8000/api/v1`; interactive API docs are at `/api/v1/docs`.
5. For Android Emulator, copy `mobile/.env.example` to `mobile/.env` and keep the emulator API address `10.0.2.2`. The local workspace bootstrap flag is strictly for local development; production rejects these endpoints.

## Android build

- Install dependencies from `mobile/`, then use a development build with `npx expo run:android` or an internal APK profile with `eas build --platform android --profile preview`.
- Configure a production API URL and EAS environment variables before production builds. Set `EXPO_PUBLIC_LOCAL_BOOTSTRAP=false`.
- Set the organization-owned Android application ID, icons, privacy links and Play listing before store submission. Do not commit signing credentials.

## Production API

- Use managed PostgreSQL and Redis, TLS ingress, managed secrets, restricted CORS, connection limits, backups and centralized logs.
- Run migration as a controlled deployment job before API rollout; configure rollback and restore testing.
- Current compose passwords are local-only examples. Never use them for an internet-accessible environment.
- SLO figures in `SECURITY.md` are proposed targets and have not been measured.
- Payment, OTP, merchant-data LLM, production voice policy, lender, GST, campaign and push integrations are not approved for production; production data/action flows must remain disabled until partner authorization and validation are completed.

## Hosted demo backend (Render + Neon)

The root `render.yaml` defines a Singapore Render web service for the `app` branch. It runs Alembic migrations before starting FastAPI and expects `DATABASE_URL`, `GOOGLE_OAUTH_CLIENT_ID`, and the optional ElevenLabs credentials as dashboard secrets. The database URL accepts PostgreSQL provider URLs and uses the installed psycopg v3 driver.

Create a Neon PostgreSQL project in Singapore, copy its pooled connection URL, then create a Render Blueprint from this GitHub repository and select the `render.yaml` blueprint. Enter the connection URL and the existing Google Web OAuth client ID in Render's secret prompts; do not put either value in Git or chat. Render generates the session signing key. The API health URL is `/api/v1/health`.

This is a free demo deployment, not production hosting: Render's free web service sleeps when idle and has a cold start; the free Neon database has usage limits and no managed daily backups. Do not store live payment credentials or rely on this setup for financial records without backups and a paid production plan. The Android app also needs the deployed API URL in `EXPO_PUBLIC_API_URL` and a new APK after the Render URL is known. Local Ollama is not available to a hosted API; merchant data questions and confirmed record writes continue through the backend's structured handlers, while open-ended LLM responses require a separately approved hosted model.
