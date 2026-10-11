from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str

    # ── Firebase Admin SDK ────────────────────────────────────────────────────
    # Path to the service-account JSON file downloaded from Firebase Console.
    # Keep this file outside the repository and never commit it.
    # Leave unset to use Application Default Credentials (ADC) in CI/CD.
    firebase_service_account_path: str | None = None

    # ── Runtime ───────────────────────────────────────────────────────────────
    # Set to False in production to silence SQLAlchemy query logging.
    db_echo: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
