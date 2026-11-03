import hashlib
import json
from typing import Any


def canonical_payload(
    *,
    kind: str,
    recipient: str,
    subject: str,
    body: str,
    amount_cents: int | None,
    currency: str | None,
    provider: str,
) -> dict[str, Any]:
    return {
        "kind": kind,
        "recipient": recipient.strip(),
        "subject": subject.strip(),
        "body": body.strip(),
        "amount_cents": amount_cents,
        "currency": currency,
        "provider": provider,
    }


def payload_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def idempotency_key(action_id: str, canonical: str) -> str:
    return hashlib.sha256(f"{action_id}:{canonical}".encode()).hexdigest()[:40]
