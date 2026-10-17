"""
Safe additive migration — appointment ownership and integrity guards.

Why:
  1. Patients must be able to book before staff create a clinical patient
     record. appointments.patient_id becomes NULLable; a CHECK guarantees every
     appointment still has an owner (patient record and/or booking account).
  2. appointments.firebase_uid is filtered on every patient request but had no
     index (the earlier migration added the column only).
  3. Two concurrent bookings could take the same doctor slot. A partial unique
     index makes the database reject a second active appointment in a slot.
  4. user_profiles.role had no database-level constraint.

Existing data:
  - No rows are modified or deleted. Every existing appointment already has a
    patient_id, so the owner CHECK holds.
  - Before creating the unique index and role CHECK the script verifies that
    existing data satisfies them; if not, it stops without changing anything
    and lists the conflicting rows for manual review.

Everything runs in one transaction: either all changes apply or none do.
Idempotent — running it again is a no-op.

Rollback (manual, only if no unlinked bookings exist yet):
    DROP INDEX IF EXISTS uq_appointments_doctor_active_slot;
    DROP INDEX IF EXISTS ix_appointments_firebase_uid;
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS ck_appointments_owner_present;
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS ck_user_profiles_role;
    ALTER TABLE appointments ALTER COLUMN patient_id SET NOT NULL;  -- fails once
        -- appointments with patient_id IS NULL exist; those must be linked first.

Run from backend/ with the virtual environment activated:
    python migrate_appointment_ownership.py
"""
import sys

from sqlalchemy import text

from app.database.connection import engine

VALID_ROLES = ("user", "patient", "admin", "receptionist", "doctor", "pharmacist", "accountant")


def _constraint_exists(conn, name: str) -> bool:
    return bool(conn.execute(
        text("SELECT 1 FROM pg_constraint WHERE conname = :n"), {"n": name}
    ).scalar())


def _index_exists(conn, name: str) -> bool:
    return bool(conn.execute(
        text("SELECT 1 FROM pg_indexes WHERE indexname = :n"), {"n": name}
    ).scalar())


def main() -> None:
    with engine.begin() as conn:
        print(f"Database: {conn.execute(text('SELECT current_database()')).scalar()}")

        # ── Pre-flight checks (read-only) ────────────────────────────────────
        duplicates = conn.execute(text("""
            SELECT doctor_id, appointment_date, appointment_time,
                   array_agg(appointment_id ORDER BY appointment_id) AS ids
            FROM appointments
            WHERE status IN ('scheduled', 'confirmed')
            GROUP BY doctor_id, appointment_date, appointment_time
            HAVING count(*) > 1
        """)).all()
        bad_roles = conn.execute(
            text("SELECT firebase_uid, role FROM user_profiles WHERE role <> ALL(:roles)"),
            {"roles": list(VALID_ROLES)},
        ).all()
        if duplicates or bad_roles:
            for row in duplicates:
                print(f"✗ Double-booked slot: doctor {row.doctor_id} "
                      f"{row.appointment_date} {row.appointment_time} → appointments {row.ids}")
            for row in bad_roles:
                print(f"✗ Unknown role {row.role!r} on profile {row.firebase_uid[:8]}…")
            print("Resolve the rows above, then run this script again. Nothing was changed.",
                  file=sys.stderr)
            sys.exit(1)

        # ── 1. Allow bookings owned only by a patient account ────────────────
        nullable = conn.execute(text("""
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'appointments' AND column_name = 'patient_id'
        """)).scalar()
        if nullable == "NO":
            conn.execute(text("ALTER TABLE appointments ALTER COLUMN patient_id DROP NOT NULL"))
            print("✓ appointments.patient_id is now nullable.")
        else:
            print("· appointments.patient_id already nullable.")

        if not _constraint_exists(conn, "ck_appointments_owner_present"):
            conn.execute(text("""
                ALTER TABLE appointments
                ADD CONSTRAINT ck_appointments_owner_present
                CHECK (patient_id IS NOT NULL OR firebase_uid IS NOT NULL)
            """))
            print("✓ Added ck_appointments_owner_present.")
        else:
            print("· ck_appointments_owner_present already exists.")

        # ── 2. Index the booking-owner column ────────────────────────────────
        if not _index_exists(conn, "ix_appointments_firebase_uid"):
            conn.execute(text(
                "CREATE INDEX ix_appointments_firebase_uid ON appointments (firebase_uid)"
            ))
            print("✓ Added ix_appointments_firebase_uid.")
        else:
            print("· ix_appointments_firebase_uid already exists.")

        # ── 3. One active appointment per doctor slot ────────────────────────
        if not _index_exists(conn, "uq_appointments_doctor_active_slot"):
            conn.execute(text("""
                CREATE UNIQUE INDEX uq_appointments_doctor_active_slot
                ON appointments (doctor_id, appointment_date, appointment_time)
                WHERE status IN ('scheduled', 'confirmed')
            """))
            print("✓ Added uq_appointments_doctor_active_slot.")
        else:
            print("· uq_appointments_doctor_active_slot already exists.")

        # ── 4. Valid roles only ──────────────────────────────────────────────
        if not _constraint_exists(conn, "ck_user_profiles_role"):
            conn.execute(text("""
                ALTER TABLE user_profiles
                ADD CONSTRAINT ck_user_profiles_role
                CHECK (role IN ('user', 'patient', 'admin', 'receptionist',
                                'doctor', 'pharmacist', 'accountant'))
            """))
            print("✓ Added ck_user_profiles_role.")
        else:
            print("· ck_user_profiles_role already exists.")

    print("Migration complete.")


if __name__ == "__main__":
    main()
