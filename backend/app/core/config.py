import os
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Runtime environment ───────────────────────────────────────────────────
    # "production" enables strict configuration checks at startup.
    app_env: Literal["development", "test", "production"] = "development"

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str

    # ── Firebase Admin SDK ────────────────────────────────────────────────────
    # Path to the service-account JSON file downloaded from Firebase Console.
    # Keep this file outside the repository and never commit it.
    # Leave unset to use Application Default Credentials (ADC).
    firebase_service_account_path: str | None = None
    firebase_project_id: str = "meditrack-7fe46"

    # ── HTTP ──────────────────────────────────────────────────────────────────
    # Comma-separated list of browser origins allowed by CORS.
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ── Payments (Stripe Checkout) ───────────────────────────────────────────
    # Leave unset to disable online payment. Only TEST-mode keys are accepted.
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_currency: str = "usd"
    # Where Stripe sends the browser back after checkout (the frontend origin).
    public_app_url: str = "http://localhost:5173"

    # ── Logging ───────────────────────────────────────────────────────────────
    # SQL echo logs statement parameters, which can include patient data.
    # Keep it off unless you are debugging locally.
    db_echo: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("database_url")
    @classmethod
    def _psycopg_driver(cls, value: str) -> str:
        # Hosting providers hand out postgres:// or postgresql:// URLs, which
        # SQLAlchemy maps to psycopg2; this project installs psycopg 3.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    @field_validator("allowed_origins")
    @classmethod
    def _strip_origins(cls, value: str) -> str:
        return ",".join(o.strip() for o in value.split(",") if o.strip())

    @field_validator("stripe_secret_key")
    @classmethod
    def _test_mode_only(cls, value: str | None) -> str | None:
        if value and not value.startswith(("sk_test_", "rk_test_")):
            raise ValueError("STRIPE_SECRET_KEY must be a Stripe test-mode key (sk_test_… or rk_test_…).")
        return value or None

    @field_validator("stripe_currency")
    @classmethod
    def _currency(cls, value: str) -> str:
        value = value.strip().lower()
        if len(value) != 3 or not value.isalpha():
            raise ValueError("STRIPE_CURRENCY must be a 3-letter ISO currency code.")
        return value

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key)

    @property
    def cors_origins(self) -> list[str]:
        return [o for o in self.allowed_origins.split(",") if o]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        if not self.is_production:
            return self
        problems = []
        if "*" in self.cors_origins:
            problems.append("ALLOWED_ORIGINS must list explicit origins in production.")
        if any("localhost" in o or "127.0.0.1" in o for o in self.cors_origins):
            problems.append("ALLOWED_ORIGINS must not include localhost in production.")
        if self.db_echo:
            problems.append("DB_ECHO must be false in production.")
        if os.getenv("FIREBASE_AUTH_EMULATOR_HOST"):
            # In emulator mode the Admin SDK accepts unsigned, unexpiring tokens.
            problems.append("FIREBASE_AUTH_EMULATOR_HOST must not be set in production.")
        if self.stripe_enabled:
            if not self.stripe_webhook_secret:
                # Without it bills are only settled when a patient returns to the site.
                problems.append("STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set.")
            if not self.public_app_url.startswith("https://") or "localhost" in self.public_app_url:
                problems.append("PUBLIC_APP_URL must be the deployed https:// frontend URL.")
        if problems:
            raise ValueError(" ".join(problems))
        return self


settings = Settings()
