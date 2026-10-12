"""
Safe additive migration — adds a nullable firebase_uid column to appointments.

This enables unlinked patients (role=patient but patient_id=NULL) to book
appointments. The firebase_uid is set from the verified Firebase token so we
can always retrieve a patient's own pending bookings even before linking.

When an account is later linked (patient_id is set), we associate any pending
appointments that share the same firebase_uid.

Schema change:
  ALTER TABLE appointments
    ADD COLUMN firebase_uid VARCHAR(128) NULL
      REFERENCES user_profiles(firebase_uid) ON DELETE SET NULL;

Idempotent — safe to run multiple times.
Run from backend/ with the virtual environment activated:
    python migrate_appointments_firebase_uid.py
"""
import sys
from sqlalchemy import inspect, text
from app.database.connection import engine


def main() -> None:
    inspector = inspect(engine)
    existing_cols = [c["name"] for c in inspector.get_columns("appointments")]

    if "firebase_uid" in existing_cols:
        print("✓ firebase_uid column already exists in appointments — nothing to do.")
        return

    print("Adding firebase_uid column to appointments …")
    with engine.begin() as conn:
        conn.execute(text("""
            ALTER TABLE appointments
            ADD COLUMN firebase_uid VARCHAR(128)
                REFERENCES user_profiles(firebase_uid)
                ON DELETE SET NULL
        """))
    print("✓ firebase_uid column added.")

    inspector2 = inspect(engine)
    cols = [c["name"] for c in inspector2.get_columns("appointments")]
    if "firebase_uid" in cols:
        print("✓ Verified: column is present.")
    else:
        print("✗ ERROR: column was not added!", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
