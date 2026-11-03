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
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_TMP / 'visun-test.db'}")
os.environ.setdefault("AUTH_MODE", "demo")
os.environ.setdefault("PROVIDER_MODE", "simulated")
os.environ.setdefault("AGENT_BACKEND", "deterministic")
os.environ.setdefault("VOICE_BACKEND", "browser")

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
