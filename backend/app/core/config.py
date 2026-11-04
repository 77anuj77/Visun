from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server configuration. Secrets never leave the backend.

    Environment variable names follow the public contract (`DATABASE_URL`,
    `AUTH_MODE`, `PROVIDER_MODE`). The legacy `VISUN_*` aliases are accepted so
    existing local `.env` files keep working.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Core
    environment: Literal["development", "test", "production"] = Field(
        default="development", validation_alias=AliasChoices("ENVIRONMENT", "VISUN_ENVIRONMENT")
    )
    database_url: str = Field(
        default="sqlite:///./visun.db",
        validation_alias=AliasChoices("DATABASE_URL", "VISUN_DATABASE_URL"),
    )
    auth_mode: Literal["demo", "clerk"] = Field(
        default="demo", validation_alias=AliasChoices("AUTH_MODE", "VISUN_AUTH_MODE")
    )
    allow_public_demo: bool = Field(
        default=False,
        validation_alias=AliasChoices("ALLOW_PUBLIC_DEMO", "VISUN_ALLOW_PUBLIC_DEMO"),
    )
    frontend_origin: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("FRONTEND_ORIGIN", "VISUN_FRONTEND_ORIGIN"),
    )
    extra_origins: str = Field(
        default="", validation_alias=AliasChoices("EXTRA_ORIGINS", "VISUN_EXTRA_ORIGINS")
    )
    log_level: str = Field(
        default="INFO", validation_alias=AliasChoices("LOG_LEVEL", "VISUN_LOG_LEVEL")
    )
    provider_mode: Literal["simulated", "real"] = Field(
        default="simulated",
        validation_alias=AliasChoices("PROVIDER_MODE", "VISUN_PROVIDER_MODE"),
    )
    action_expiry_minutes: int = Field(default=30, ge=1, le=1440)

    # Clerk
    clerk_issuer: str = ""
    clerk_jwks_url: str = ""
    clerk_jwt_audience: str = ""
    clerk_secret_key: str = ""
    clerk_webhook_secret: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Gemini / Google ADK
    google_api_key: str = ""
    gemini_text_model: str = ""
    gemini_live_model: str = ""
    agent_backend: Literal["auto", "deterministic", "gemini"] = Field(
        default="auto", validation_alias=AliasChoices("AGENT_BACKEND", "VISUN_AGENT_BACKEND")
    )
    voice_backend: Literal["auto", "browser", "gemini_live"] = Field(
        default="auto", validation_alias=AliasChoices("VOICE_BACKEND", "VISUN_VOICE_BACKEND")
    )

    # Google OAuth
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = (
        "http://localhost:8000/api/v1/integrations/google/callback"
    )
    google_refresh_token: str = ""

    # PayPal
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_environment: str = "sandbox"
    paypal_webhook_id: str = ""

    # Telegram
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""
    telegram_allowed_chat_ids: str = ""
    telegram_chat_project_map: str = "{}"

    # App
    app_encryption_key: str = ""

    @model_validator(mode="after")
    def guard_production(self) -> "Settings":
        if self.environment == "production":
            if self.auth_mode == "demo":
                raise ValueError(
                    "AUTH_MODE=demo is refused in production. Configure Clerk and set AUTH_MODE=clerk."
                )
            if not self.clerk_issuer and not self.clerk_jwks_url:
                raise ValueError(
                    "Clerk issuer or JWKS URL is required when ENVIRONMENT=production."
                )
            if self.frontend_origin.startswith("http://"):
                raise ValueError("FRONTEND_ORIGIN must use https in production.")
        return self

    @property
    def cors_origins(self) -> list[str]:
        origins = [self.frontend_origin]
        origins.extend(
            origin.strip() for origin in self.extra_origins.split(",") if origin.strip()
        )
        return sorted(set(origins))

    @property
    def clerk_jwks(self) -> str:
        if self.clerk_jwks_url:
            return self.clerk_jwks_url
        if self.clerk_issuer:
            return f"{self.clerk_issuer.rstrip('/')}/.well-known/jwks.json"
        return ""

    @property
    def simulated_providers(self) -> bool:
        """Simulated mode keeps every provider call local and clearly labelled."""
        return self.provider_mode == "simulated"

    @property
    def paypal_configured(self) -> bool:
        return bool(self.paypal_client_id and self.paypal_client_secret)

    @property
    def gmail_configured(self) -> bool:
        return bool(
            self.google_oauth_client_id
            and self.google_oauth_client_secret
            and self.google_refresh_token
        )

    @property
    def gcal_configured(self) -> bool:
        return self.gmail_configured

    @property
    def telegram_configured(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_webhook_secret)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.google_api_key and self.gemini_text_model)

    @property
    def gemini_live_configured(self) -> bool:
        return bool(self.google_api_key and self.gemini_live_model)

    @property
    def paypal_base_url(self) -> str:
        if self.paypal_environment.lower() == "live":
            return "https://api-m.paypal.com"
        return "https://api-m.sandbox.paypal.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
