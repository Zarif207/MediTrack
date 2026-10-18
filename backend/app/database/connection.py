from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    # DB_ECHO logs every statement with its parameters (patient data); off by default.
    echo=settings.db_echo,
    # Without this, SQLAlchemy error messages — which the error handlers log —
    # include the bound parameters, i.e. patient data.
    hide_parameters=not settings.db_echo,
    # Managed PostgreSQL hosts close idle connections; test before reuse.
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)
