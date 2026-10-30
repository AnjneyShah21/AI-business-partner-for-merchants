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
                "guidance only, and say when a question requires connected business data. Reply "
                "in the language and script used by the merchant, including Hindi or Hinglish. Keep "
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


def get_elevenlabs_voices() -> tuple[list[dict[str, str]], str | None]:
    """Return the account's available ElevenLabs voices without exposing account metadata."""
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise RuntimeError("ElevenLabs is not configured")

    request = Request(
        "https://api.elevenlabs.io/v2/voices?page_size=100",
        headers={"xi-api-key": settings.elevenlabs_api_key},
    )
    try:
        with urlopen(request, timeout=20) as response:
            result = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        raise RuntimeError("ElevenLabs could not list the configured account's voices") from exc

    voices = []
    for voice in result.get("voices", []):
        if not isinstance(voice, dict) or not voice.get("voice_id") or not voice.get("name"):
            continue
        labels = voice.get("labels") if isinstance(voice.get("labels"), dict) else {}
        voices.append({
            "voice_id": str(voice["voice_id"]),
            "name": str(voice["name"]),
            "category": str(voice.get("category") or "voice"),
            "accent": str(labels.get("accent") or ""),
            "gender": str(labels.get("gender") or ""),
        })
    if not voices:
        raise RuntimeError("The configured ElevenLabs account has no available voices")

    voice_ids = {voice["voice_id"] for voice in voices}
    default_voice_id = settings.elevenlabs_voice_id if settings.elevenlabs_voice_id in voice_ids else voices[0]["voice_id"]
    return voices, default_voice_id


def generate_elevenlabs_speech(text: str, voice_id: str | None = None) -> bytes:
    """Generate MP3 speech. The key stays on the backend and is never sent to the app."""
    settings = get_settings()
    voices, default_voice_id = get_elevenlabs_voices()
    allowed_voice_ids = {voice["voice_id"] for voice in voices}
    selected_voice_id = voice_id or default_voice_id
    if selected_voice_id not in allowed_voice_ids:
        raise RuntimeError("Select a voice available to the configured ElevenLabs account")

    payload = {"text": text, "model_id": settings.elevenlabs_model}
    request = Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{quote(selected_voice_id, safe='')}?output_format=mp3_44100_128",
        data=json.dumps(payload).encode("utf-8"),
        headers={"xi-api-key": settings.elevenlabs_api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=40) as response:
            audio = response.read(10_000_001)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise RuntimeError("ElevenLabs could not generate speech; check account access and usage quota") from exc
    if not audio or len(audio) > 10_000_000:
        raise RuntimeError("ElevenLabs returned invalid or oversized audio")
    return audio
