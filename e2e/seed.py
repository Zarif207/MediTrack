"""
Reset and seed the *_test* database for browser end-to-end tests.

    cd backend && .venv/bin/python ../e2e/seed.py      # called by run.mjs before each run
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("DB_ECHO", "false")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))


def seed(engine) -> None:
    from sqlalchemy import text
    from sqlalchemy.orm import Session

    import app.models  # noqa: F401
    from app.database.base import Base
    from app.models import Department, Doctor

    if not engine.url.database.endswith("_test"):
        raise SystemExit("Refusing: not a *_test database.")
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    with Session(engine) as db:
        cardio = Department(department_name="Cardiology", description="Heart and circulation (synthetic)")
        neuro = Department(department_name="Neurology", description="Brain and nerves (synthetic)")
        db.add_all([cardio, neuro]); db.flush()
        db.add_all([
            Doctor(department_id=cardio.department_id, first_name="Ada", last_name="Okafor", specialization="Cardiology",
                   phone="+1 555 0101", email="ada.e2e@example.com", license_number="E2E-001"),
            Doctor(department_id=neuro.department_id, first_name="Ben", last_name="Iyer", specialization="Neurology",
                   phone="+1 555 0102", email="ben.e2e@example.com", license_number="E2E-002"),
        ])
        db.commit()


if __name__ == "__main__":
    from sqlalchemy import create_engine
    from sqlalchemy.engine import make_url

    from app.core.config import settings

    dev = make_url(settings.database_url)
    test = make_url(os.getenv("TEST_DATABASE_URL") or dev.set(database=f"{dev.database}_test"))
    if test.database == dev.database:
        raise SystemExit("Refusing: not a *_test database.")
    seed(create_engine(test))
    print(f"reset and seeded {test.database}")
