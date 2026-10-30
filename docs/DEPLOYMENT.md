# Local deployment and release gates

## Local backend

1. Copy the root `.env.example` to `.env`; replace `SESSION_SIGNING_KEY` with at least 32 random characters.
2. Run `docker compose up --build` from the repository root. The API applies Alembic migrations before starting.
3. The API is available at `http://localhost:8000/api/v1`; interactive API docs are at `/api/v1/docs`.
4. For Android Emulator, copy `mobile/.env.example` to `mobile/.env` and keep the emulator API address `10.0.2.2`. The local workspace bootstrap flag is strictly for local development; production rejects these endpoints.

## Android build

- Install dependencies from `mobile/`, then use a development build with `npx expo run:android` or an internal APK profile with `eas build --platform android --profile preview`.
- Configure a production API URL and EAS environment variables before production builds. Set `EXPO_PUBLIC_LOCAL_BOOTSTRAP=false`.
- Set the organization-owned Android application ID, icons, privacy links and Play listing before store submission. Do not commit signing credentials.

## Production API

- Use managed PostgreSQL and Redis, TLS ingress, managed secrets, restricted CORS, connection limits, backups and centralized logs.
- Run migration as a controlled deployment job before API rollout; configure rollback and restore testing.
- Current compose passwords are local-only examples. Never use them for an internet-accessible environment.
- SLO figures in `SECURITY.md` are proposed targets and have not been measured.
- Payment, OTP, LLM, voice, lender, GST, campaign and push integrations are not configured; production data/action flows must remain disabled until partner authorization and validation are completed.
