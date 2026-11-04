from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import assistant, system, webhooks, workspace
from .core.config import settings
from .core.database import init_db
from .core.errors import install_error_handlers
from .core.logging import configure_logging, log


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    init_db()
    log.info(
        "visun_started",
        environment=settings.environment,
        auth_mode=settings.auth_mode,
        public_demo=settings.allow_public_demo,
        provider_mode=settings.provider_mode,
        database=settings.database_url.split("@")[-1],
    )
    yield


app = FastAPI(
    title="Visun API",
    version="1.0.0",
    description=(
        "Voice-first freelance operations API. The agent reads authorized workspace "
        "data and prepares actions; external writes require an explicit owner approval. "
        "Simulated provider mode never reports a write as real."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Visun-Demo", "X-Telegram-Bot-Api-Secret-Token"],
)

install_error_handlers(app)

app.include_router(system.router, prefix="/api/v1")
app.include_router(workspace.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {
        "name": "Visun API",
        "status": "ok",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
