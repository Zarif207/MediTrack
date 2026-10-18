"""
Safe additive migration — adds a nullable patient_id FK column to user_profiles.

This column creates the trusted server-side mapping:
    Firebase UID  →  UserProfile.patient_id  →  patients.patient_id

Design choices:
- Nullable so existing user_profiles rows are unaffected.
- FK to patients with ON DELETE SET NULL so deleting a patient does not
  cascade-delete the Firebase auth account.
- Only admins can set this column (via PATCH /auth/users/{uid}/link-patient).
  A patient-role user cannot self-assign a patient_id.

Run once from backend/ with the virtual environment activated:
    python -m migrations.add_patient_link

Idempotent — running it multiple times is safe.
"""
import sys

from sqlalchemy import inspect, text
from app.database.connection import engine


def main() -> None:
    inspector = inspect(engine)
    existing_cols = [c["name"] for c in inspector.get_columns("user_profiles")]

    if "patient_id" in existing_cols:
        print("✓ patient_id column already exists in user_profiles — nothing to do.")
        return

    print("Adding patient_id column to user_profiles …")
    with engine.begin() as conn:
        conn.execute(text("""
            ALTER TABLE user_profiles
            ADD COLUMN patient_id BIGINT
                REFERENCES patients(patient_id)
                ON DELETE SET NULL
        """))
    print("✓ patient_id column added.")

    # Verify
    inspector2 = inspect(engine)
    new_cols = [c["name"] for c in inspector2.get_columns("user_profiles")]
    if "patient_id" in new_cols:
        print("✓ Verified: column is present.")
    else:
        print("✗ ERROR: column was not added!", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
