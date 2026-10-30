# Integration status

| Capability | Current state | Required before live use |
| --- | --- | --- |
| Payment transaction and settlement feed | Normalized merchant CSV import and read APIs; live provider sync unavailable | Authorized provider contract, credential vault, verified webhook/sync adapter |
| OTP login and session lifecycle | Local-only development bootstrap | Approved identity/OTP vendor, abuse controls, recovery and device/session policy |
| LLM | Optional Gemini adapter for general guidance; local sales, stock and settlement questions remain deterministic | Provider data-processing review, prompt/tool evaluation, production key management and usage limits |
| Speech recognition and synthesis | English (`en-IN`) and Hindi (`hi-IN`) recognition uses Android; the authenticated backend uses the ElevenLabs Python SDK for MP3 replies, with Android voice fallback | Account quota/voice access, response-text disclosure, production usage limits, retention review and device testing |
| Lending offers and applications | Not implemented | Authorized lender adapters, disclosures, consent and compliance review |
| GST filing | Summaries not implemented as statutory filing | Verified tax rules and authorized filing integration; accountant review |
| Campaign delivery | Draft/approval record boundary only | Consent-aware customer source and authorized delivery provider |
| Push notifications | Not implemented | FCM/Expo credentials, delivery privacy and preference flows |

The local-session endpoint is excluded when `APP_ENV=production`; it is not merchant authentication for a live launch. Development has no fabricated payment data. A successfully approved proposal does not execute any provider-side operation.

## Gemini development setup

For local experiments with non-sensitive prompts only, create a key in Google AI Studio and set `MODEL_PROVIDER=gemini`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL` in the repository-root `.env`. Docker Compose now forwards these server-only settings to the API. Keep the key on the server; never place it in the Android app or commit it. The default model is `gemini-3.5-flash-lite`. The assistant sends only the current general question to Gemini; deterministic sales, inventory, and settlement answers use local records and do not call Gemini. Google's free-tier terms say submitted content may be used to improve its products, so do not send personal, customer, payment, or other confidential merchant information through this setup. Production use requires a data-processing review and managed secret storage.

The mobile sample workspace is intentionally offline and does not call Gemini. To use the backend assistant, run the API, use a local development workspace, and configure the app with `EXPO_PUBLIC_DEMO_MODE=false` and an emulator API URL such as `http://10.0.2.2:8000/api/v1`. Speech recognition uses Android; speech output uses ElevenLabs when configured and otherwise falls back to device text-to-speech. An emulator started with `-no-audio` cannot play replies; enable emulator audio and raise its media volume.

## ElevenLabs reply voices

Run `npx -y @elevenlabs/cli@latest onboard init` from the repository root and follow its browser sign-in. It stores `ELEVENLABS_API_KEY` in the ignored root `.env.local`. Start Compose with `docker compose --env-file .env --env-file .env.local up --build`; Compose passes the key only to the API container. Optionally set `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL` in `.env` to choose the account's default voice or model. Do not put the key in Expo variables, the Android app, screenshots, or source control. Restart the API after changing it. The signed-in app loads voices from the configured account and can select one; speech is returned as MP3 through an authenticated API endpoint. The ElevenLabs key is never sent to the app.

Spoken assistant replies are sent to ElevenLabs to synthesize audio. This can include amounts or other information contained in a reply. Speech recognition still uses Android's speech service. In offline demo mode, or when the backend speech service is unavailable, replies use the installed Android text-to-speech voice instead. ElevenLabs usage is subject to the account's plan and quota. The daily briefing is generated when the dashboard opens; background/push delivery is not configured.
