from dataclasses import dataclass
import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.core.config import get_settings


@dataclass(frozen=True)
class ProviderCapability:
    key: str
    purpose: str
    status: str
    prerequisite: str


CAPABILITIES = (
    ProviderCapability("payments", "transaction and settlement sync", "not_configured", "Authorized merchant provider contract and credentials"),
    ProviderCapability("otp", "merchant authentication", "not_configured", "Authorized OTP vendor, abuse controls and recovery flow"),
    ProviderCapability("llm", "AI language generation", "disabled", "Approved LLM provider and data-processing review"),
    ProviderCapability("speech_to_text", "voice transcription", "not_configured", "Verified speech provider and language-level validation"),
    ProviderCapability("text_to_speech", "spoken responses", "not_configured", "Verified speech synthesis provider and language-level validation"),
    ProviderCapability("lending", "credit offers and applications", "not_configured", "Authorized lender partner integration and disclosures"),
    ProviderCapability("tax_filing", "statutory tax filing", "not_configured", "Authorized GST filing provider and professional review"),
    ProviderCapability("campaign_delivery", "customer messaging", "not_configured", "Consent-aware delivery vendor integration"),
    ProviderCapability("push", "Android push notifications", "not_configured", "FCM/Expo credentials and delivery policy"),
)


def ask_gemini(question: str) -> str:
    """Answer a general question without sending merchant records or conversation history."""
    settings = get_settings()
    if settings.model_provider.casefold() != "gemini" or not settings.gemini_api_key:
        raise RuntimeError("Gemini is not configured")

    model = quote(settings.gemini_model, safe="-")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "systemInstruction": {
            "parts": [{"text": (
                "You are a helpful assistant for small businesses. You do not have access to this "
                "merchant's account, sales, inventory, settlements, customers, or files. Do not "
                "claim to have checked their data or invent account-specific figures. Give general "
                "guidance only, and say when a question requires connected business data. Keep "
                "the response concise and practical."
            )}]
        },
        "contents": [{"parts": [{"text": question}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 500},
    }
    request = Request(
        f"{url}?key={quote(settings.gemini_api_key, safe='')}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
            result = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        # Never include the request URL or provider body: the URL contains the API key.
        raise RuntimeError("Gemini request failed; check the local key, quota, and network") from exc

    try:
        answer = "".join(
            part.get("text", "")
            for part in result["candidates"][0]["content"]["parts"]
            if isinstance(part, dict)
        ).strip()
    except (KeyError, IndexError, TypeError):
        answer = ""
    if not answer:
        raise RuntimeError("Gemini returned no text response")
    return answer
