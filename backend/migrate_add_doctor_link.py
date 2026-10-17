"""
Safe additive migration — links doctor-role accounts to doctor records.

Adds user_profiles.doctor_id (nullable, unique, FK → doctors.doctor_id,
ON DELETE SET NULL). A doctor-role account can access only the appointments and
clinical records of the doctor it is linked to; without a link it can access
none. Links are set by an administrator (PATCH /auth/users/{uid}/link-doctor
or Users & roles in the app). Nothing is linked automatically.

Existing data: no rows are modified. Existing doctor-role accounts start
unlinked and therefore lose clinical access until an administrator links them.

Idempotent — running it again is a no-op. Single transaction.

Rollback (manual):
    ALTER TABLE user_profiles DROP COLUMN IF EXISTS doctor_id;

Run from backend/ with the virtual environment activated:
    python migrate_add_doctor_link.py
"""
from sqlalchemy import inspect, text

from app.database.connection import engine


def main() -> None:
    with engine.begin() as conn:
        print(f"Database: {conn.execute(text('SELECT current_database()')).scalar()}")
        cols = [c["name"] for c in inspect(conn).get_columns("user_profiles")]
        if "doctor_id" in cols:
            print("· user_profiles.doctor_id already exists.")
        else:
            conn.execute(text("""
                ALTER TABLE user_profiles
                ADD COLUMN doctor_id BIGINT
                    REFERENCES doctors(doctor_id) ON DELETE SET NULL
            """))
            conn.execute(text(
                "ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_doctor_id_key UNIQUE (doctor_id)"
            ))
            print("✓ Added user_profiles.doctor_id (unique, FK → doctors).")
        unlinked = conn.execute(text(
            "SELECT count(*) FROM user_profiles WHERE role = 'doctor' AND doctor_id IS NULL"
        )).scalar()
        print(f"Doctor-role accounts without a doctor link: {unlinked}")
    print("Migration complete.")


if __name__ == "__main__":
    main()
