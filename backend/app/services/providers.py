"""Provider adapters for PayPal, Gmail, Telegram, and Google Calendar.

Every adapter is honest about what it did:

* ``simulated`` mode performs no network write and returns a clearly prefixed
  provider id together with ``simulated=True``.
* ``real`` mode uses the official HTTP APIs. If credentials or consent are
  missing it raises `ProviderError`; it never falls back to a fake success.

Approval is enforced by the action service, not by these adapters.
"""

from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass
from email.message import EmailMessage

import anyio
import httpx

from ..core.config import settings
from ..core.logging import log


class ProviderError(RuntimeError):
    """A provider rejected or could not perform the requested write."""


@dataclass(slots=True)
class ProviderResult:
    ok: bool
    provider_id: str | None
    simulated: bool
    detail: str
    status: str = "completed"


def _simulated_id(provider: str) -> str:
    return f"sim-{provider.lower()}-{uuid.uuid4().hex[:12]}"


class ProviderAdapter:
    provider = "provider"

    @property
    def configured(self) -> bool:
        return False

    async def send_email(self, *, to: str, subject: str, body: str) -> ProviderResult:
        raise ProviderError(f"{self.provider} cannot send email.")

    async def create_payment_request(
        self,
        *,
        email: str,
        amount_cents: int,
        currency: str,
        description: str,
    ) -> ProviderResult:
        raise ProviderError(f"{self.provider} cannot create payment requests.")

    async def create_calendar_event(
        self, *, title: str, starts_at: str, ends_at: str, description: str
    ) -> ProviderResult:
        raise ProviderError(f"{self.provider} cannot write calendar events.")

    async def send_message(self, *, chat_id: str, text: str) -> ProviderResult:
        raise ProviderError(f"{self.provider} cannot send messages.")

    async def fetch_invoice_status(self, provider_id: str) -> str | None:
        return None


class GmailAdapter(ProviderAdapter):
    provider = "Gmail"

    @property
    def configured(self) -> bool:
        return settings.gmail_configured

    async def send_email(self, *, to: str, subject: str, body: str) -> ProviderResult:
        if settings.provider_mode == "simulated":
            return ProviderResult(
                ok=True,
                provider_id=_simulated_id("gmail"),
                simulated=True,
                detail="Simulated delivery. No email left the workspace.",
            )
        if not self.configured:
            raise ProviderError(
                "Gmail OAuth is not configured. Connect Gmail with a refresh token before sending."
            )
        return await anyio.to_thread.run_sync(
            _gmail_send_sync, to, subject, body
        )


def _gmail_send_sync(to: str, subject: str, body: str) -> ProviderResult:
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise ProviderError(
            "Google API libraries are not installed. Install the `providers` extra."
        ) from exc

    credentials = Credentials(
        token=None,
        refresh_token=settings.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.send"],
    )
    message = EmailMessage()
    message["To"] = to
    message["From"] = "me"
    message["Subject"] = subject
    message.set_content(body)
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    try:
        service = build("gmail", "v1", credentials=credentials, cache_discovery=False)
        sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    except Exception as exc:
        raise ProviderError(f"Gmail rejected the message: {exc}") from exc
    return ProviderResult(
        ok=True,
        provider_id=str(sent.get("id") or ""),
        simulated=False,
        detail="Delivered through the authorized Gmail account.",
    )


class PayPalAdapter(ProviderAdapter):
    provider = "PayPal"

    @property
    def configured(self) -> bool:
        return settings.paypal_configured

    async def _token(self) -> str:
        if not self.configured:
            raise ProviderError(
                "PayPal credentials are missing. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
            )
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{settings.paypal_base_url}/v1/oauth2/token",
                auth=(settings.paypal_client_id, settings.paypal_client_secret),
                data={"grant_type": "client_credentials"},
            )
        if response.status_code != 200:
            raise ProviderError(f"PayPal authentication failed ({response.status_code}).")
        return str(response.json()["access_token"])

    async def create_payment_request(
        self,
        *,
        email: str,
        amount_cents: int,
        currency: str,
        description: str,
    ) -> ProviderResult:
        if settings.provider_mode == "simulated":
            return ProviderResult(
                ok=True,
                provider_id=_simulated_id("paypal"),
                simulated=True,
                detail="Simulated PayPal Sandbox invoice. No money moved and no invoice was created.",
            )
        token = await self._token()
        payload = {
            "detail": {
                "currency_code": currency,
                "note": description[:1000],
            },
            "invoicing_metadata": {"auto_increment_invoice_number": True},
            "primary_recipients": [{"billing_info": {"email_address": email}}],
            "items": [
                {
                    "name": description[:190] or "Freelance services",
                    "quantity": "1",
                    "unit_amount": {"currency_code": currency, "value": f"{amount_cents / 100:.2f}"},
                }
            ],
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.paypal_base_url}/v2/invoicing/invoices",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "PayPal-Request-Id": uuid.uuid4().hex,
                },
                content=json.dumps(payload),
            )
        if response.status_code not in {200, 201}:
            raise ProviderError(f"PayPal rejected the invoice ({response.status_code}).")
        body = response.json()
        return ProviderResult(
            ok=True,
            provider_id=body.get("id") or body.get("invoice_id"),
            simulated=False,
            detail="PayPal Sandbox invoice created. The client still has to approve payment.",
        )

    async def fetch_invoice_status(self, provider_id: str) -> str | None:
        if settings.provider_mode == "simulated":
            return None
        token = await self._token()
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{settings.paypal_base_url}/v2/invoicing/invoices/{provider_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
        if response.status_code != 200:
            raise ProviderError(f"PayPal invoice lookup failed ({response.status_code}).")
        status = str(response.json().get("status") or "").upper()
        return {
            "PAID": "paid",
            "PARTIALLY_PAID": "partially_paid",
            "SENT": "sent",
            "DRAFT": "draft",
            "CANCELLED": "refunded",
            "REFUNDED": "refunded",
        }.get(status, "unsynced")


class TelegramAdapter(ProviderAdapter):
    provider = "Telegram"

    @property
    def configured(self) -> bool:
        return settings.telegram_configured

    async def send_message(self, *, chat_id: str, text: str) -> ProviderResult:
        if settings.provider_mode == "simulated":
            return ProviderResult(
                ok=True,
                provider_id=_simulated_id("telegram"),
                simulated=True,
                detail="Simulated Telegram message. Nothing was posted to a chat.",
            )
        if not settings.telegram_configured:
            raise ProviderError("Telegram bot credentials are not configured.")
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": text[:4096]},
            )
        body = response.json()
        if response.status_code != 200 or not body.get("ok"):
            raise ProviderError("Telegram rejected the message.")
        return ProviderResult(
            ok=True,
            provider_id=str(body["result"]["message_id"]),
            simulated=False,
            detail="Telegram accepted the message.",
        )


class CalendarAdapter(ProviderAdapter):
    provider = "Google Calendar"

    @property
    def configured(self) -> bool:
        return settings.gcal_configured

    async def create_calendar_event(
        self, *, title: str, starts_at: str, ends_at: str, description: str
    ) -> ProviderResult:
        if settings.provider_mode == "simulated":
            return ProviderResult(
                ok=True,
                provider_id=_simulated_id("gcal"),
                simulated=True,
                detail="Simulated calendar event. No calendar was changed.",
            )
        if not self.configured:
            raise ProviderError("Google Calendar is not connected.")
        return await anyio.to_thread.run_sync(
            _calendar_create_sync, title, starts_at, ends_at, description
        )


def _calendar_create_sync(
    title: str, starts_at: str, ends_at: str, description: str
) -> ProviderResult:
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise ProviderError(
            "Google API libraries are not installed. Install the `providers` extra."
        ) from exc
    credentials = Credentials(
        token=None,
        refresh_token=settings.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        scopes=["https://www.googleapis.com/auth/calendar.events"],
    )
    body = {
        "summary": title,
        "description": description,
        "start": {"dateTime": starts_at},
        "end": {"dateTime": ends_at},
    }
    try:
        service = build("calendar", "v3", credentials=credentials, cache_discovery=False)
        event = service.events().insert(calendarId="primary", body=body).execute()
    except Exception as exc:
        raise ProviderError(f"Google Calendar rejected the event: {exc}") from exc
    return ProviderResult(
        ok=True,
        provider_id=str(event.get("id") or ""),
        simulated=False,
        detail="Event added to the authorized Google Calendar.",
    )


_ADAPTERS: dict[str, ProviderAdapter] = {
    "gmail": GmailAdapter(),
    "paypal": PayPalAdapter(),
    "telegram": TelegramAdapter(),
    "gcal": CalendarAdapter(),
}


def adapter_for(provider: str) -> ProviderAdapter | None:
    key = provider.strip().lower()
    if key in {"google calendar", "calendar"}:
        key = "gcal"
    return _ADAPTERS.get(key)


def adapter_status() -> dict[str, dict[str, bool | str]]:
    return {
        name: {
            "mode": settings.provider_mode,
            "configured": adapter.configured,
        }
        for name, adapter in _ADAPTERS.items()
    }


async def execute_provider_action(
    *,
    provider: str,
    kind: str,
    recipient: str,
    subject: str,
    body: str,
    amount_cents: int | None,
    currency: str | None,
    metadata: dict[str, str] | None = None,
) -> ProviderResult:
    adapter = adapter_for(provider)
    if adapter is None:
        raise ProviderError(f"Unsupported provider: {provider}")
    try:
        if kind == "email":
            return await adapter.send_email(to=recipient, subject=subject, body=body)
        if kind == "payment_request":
            if amount_cents is None:
                raise ProviderError("A payment request needs an amount.")
            return await adapter.create_payment_request(
                email=recipient,
                amount_cents=amount_cents,
                currency=currency or "USD",
                description=subject or body,
            )
        if kind == "calendar":
            meta = metadata or {}
            return await adapter.create_calendar_event(
                title=subject or "Visun deadline",
                starts_at=meta.get("startsAt", ""),
                ends_at=meta.get("endsAt", ""),
                description=body,
            )
        if kind == "report":
            return await adapter.send_email(to=recipient, subject=subject, body=body)
        raise ProviderError(f"Unsupported action kind: {kind}")
    except ProviderError as exc:
        log.warning("provider_action_failed", provider=provider, kind=kind, error=str(exc))
        raise
