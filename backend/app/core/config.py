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

    # ── Logging ───────────────────────────────────────────────────────────────
    # SQL echo logs statement parameters, which can include patient data.
    # Keep it off unless you are debugging locally.
    db_echo: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("allowed_origins")
    @classmethod
    def _strip_origins(cls, value: str) -> str:
        return ",".join(o.strip() for o in value.split(",") if o.strip())

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
        if problems:
            raise ValueError(" ".join(problems))
        return self


settings = Settings()
