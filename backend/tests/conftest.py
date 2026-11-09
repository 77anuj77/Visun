"""Test configuration.

The suite runs against a throwaway SQLite database with demo auth and simulated
providers, which is the zero-credential path a new contributor gets. PostgreSQL
compatibility is exercised separately with `TEST_DATABASE_URL`.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="visun-tests-"))
# Assign rather than setdefault: a developer's `backend/.env` also feeds
# pydantic-settings, and a stray `ALLOW_PUBLIC_DEMO=true` or `AUTH_MODE=clerk`
# there would change what the assertions below describe. Environment variables
# win over the env file, so the suite stays hermetic either way.
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP / 'visun-test.db'}"
os.environ["AUTH_MODE"] = "demo"
os.environ["ALLOW_PUBLIC_DEMO"] = "false"
os.environ["PROVIDER_MODE"] = "simulated"
os.environ["AGENT_BACKEND"] = "deterministic"
os.environ["VOICE_BACKEND"] = "browser"
os.environ["APP_ENCRYPTION_KEY"] = "test-encryption-key-not-a-secret"

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.database import engine, reset_demo
from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_workspace(client):
    """Reset the demo workspace before each test so tests are order-independent."""
    with Session(engine) as session:
        reset_demo(session)
    yield


@pytest.fixture
def api(client):
    return client


@pytest.fixture
def demo_settings():
    return settings
