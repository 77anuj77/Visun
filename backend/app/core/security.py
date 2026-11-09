"""Authentication, workspace authorization, and lightweight rate limiting.

Demo mode trusts the local seeded principal so the workspace runs without
credentials. Clerk mode verifies a real bearer JWT against the configured JWKS
and provisions the application user idempotently on first verified login.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Annotated, Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlmodel import Session, select

from ..models import User, Workspace, WorkspaceMember
from ..seed import SAMPLE_EMAIL, seed_workspace_from_demo
from .config import settings
from .database import get_session

bearer = HTTPBearer(auto_error=False)
SessionDep = Annotated[Session, Depends(get_session)]


@dataclass(frozen=True)
class Principal:
    user_id: str
    clerk_user_id: str
    workspace_id: str
    role: str
    name: str
    email: str

    @property
    def can_write(self) -> bool:
        return self.role in {"owner", "member"}


_jwks_client: PyJWKClient | None = None
_jwks_lock = threading.Lock()


def _jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        with _jwks_lock:
            if _jwks_client is None:
                if not settings.clerk_jwks:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Clerk is not configured on this server.",
                    )
                _jwks_client = PyJWKClient(settings.clerk_jwks, cache_keys=True)
    return _jwks_client


def _claims_from_token(token: str) -> dict[str, Any]:
    try:
        signing_key = _jwks().get_signing_key_from_jwt(token)
        options: dict[str, Any] = {"require": ["exp", "iat", "sub"]}
        kwargs: dict[str, Any] = {"algorithms": ["RS256"]}
        if settings.clerk_issuer:
            kwargs["issuer"] = settings.clerk_issuer
        if settings.clerk_jwt_audience:
            kwargs["audience"] = settings.clerk_jwt_audience
        else:
            options["verify_aud"] = False
        return jwt.decode(token, signing_key.key, options=options, **kwargs)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# Clerk's default session-token claims carry only the subject, so a freshly
# provisioned account would otherwise keep a placeholder identity forever.
# Read the person's real name/email once from Clerk and cache the answer.
PLACEHOLDER_NAME = "Visun user"
PLACEHOLDER_EMAIL_SUFFIX = "@users.clerk.local"

_profile_cache: dict[str, tuple[str, str] | None] = {}
_profile_lock = threading.Lock()


def _clerk_profile(clerk_id: str) -> tuple[str, str] | None:
    """Return `(name, email)` for a Clerk user, or None when unavailable."""
    with _profile_lock:
        if clerk_id in _profile_cache:
            return _profile_cache[clerk_id]
    if not settings.clerk_secret_key:
        return None
    profile: tuple[str, str] | None = None
    try:
        response = httpx.get(
            f"https://api.clerk.com/v1/users/{clerk_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            timeout=3.0,
        )
        if response.status_code == 200:
            payload = response.json()
            name = " ".join(
                str(part)
                for part in [payload.get("first_name"), payload.get("family_name")]
                if part
            ) or str(payload.get("username") or "")
            emails = payload.get("email_addresses") or []
            primary = payload.get("primary_email_address_id")
            email = next(
                (
                    str(row.get("email_address") or "")
                    for row in emails
                    if row.get("id") == primary
                ),
                str(emails[0].get("email_address") or "") if emails else "",
            )
            if name and email:
                profile = (name, email)
    except (httpx.HTTPError, TypeError, ValueError):
        # Network/HTTP/parse failure must never block sign-in.
        profile = None
    with _profile_lock:
        _profile_cache[clerk_id] = profile
    return profile


def _refresh_placeholder_identity(
    session: Session, user: User, clerk_id: str
) -> None:
    """Replace a placeholder identity with the real Clerk profile.

    Only rows that still carry the generated placeholder are touched, and the
    workspace is renamed only while it still has its generated name, so an
    account with real data is never overwritten.
    """
    profile = _clerk_profile(clerk_id)
    if profile is None:
        return
    name, email = profile
    previous_first = user.name.split(" ")[0]
    user.name = name
    user.email = email
    session.add(user)
    workspace = session.exec(
        select(Workspace).where(Workspace.owner_user_id == user.id)
    ).first()
    if workspace is not None and workspace.name == f"{previous_first}'s workspace":
        workspace.name = f"{name.split(' ')[0]}'s workspace"
        session.add(workspace)
    session.commit()


def _provision(session: Session, claims: dict[str, Any]) -> Principal:
    clerk_id = str(claims["sub"])
    user = session.exec(select(User).where(User.clerk_user_id == clerk_id)).first()
    if user is None:
        name = " ".join(
            part
            for part in [claims.get("given_name"), claims.get("family_name")]
            if part
        ) or str(claims.get("name") or claims.get("email") or PLACEHOLDER_NAME)
        email = str(claims.get("email") or f"{clerk_id}{PLACEHOLDER_EMAIL_SUFFIX}")
        if name == PLACEHOLDER_NAME or email.endswith(PLACEHOLDER_EMAIL_SUFFIX):
            profile = _clerk_profile(clerk_id)
            if profile is not None:
                name, email = profile
        user = User(
            id=f"u-{clerk_id}",
            clerk_user_id=clerk_id,
            name=name,
            email=email,
        )
        session.add(user)
        workspace = Workspace(
            id=f"ws-{clerk_id}",
            name=f"{name.split(' ')[0]}'s workspace",
            owner_user_id=user.id,
        )
        session.add(workspace)
        session.add(
            WorkspaceMember(
                id=f"wm-{clerk_id}",
                workspace_id=workspace.id,
                user_id=user.id,
                role="owner",
            )
        )
        session.commit()
        session.refresh(user)
    elif user.name == PLACEHOLDER_NAME or user.email.endswith(PLACEHOLDER_EMAIL_SUFFIX):
        _refresh_placeholder_identity(session, user, clerk_id)
    membership = session.exec(
        select(WorkspaceMember).where(WorkspaceMember.user_id == user.id)
    ).first()
    if membership is None:
        workspace = session.exec(
            select(Workspace).where(Workspace.owner_user_id == user.id)
        ).first()
        if workspace is None:
            workspace = Workspace(
                id=f"ws-{user.id}", name=f"{user.name}'s workspace", owner_user_id=user.id
            )
            session.add(workspace)
            session.commit()
        membership = WorkspaceMember(
            id=f"wm-{user.id}",
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
        )
        session.add(membership)
        session.commit()
    # Sample records belong to exactly one verified email address. Everyone
    # else gets an empty workspace they fill themselves (or through the agent);
    # the helper is idempotent and never overwrites existing records.
    session.commit()
    if (user.email or "").strip().lower() == SAMPLE_EMAIL:
        seed_workspace_from_demo(
            session,
            workspace_id=membership.workspace_id,
            user_id=user.id,
            user_name=user.name,
        )
    return Principal(
        user_id=user.id,
        clerk_user_id=user.clerk_user_id,
        workspace_id=membership.workspace_id,
        role=membership.role,
        name=user.name,
        email=user.email,
    )


def _demo_principal(session: Session) -> Principal:
    from ..seed import CLERK_ID, USER_ID, WORKSPACE_ID

    user = session.get(User, USER_ID)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo workspace is not seeded. Restart the API to seed it.",
        )
    return Principal(
        user_id=USER_ID,
        clerk_user_id=CLERK_ID,
        workspace_id=WORKSPACE_ID,
        role="owner",
        name=user.name,
        email=user.email,
    )


def _wants_public_demo(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def resolve_principal(
    session: Session, token: str | None, *, allow_demo: bool = False
) -> Principal:
    if settings.auth_mode == "demo":
        return _demo_principal(session)
    if token:
        return _provision(session, _claims_from_token(token))
    if allow_demo and settings.allow_public_demo:
        # Explicit, opt-in public demo. It only ever resolves to the seeded demo
        # workspace and never grants access to a real user's data.
        return _demo_principal(session)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="A Clerk session token is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_principal(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    request: Request,
) -> Principal:
    return resolve_principal(
        session,
        credentials.credentials if credentials else None,
        allow_demo=_wants_public_demo(request.headers.get("x-visun-demo")),
    )


PrincipalDep = Annotated[Principal, Depends(get_principal)]


def get_optional_principal(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    request: Request,
) -> Principal | None:
    """Resolve the caller when credentials are present, without ever raising.

    Lets public endpoints report a caller's own workspace configuration while
    keeping the unauthenticated payload available.
    """
    allow_demo = _wants_public_demo(request.headers.get("x-visun-demo"))
    if settings.auth_mode != "demo" and credentials is None and not allow_demo:
        return None
    try:
        return resolve_principal(
            session,
            credentials.credentials if credentials else None,
            allow_demo=allow_demo,
        )
    except HTTPException:
        return None


OptionalPrincipalDep = Annotated[Principal | None, Depends(get_optional_principal)]


def require_writer(principal: PrincipalDep) -> Principal:
    if not principal.can_write:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your workspace role does not allow this change.",
        )
    return principal


WriterDep = Annotated[Principal, Depends(require_writer)]


def require_owner(principal: PrincipalDep) -> Principal:
    if principal.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the workspace owner can approve this action.",
        )
    return principal


OwnerDep = Annotated[Principal, Depends(require_owner)]


class RateLimiter:
    """Small in-process sliding window.

    Suitable for a single-instance modular monolith demo. A shared store
    (Redis) is the production replacement; the interface stays the same.
    """

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            while bucket and now - bucket[0] > self.window:
                bucket.popleft()
            if len(bucket) >= self.limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Try again in a moment.",
                    headers={"Retry-After": str(self.window)},
                )
            bucket.append(now)


agent_limiter = RateLimiter(limit=30, window_seconds=60)
ingest_limiter = RateLimiter(limit=60, window_seconds=60)


def enforce_agent_rate_limit(principal: PrincipalDep, request: Request) -> Principal:
    agent_limiter.check(f"{principal.workspace_id}:{principal.user_id}:{request.url.path}")
    return principal


AgentRateLimitedDep = Annotated[Principal, Depends(enforce_agent_rate_limit)]


async def websocket_principal(websocket: WebSocket) -> tuple[Principal, Session] | None:
    """Authenticate a WebSocket with its first message.

    The token never appears in the URL. In demo mode the first frame may be a
    plain ready ping. A Clerk-mode deployment that opted into `ALLOW_PUBLIC_DEMO`
    may send `X-Visun-Demo: 1` (or `demo: true` in the first frame) instead.
    """
    from .database import engine  # local import avoids a cycle at module load

    await websocket.accept()
    try:
        first = await websocket.receive_json()
    except Exception:  # noqa: BLE001
        await websocket.close(code=4400)
        return None
    session = Session(engine)
    token = first.get("token") if isinstance(first, dict) else None
    demo_flag = (
        _wants_public_demo(first.get("demo")) if isinstance(first, dict) else False
    )
    demo_flag = demo_flag or _wants_public_demo(websocket.headers.get("x-visun-demo"))
    try:
        principal = resolve_principal(session, token, allow_demo=demo_flag)
    except HTTPException as exc:
        await websocket.send_json(
            {"type": "error", "code": exc.status_code, "message": exc.detail}
        )
        await websocket.close(code=4401)
        session.close()
        return None
    return principal, session
