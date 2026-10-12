"""
Session-scoped pre-test cleanup.
Removes test data left over from previous interrupted runs so unique
constraints do not block fixture setup.
"""
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.connection import engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def cleanup_leftover_test_data():
    """
    Runs once before all tests in the session.
    Removes any data created by previous test runs that were not cleaned up
    (e.g. because the process was killed mid-test).
    Preserves real application data.
    """
    with Session(engine) as db:
        # Clear dependency overrides from any previous failed run
        app.dependency_overrides.clear()

        stmts = [
            # Break FK from user_profiles → patients for test accounts
            "UPDATE user_profiles SET patient_id = NULL WHERE "
            "  firebase_uid LIKE 'PYTEST_%' OR firebase_uid LIKE 'SYS_%' "
            "  OR firebase_uid LIKE 'DIRECT_%' OR firebase_uid LIKE 'LIVE_%' "
            "  OR firebase_uid LIKE 'SYS_BOOK%'",

            # Prescription items → prescriptions → medical_records → appointments (test doctors)
            "DELETE FROM prescription_items WHERE prescription_id IN ("
            "  SELECT prescription_id FROM prescriptions WHERE record_id IN ("
            "    SELECT record_id FROM medical_records WHERE appointment_id IN ("
            "      SELECT appointment_id FROM appointments WHERE "
            "        doctor_id IN (SELECT doctor_id FROM doctors WHERE email LIKE '%@example.com' AND license_number LIKE 'PYTEST-%') "
            "        OR doctor_id IN (SELECT doctor_id FROM doctors WHERE email LIKE '%@example.com' AND license_number LIKE 'SYS-%') "
            "        OR firebase_uid LIKE 'PYTEST_%' OR firebase_uid LIKE 'SYS_%')))",

            "DELETE FROM prescriptions WHERE record_id IN ("
            "  SELECT record_id FROM medical_records WHERE appointment_id IN ("
            "    SELECT appointment_id FROM appointments WHERE "
            "      doctor_id IN (SELECT doctor_id FROM doctors WHERE license_number LIKE 'PYTEST-%' OR license_number LIKE 'SYS-%')))",

            "DELETE FROM medical_records WHERE appointment_id IN ("
            "  SELECT appointment_id FROM appointments WHERE "
            "    doctor_id IN (SELECT doctor_id FROM doctors WHERE license_number LIKE 'PYTEST-%' OR license_number LIKE 'SYS-%'))",

            # Bills → appointments (test doctors + test firebase_uids)
            "DELETE FROM bills WHERE appointment_id IN ("
            "  SELECT appointment_id FROM appointments WHERE "
            "    doctor_id IN (SELECT doctor_id FROM doctors WHERE license_number LIKE 'PYTEST-%' OR license_number LIKE 'SYS-%') "
            "    OR firebase_uid LIKE 'PYTEST_%' OR firebase_uid LIKE 'SYS_%' OR firebase_uid LIKE 'SYS_BOOK%')",

            # Bills → test patients
            "DELETE FROM bills WHERE patient_id IN ("
            "  SELECT patient_id FROM patients WHERE email LIKE '%@test.invalid')",

            # Appointments → test doctors
            "DELETE FROM appointments WHERE "
            "  doctor_id IN (SELECT doctor_id FROM doctors WHERE license_number LIKE 'PYTEST-%' OR license_number LIKE 'SYS-%') "
            "  OR firebase_uid LIKE 'PYTEST_%' OR firebase_uid LIKE 'SYS_%' OR firebase_uid LIKE 'SYS_BOOK%'",

            # Appointments → test patients
            "DELETE FROM appointments WHERE patient_id IN ("
            "  SELECT patient_id FROM patients WHERE email LIKE '%@test.invalid')",

            # Test patients
            "UPDATE user_profiles SET patient_id = NULL WHERE patient_id IN ("
            "  SELECT patient_id FROM patients WHERE email LIKE '%@test.invalid')",
            "DELETE FROM patients WHERE email LIKE '%@test.invalid'",

            # Test doctors (only those with PYTEST/SYS license numbers)
            "DELETE FROM doctors WHERE license_number LIKE 'PYTEST-%' OR license_number LIKE 'SYS-%'",

            # Test departments
            "DELETE FROM departments WHERE department_name LIKE 'PYTEST_%' OR department_name LIKE 'SYS_%'",

            # Test user profiles
            "DELETE FROM user_profiles WHERE "
            "  firebase_uid LIKE 'PYTEST_%' OR firebase_uid LIKE 'SYS_%' "
            "  OR firebase_uid LIKE 'DIRECT_%' OR firebase_uid LIKE 'LIVE_%' "
            "  OR firebase_uid LIKE 'SYS_BOOK%'",
        ]

        for stmt in stmts:
            try:
                db.execute(text(stmt))
                db.commit()
            except Exception:
                db.rollback()

    yield  # tests run here

    # Post-session: clear overrides one more time
    app.dependency_overrides.clear()
