# Integration status

| Capability | Current state | Required before live use |
| --- | --- | --- |
| Payment transaction and settlement feed | Normalized merchant CSV import and read APIs; live provider sync unavailable | Authorized provider contract, credential vault, verified webhook/sync adapter |
| OTP login and session lifecycle | Local-only development bootstrap | Approved identity/OTP vendor, abuse controls, recovery and device/session policy |
| LLM | Optional Gemini adapter for general guidance; local sales, stock and settlement questions remain deterministic | Provider data-processing review, prompt/tool evaluation, production key management and usage limits |
| Speech recognition and synthesis | Not implemented | Provider support validation per language, retention policy, consent and device testing |
| Lending offers and applications | Not implemented | Authorized lender adapters, disclosures, consent and compliance review |
| GST filing | Summaries not implemented as statutory filing | Verified tax rules and authorized filing integration; accountant review |
| Campaign delivery | Draft/approval record boundary only | Consent-aware customer source and authorized delivery provider |
| Push notifications | Not implemented | FCM/Expo credentials, delivery privacy and preference flows |

The local-session endpoint is excluded when `APP_ENV=production`; it is not merchant authentication for a live launch. Development has no fabricated payment data. A successfully approved proposal does not execute any provider-side operation.

## Gemini development setup

For local experiments with non-sensitive prompts only, create a key in Google AI Studio and set `MODEL_PROVIDER=gemini`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL` in the backend environment. Keep the key on the server; never place it in the Android app or commit it. The default model is `gemini-3.5-flash-lite`. The assistant sends only the current general question to Gemini; deterministic sales, inventory, and settlement answers use local records and do not call Gemini. Google's free-tier terms say submitted content may be used to improve its products, so do not send personal, customer, payment, or other confidential merchant information through this setup. Production use requires a data-processing review and managed secret storage.
