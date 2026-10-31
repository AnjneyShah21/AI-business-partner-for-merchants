# Integration status

| Capability | Current state | Required before live use |
| --- | --- | --- |
| Payment transaction and settlement feed | Normalized merchant CSV import and read APIs; live provider sync unavailable | Authorized provider contract, credential vault, verified webhook/sync adapter |
| Google login and session lifecycle | Native Google sign-in with backend ID-token verification and short-lived app sessions | Google Cloud OAuth client IDs, Android package/SHA-1 registration, deployment key rotation and account recovery policy |
| LLM | Optional Gemini adapter for general guidance; local sales, stock and settlement questions remain deterministic | Provider data-processing review, prompt/tool evaluation, production key management and usage limits |
| Speech recognition and synthesis | English (`en-IN`) and Hindi (`hi-IN`) recognition uses Android; the authenticated backend uses the ElevenLabs Python SDK for MP3 replies, with Android voice fallback | Account quota/voice access, response-text disclosure, production usage limits, retention review and device testing |
| Lending offers and applications | Not implemented | Authorized lender adapters, disclosures, consent and compliance review |
| GST filing | Summaries not implemented as statutory filing | Verified tax rules and authorized filing integration; accountant review |
| Campaign delivery | Draft/approval record boundary only | Consent-aware customer source and authorized delivery provider |
| Push notifications | Not implemented | FCM/Expo credentials, delivery privacy and preference flows |

Google sign-in creates a merchant workspace for a verified Google identity the first time it is used. It does not connect a Paytm merchant account. The local-session endpoint is excluded when `APP_ENV=production`; it is only for local development. A successfully approved proposal does not execute any provider-side operation.

## Google sign-in setup

Create OAuth clients in the [Google Cloud Credentials page](https://console.cloud.google.com/apis/credentials). Configure an Android OAuth client for package `in.merchant.businesspartner` and the SHA-1 fingerprint of the debug signing key used on the emulator. Also create a **Web application** OAuth client: the native Google sign-in SDK uses this Web client ID to request the identity token that the backend verifies. Keep both IDs out of source control; the IDs are public configuration values, not private API secrets.

Set the Web client ID as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `mobile/.env` and as `GOOGLE_OAUTH_CLIENT_ID` in the backend environment. Rebuild and reinstall the Android development app after adding the native Google sign-in package. Set the same Web client ID on the backend and app so the backend can check the token audience. The app's Android package name is `in.merchant.businesspartner`. For iOS later, replace the placeholder `iosUrlScheme` in `mobile/app.json` with the reversed iOS client ID from Google Cloud.

The emulator debug fingerprint can be read with `keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android`. A release build has a different fingerprint and needs its own Android OAuth client registration. Without OAuth configuration, the Google button explains what's missing; the offline sample workspace remains available for demonstrations.

## Gemini development setup

For local experiments with non-sensitive prompts only, create a key in Google AI Studio and set `MODEL_PROVIDER=gemini`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL` in the repository-root `.env`. Docker Compose now forwards these server-only settings to the API. Keep the key on the server; never place it in the Android app or commit it. The default model is `gemini-3.5-flash-lite`. The assistant sends only the current general question to Gemini; deterministic sales, inventory, and settlement answers use local records and do not call Gemini. Google's free-tier terms say submitted content may be used to improve its products, so do not send personal, customer, payment, or other confidential merchant information through this setup. Production use requires a data-processing review and managed secret storage.

The mobile sample workspace is intentionally offline and does not call Gemini. It loads fictional transactions from `mobile/assets/demo/merchant_transactions_sample.csv`; relative dates are shifted to the current India date when loaded. In the welcome screen, choose **Open presentation sample**. The CSV contains fictional sender labels and references; every screen labels those records as sample data, and no merchant or Paytm connection is made.

To use the backend assistant, run the API, use a local development workspace, and configure the app with `EXPO_PUBLIC_DEMO_MODE=false` and an emulator API URL such as `http://10.0.2.2:8000/api/v1`. Speech recognition uses Android; speech output uses ElevenLabs when configured and otherwise falls back to device text-to-speech. An emulator started with `-no-audio` cannot play replies; enable emulator audio and raise its media volume.

## Paytm API connection

The app keeps a Paytm connection status and CSV import entry in Profile. Live Paytm API sync is not implemented because authorized API access is currently unavailable. Do not paste merchant credentials into the app or Expo environment variables. When Paytm grants the merchant API contract and credentials, implement the documented provider adapter in the backend and provision its secrets through the server's ignored `.env.local` for development or a managed secret store for deployment. The app should receive only authenticated, normalized transaction data from that backend. The authorized CSV importer accepts optional `sender_name`, `sender_reference`, and `sender_contact` fields, which appear on the payment detail screen when supplied. Until then, use the clearly labeled presentation CSV or import a merchant-authorized CSV through the import screen.

## ElevenLabs reply voices

Run `npx -y @elevenlabs/cli@latest onboard init` from the repository root and follow its browser sign-in. It stores `ELEVENLABS_API_KEY` in the ignored root `.env.local`. Start Compose with `docker compose --env-file .env --env-file .env.local up --build`; Compose passes the key only to the API container. Optionally set `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL` in `.env` to choose the account's default voice or model. Do not put the key in Expo variables, the Android app, screenshots, or source control. Restart the API after changing it. The signed-in app loads voices from the configured account and can select one; speech is returned as MP3 through an authenticated API endpoint. The ElevenLabs key is never sent to the app.

Spoken assistant replies are sent to ElevenLabs to synthesize audio. This can include amounts or other information contained in a reply. Speech recognition still uses Android's speech service. In offline demo mode, or when the backend speech service is unavailable, replies use the installed Android text-to-speech voice instead. ElevenLabs usage is subject to the account's plan and quota. The daily briefing is generated when the dashboard opens; background/push delivery is not configured.
