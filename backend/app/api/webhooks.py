"""Public provider callbacks.

These routes are unauthenticated by design and therefore verify provider
authenticity before touching storage. Unconfigured providers return 503 rather
than accepting unverified payloads.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from ..core.config import settings
from ..core.database import engine
from ..core.logging import log
from ..core.security import PrincipalDep
from ..models import (
    ExternalMessage,
    IntegrationConnection,
    IntegrationCredential,
    Invoice,
    Payment,
    Project,
    WebhookEvent,
    utcnow,
)
from ..services.actions import record_activity
from ..services.crypto import encrypt_secret
from ..timeutil import parse_dt

router = APIRouter()


def _dedupe(session: Session, provider: str, external_id: str) -> bool:
    """Return True when this event was already processed."""
    existing = session.exec(
        select(WebhookEvent).where(WebhookEvent.external_event_id == external_id)
    ).first()
    return existing is not None and existing.processed_at is not None


def _record_event(
    session: Session,
    *,
    provider: str,
    external_id: str,
    verification_state: str,
    result: str,
) -> WebhookEvent | None:
    existing = session.exec(
        select(WebhookEvent).where(WebhookEvent.external_event_id == external_id)
    ).first()
    if existing is not None:
        existing.processed_at = utcnow()
        existing.result = result
        session.add(existing)
        return existing
    event = WebhookEvent(
        id=f"wh-{uuid.uuid4().hex[:12]}",
        provider=provider,
        external_event_id=external_id,
        verification_state=verification_state,
        processed_at=utcnow(),
        result=result,
    )
    session.add(event)
    return event


@router.post("/integrations/telegram/webhook", tags=["webhooks"])
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, Any]:
    if not settings.telegram_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram is not configured on this server.",
        )
    if not hmac.compare_digest(
        x_telegram_bot_api_secret_token or "", settings.telegram_webhook_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid Telegram webhook secret.")
    update = await request.json()
    update_id = str(update.get("update_id") or "")
    if not update_id:
        raise HTTPException(status_code=400, detail="Telegram update_id is required.")
    message = update.get("message") or update.get("edited_message") or {}
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "")
    text = str(message.get("text") or "")
    if not chat_id or not text:
        return {"ok": True, "ignored": "no text message"}
    allowed = {
        item.strip()
        for item in settings.telegram_allowed_chat_ids.split(",")
        if item.strip()
    }
    if chat_id not in allowed:
        log.info("telegram_chat_not_allowed", chat_id=chat_id)
        return {"ok": True, "ignored": "chat not allowlisted"}
    try:
        mapping = json.loads(settings.telegram_chat_project_map or "{}")
    except json.JSONDecodeError:
        mapping = {}
    project_id = mapping.get(chat_id)
    if not project_id:
        return {"ok": True, "ignored": "chat has no authorized project mapping"}
    with Session(engine) as session:
        if _dedupe(session, "telegram", f"telegram:{update_id}"):
            return {"ok": True, "duplicate": True}
        project = session.get(Project, project_id)
        if project is None:
            return {"ok": True, "ignored": "project not found"}
        sender = " ".join(
            part
            for part in [chat.get("first_name"), chat.get("last_name")]
            if part
        ) or chat.get("username") or "Telegram user"
        external_message_id = f"telegram:{chat_id}:{message.get('message_id')}"
        existing_message = session.exec(
            select(ExternalMessage).where(
                ExternalMessage.source_message_id == external_message_id
            )
        ).first()
        if existing_message is None:
            session.add(
                ExternalMessage(
                    id=f"msg-{uuid.uuid4().hex[:10]}",
                    workspace_id=project.workspace_id,
                    project_id=project.id,
                    provider="Telegram",
                    source_message_id=external_message_id,
                    sender=sender,
                    sender_role="client",
                    text=text,
                    sent_at=parse_dt(message.get("date", time.time())),
                    consent=f"Authorized group {chat_id}",
                )
            )
        _record_event(
            session,
            provider="telegram",
            external_id=f"telegram:{update_id}",
            verification_state="verified",
            result="message stored",
        )
        record_activity(
            session,
            workspace_id=project.workspace_id,
            type="ingest",
            actor="Telegram",
            title="Authorized message ingested",
            detail=f"Message from {sender} stored against {project.name} after allowlist check.",
            status="info",
            reference=project.id,
            project_id=project.id,
        )
        session.commit()
    return {"ok": True, "stored": True}


@router.post("/integrations/paypal/webhook", tags=["webhooks"])
async def paypal_webhook(
    request: Request,
    paypal_transmission_id: str | None = Header(default=None, alias="PAYPAL-TRANSMISSION-ID"),
    paypal_transmission_time: str | None = Header(default=None, alias="PAYPAL-TRANSMISSION-TIME"),
    paypal_cert_url: str | None = Header(default=None, alias="PAYPAL-CERT-URL"),
    paypal_auth_algo: str | None = Header(default=None, alias="PAYPAL-AUTH-ALGO"),
    paypal_transmission_sig: str | None = Header(default=None, alias="PAYPAL-TRANSMISSION-SIG"),
) -> dict[str, Any]:
    if not settings.paypal_configured or not settings.paypal_webhook_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PayPal webhooks are not configured on this server.",
        )
    if not all(
        [
            paypal_transmission_id,
            paypal_transmission_time,
            paypal_cert_url,
            paypal_auth_algo,
            paypal_transmission_sig,
        ]
    ):
        raise HTTPException(status_code=400, detail="Missing PayPal signature headers.")
    raw = await request.body()
    try:
        event = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid PayPal payload.") from exc
    verification = await _verify_paypal_signature(
        raw=raw,
        transmission_id=paypal_transmission_id or "",
        transmission_time=paypal_transmission_time or "",
        cert_url=paypal_cert_url or "",
        auth_algo=paypal_auth_algo or "",
        transmission_sig=paypal_transmission_sig or "",
    )
    if verification != "SUCCESS":
        raise HTTPException(status_code=401, detail="PayPal signature verification failed.")
    event_id = str(event.get("id") or "")
    if not event_id:
        raise HTTPException(status_code=400, detail="PayPal event id is required.")
    with Session(engine) as session:
        if _dedupe(session, "paypal", f"paypal:{event_id}"):
            return {"ok": True, "duplicate": True}
        event_type = str(event.get("event_type") or "")
        resource = event.get("resource") or {}
        invoice_provider_id = str(
            resource.get("invoice_id") or resource.get("id") or ""
        )
        invoice = session.exec(
            select(Invoice).where(Invoice.provider_id == invoice_provider_id)
        ).first()
        result = "verified; no matching invoice"
        if (
            invoice is not None
            and event_type.startswith("INVOICING.INVOICE")
            and event_type.endswith(("PAID", "COMPLETED"))
        ):
            invoice.status = "paid"
            invoice.amount_paid_cents = invoice.amount_cents
            invoice.last_verified_at = utcnow()
            session.add(invoice)
            session.add(
                Payment(
                    id=f"pay-{uuid.uuid4().hex[:10]}",
                    workspace_id=invoice.workspace_id,
                    invoice_id=invoice.id,
                    provider="PayPal",
                    provider_object_id=invoice_provider_id,
                    provider_status="COMPLETED",
                    amount_cents=invoice.amount_cents,
                    currency=invoice.currency,
                    verified=True,
                    simulated=False,
                    event_at=utcnow(),
                )
            )
            result = f"{invoice.number} marked paid from verified webhook"
            record_activity(
                session,
                workspace_id=invoice.workspace_id,
                type="payment",
                actor="PayPal",
                title="PayPal payment verified",
                detail=f"{invoice.number} was confirmed by a signature-verified PayPal webhook.",
                status="success",
                reference=invoice.id,
                project_id=invoice.project_id,
            )
        _record_event(
            session,
            provider="paypal",
            external_id=f"paypal:{event_id}",
            verification_state="verified",
            result=result,
        )
        session.commit()
    return {"ok": True, "result": result}


async def _verify_paypal_signature(
    *,
    raw: bytes,
    transmission_id: str,
    transmission_time: str,
    cert_url: str,
    auth_algo: str,
    transmission_sig: str,
) -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post(
            f"{settings.paypal_base_url}/v1/oauth2/token",
            auth=(settings.paypal_client_id, settings.paypal_client_secret),
            data={"grant_type": "client_credentials"},
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=502, detail="PayPal authentication failed.")
        token = token_response.json()["access_token"]
        response = await client.post(
            f"{settings.paypal_base_url}/v1/notifications/verify-webhook-signature",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "transmission_id": transmission_id,
                "transmission_time": transmission_time,
                "cert_url": cert_url,
                "auth_algo": auth_algo,
                "transmission_sig": transmission_sig,
                "webhook_id": settings.paypal_webhook_id,
                "webhook_event": json.loads(raw),
            },
        )
    if response.status_code != 200:
        return "FAILURE"
    return str(response.json().get("verification_status") or "FAILURE")


def _state_secret() -> str:
    secret = settings.app_encryption_key or settings.clerk_secret_key
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Set APP_ENCRYPTION_KEY before starting Google OAuth.",
        )
    return secret


def _make_state(workspace_id: str) -> str:
    issued = str(int(time.time()))
    signature = hmac.new(
        _state_secret().encode("utf-8"),
        f"google:{workspace_id}:{issued}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{issued}.{signature}.{workspace_id}"


def _verify_state(state: str) -> str | None:
    try:
        issued, signature, workspace_id = state.split(".", 2)
    except ValueError:
        return None
    if int(time.time()) - int(issued) > 600:
        return None
    expected = hmac.new(
        _state_secret().encode("utf-8"),
        f"google:{workspace_id}:{issued}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    return workspace_id


@router.get("/integrations/google/start", tags=["webhooks"])
def google_oauth_start(principal: PrincipalDep) -> dict[str, str]:
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured.")
    from urllib.parse import urlencode

    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
        "scope": "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
        "state": _make_state(principal.workspace_id),
    }
    return {
        "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode(params)
    }


@router.get("/integrations/google/callback", tags=["webhooks"])
async def google_callback(
    code: str = Query(min_length=1), state: str = Query(default="")
) -> RedirectResponse:
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured.")
    workspace_id = _verify_state(state)
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "redirect_uri": settings.google_oauth_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Google token exchange failed.")
    body = response.json()
    refresh_token = body.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Google did not return a refresh token. Reconnect with consent.",
        )
    ciphertext = encrypt_secret(refresh_token)
    with Session(engine) as session:
        for provider in ("gmail", "gcal"):
            credential = session.exec(
                select(IntegrationCredential).where(
                    IntegrationCredential.workspace_id == workspace_id,
                    IntegrationCredential.provider == provider,
                )
            ).first()
            if credential is None:
                credential = IntegrationCredential(
                    id=f"cred-{uuid.uuid4().hex[:10]}",
                    workspace_id=workspace_id,
                    provider=provider,
                    ciphertext=ciphertext,
                    scopes=[
                        "https://www.googleapis.com/auth/gmail.send",
                        "https://www.googleapis.com/auth/calendar.events",
                    ],
                )
            else:
                credential.ciphertext = ciphertext
                credential.updated_at = utcnow()
            session.add(credential)
            connection = session.exec(
                select(IntegrationConnection).where(
                    IntegrationConnection.workspace_id == workspace_id,
                    IntegrationConnection.provider == provider,
                )
            ).first()
            if connection is not None:
                connection.connected = True
                connection.simulated = False
                connection.last_sync = utcnow()
                session.add(connection)
        record_activity(
            session,
            workspace_id=workspace_id,
            type="integration",
            actor="You",
            title="Google account authorized",
            detail="Gmail and Calendar scopes connected; refresh token stored encrypted.",
            status="success",
            reference="google-oauth",
        )
        session.commit()
    return RedirectResponse(
        url=f"{settings.frontend_origin}/app/settings/integrations?google=connected",
        status_code=303,
    )
