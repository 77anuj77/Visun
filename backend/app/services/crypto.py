"""Symmetric encryption for provider refresh tokens."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from ..core.config import settings


def _fernet() -> Fernet | None:
    if not settings.app_encryption_key:
        return None
    digest = hashlib.sha256(settings.app_encryption_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    fernet = _fernet()
    if fernet is None:
        raise RuntimeError("APP_ENCRYPTION_KEY is required to store provider credentials.")
    return fernet.encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    fernet = _fernet()
    if fernet is None:
        raise RuntimeError("APP_ENCRYPTION_KEY is missing.")
    try:
        return fernet.decrypt(value.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Stored provider credential could not be decrypted.") from exc
