"""
Bring the database schema up to date. Run from backend/:

    python -m migrations

1. Creates every missing table from the SQLAlchemy models. Existing tables and
   rows are never altered, dropped or truncated.
2. Applies the column and constraint migrations below, in order, for databases
   created before those columns existed. On a current database each is a no-op.

Every step only adds, so this is safe on a new database, an old one, or one
that is already up to date. appointment_ownership checks existing data first
and stops without changing anything if it finds rows it cannot migrate.
"""
import app.models  # noqa: F401  (registers every table)
from app.database.base import Base
from app.database.connection import engine
from migrations import (
    add_doctor_link,
    add_patient_link,
    appointment_ownership,
    appointments_firebase_uid,
)

STEPS = (add_patient_link, appointments_firebase_uid, appointment_ownership, add_doctor_link)


def main() -> None:
    print(f"Database: {engine.url.database}")
    Base.metadata.create_all(bind=engine)
    print("✓ Missing tables created; existing tables untouched.")
    for step in STEPS:
        print(f"→ {step.__name__.rsplit('.', 1)[-1]}")
        step.main()
    print("Schema is up to date.")


if __name__ == "__main__":
    main()
