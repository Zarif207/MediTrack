from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import Settings, settings


def engine_options(config: Settings) -> dict:
    options = {
        # DB_ECHO logs every statement with its parameters (patient data); off by default.
        "echo": config.db_echo,
        # Without this, SQLAlchemy error messages — which the error handlers log —
        # include the bound parameters, i.e. patient data.
        "hide_parameters": not config.db_echo,
        # Managed PostgreSQL hosts close idle connections; test before reuse.
        "pool_pre_ping": True,
    }
    if config.is_serverless:
        # Function instances are frozen between requests, so a local pool would
        # hold idle connections open. Use the provider's pooled (PgBouncer) URL
        # instead; it runs in transaction mode, where server-side prepared
        # statements are unsafe.
        options["poolclass"] = NullPool
        options["connect_args"] = {"prepare_threshold": None}
    return options


engine = create_engine(settings.database_url, **engine_options(settings))

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)
