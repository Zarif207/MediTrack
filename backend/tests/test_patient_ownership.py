"""
Patient ownership tests — run against a live PostgreSQL database.

Tests verify:
  1. Unlinked patient-role account gets 403 (never all records).
  2. Linked patient sees only their own records.
  3. Patient A cannot access Patient B's records by guessing IDs.
  4. Bills, appointments, medical records, prescriptions, prescription items
     all respect ownership.
  5. Staff roles (admin) still see everything.
  6. Public endpoints (departments, doctors) remain open.

Strategy:
  - We use FastAPI's TestClient with dependency overrides to inject
    known UserProfile objects without needing a real Firebase token.
  - We create minimal test data in the database and clean it up afterwards.
  - No existing data is touched.
"""
import pytest
from datetime import date, time, datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.auth.dependencies import get_current_user, get_patient_id_for_user
from app.database.connection import engine
from app.models.user_profile import UserProfile
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.department import Department
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.prescription import Prescription
from app.models.prescription_item import PrescriptionItem
from app.models.bill import Bill
from app.models.medicine import Medicine


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db():
    with Session(engine) as session:
        yield session


@pytest.fixture(scope="module")
def test_data(db: Session):
    """
    Create isolated test data and clean it up after all tests in the module.
    Prefix names with 'PYTEST_' so they are easy to identify.
    """
    now = datetime.now()

    # Department
    dept = Department(department_name="PYTEST_Dept", description="Test dept")
    db.add(dept)
    db.flush()

    # Doctor
    doctor = Doctor(
        department_id=dept.department_id,
        first_name="PYTEST", last_name="Doctor",
        specialization="Testing",
        phone="0000000001",
        email="pytest.doctor@test.invalid",
        license_number="PYTEST-LIC-001",
    )
    db.add(doctor)
    db.flush()

    # Patient A
    patient_a = Patient(
        first_name="PYTEST", last_name="PatientA",
        date_of_birth=date(1990, 1, 1),
        gender="Other", phone="0000000002",
        email="pytest.patient.a@test.invalid",
        registered_at=now,
    )
    # Patient B
    patient_b = Patient(
        first_name="PYTEST", last_name="PatientB",
        date_of_birth=date(1991, 1, 1),
        gender="Other", phone="0000000003",
        email="pytest.patient.b@test.invalid",
        registered_at=now,
    )
    db.add_all([patient_a, patient_b])
    db.flush()

    # Appointment for Patient A
    appt_a = Appointment(
        patient_id=patient_a.patient_id,
        doctor_id=doctor.doctor_id,
        appointment_date=date(2025, 6, 1),
        appointment_time=time(10, 0),
        status="scheduled",
        created_at=now,
    )
    # Appointment for Patient B
    appt_b = Appointment(
        patient_id=patient_b.patient_id,
        doctor_id=doctor.doctor_id,
        appointment_date=date(2025, 6, 2),
        appointment_time=time(11, 0),
        status="scheduled",
        created_at=now,
    )
    db.add_all([appt_a, appt_b])
    db.flush()

    # Medical record for Patient A's appointment
    record_a = MedicalRecord(
        appointment_id=appt_a.appointment_id,
        diagnosis="Test diagnosis A",
        record_date=now,
    )
    # Medical record for Patient B's appointment
    record_b = MedicalRecord(
        appointment_id=appt_b.appointment_id,
        diagnosis="Test diagnosis B",
        record_date=now,
    )
    db.add_all([record_a, record_b])
    db.flush()

    # Prescription for Patient A
    presc_a = Prescription(record_id=record_a.record_id, prescription_date=now)
    # Prescription for Patient B
    presc_b = Prescription(record_id=record_b.record_id, prescription_date=now)
    db.add_all([presc_a, presc_b])
    db.flush()

    # Medicine
    med = Medicine(
        medicine_name="PYTEST_Med",
        generic_name="PYTEST_Generic",
        dosage_form="Tablet",
        strength="100mg",
        manufacturer="PYTEST_Manufacturer",
        unit_price="10.00",
        stock_quantity=100,
    )
    db.add(med)
    db.flush()

    # Prescription items for each patient
    item_a = PrescriptionItem(
        prescription_id=presc_a.prescription_id,
        medicine_id=med.medicine_id,
        dosage="1 tablet", frequency="Once daily", duration="7 days", quantity=7,
    )
    item_b = PrescriptionItem(
        prescription_id=presc_b.prescription_id,
        medicine_id=med.medicine_id,
        dosage="2 tablets", frequency="Twice daily", duration="5 days", quantity=10,
    )
    db.add_all([item_a, item_b])
    db.flush()

    # Bills for each patient
    bill_a = Bill(
        patient_id=patient_a.patient_id,
        appointment_id=appt_a.appointment_id,
        amount="50.00",
        payment_status="pending",
        issued_at=now,
    )
    bill_b = Bill(
        patient_id=patient_b.patient_id,
        appointment_id=appt_b.appointment_id,
        amount="75.00",
        payment_status="pending",
        issued_at=now,
    )
    db.add_all([bill_a, bill_b])
    db.commit()

    # UserProfiles for the test patients
    profile_a = UserProfile(
        firebase_uid="PYTEST_UID_A",
        role="patient",
        patient_id=patient_a.patient_id,
        email=patient_a.email,
        created_at=now,
    )
    profile_b = UserProfile(
        firebase_uid="PYTEST_UID_B",
        role="patient",
        patient_id=patient_b.patient_id,
        email=patient_b.email,
        created_at=now,
    )
    profile_unlinked = UserProfile(
        firebase_uid="PYTEST_UID_UNLINKED",
        role="patient",
        patient_id=None,
        email="pytest.unlinked@test.invalid",
        created_at=now,
    )
    profile_admin = UserProfile(
        firebase_uid="PYTEST_UID_ADMIN",
        role="admin",
        patient_id=None,
        email="pytest.admin@test.invalid",
        created_at=now,
    )
    db.add_all([profile_a, profile_b, profile_unlinked, profile_admin])
    db.commit()

    data = {
        "patient_a": patient_a, "patient_b": patient_b,
        "appt_a": appt_a, "appt_b": appt_b,
        "record_a": record_a, "record_b": record_b,
        "presc_a": presc_a, "presc_b": presc_b,
        "item_a": item_a, "item_b": item_b,
        "bill_a": bill_a, "bill_b": bill_b,
        "profile_a": profile_a, "profile_b": profile_b,
        "profile_unlinked": profile_unlinked, "profile_admin": profile_admin,
        "doctor": doctor, "dept": dept, "med": med,
    }

    yield data

    # ── Cleanup: remove test data in FK-safe order ────────────────────────────
    for obj in [item_a, item_b, bill_a, bill_b, presc_a, presc_b,
                record_a, record_b, appt_a, appt_b,
                profile_a, profile_b, profile_unlinked, profile_admin,
                patient_a, patient_b, med, doctor, dept]:
        db.delete(obj)
    db.commit()


def make_client_as(profile: UserProfile) -> TestClient:
    """
    Create a TestClient with dependency overrides that inject the given profile.
    This bypasses Firebase token verification entirely.
    """
    client = TestClient(app, raise_server_exceptions=False)

    async def fake_user():
        return profile

    async def fake_patient_id():
        if profile.role == "patient":
            if profile.patient_id is None:
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account is not yet linked to a patient record.",
                )
            return profile.patient_id
        return None

    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_patient_id_for_user] = fake_patient_id
    return client


def reset_overrides():
    app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────────────────────

class TestPublicEndpoints:
    """Public endpoints must work with no auth."""

    def test_departments_open(self):
        client = TestClient(app, raise_server_exceptions=False)
        r = client.get("/departments/")
        assert r.status_code == 200, r.text

    def test_doctors_open(self):
        client = TestClient(app, raise_server_exceptions=False)
        r = client.get("/doctors/")
        assert r.status_code == 200, r.text

    def test_patients_requires_auth(self):
        client = TestClient(app, raise_server_exceptions=False)
        r = client.get("/patients/")
        assert r.status_code == 401, r.text


class TestUnlinkedPatient:
    """Unlinked patient-role account must get 403, not all records."""

    def test_list_patients_unlinked(self, test_data):
        client = make_client_as(test_data["profile_unlinked"])
        r = client.get("/patients/")
        reset_overrides()
        assert r.status_code == 403, r.text
        assert "linked" in r.json()["detail"].lower()

    def test_list_appointments_unlinked(self, test_data):
        client = make_client_as(test_data["profile_unlinked"])
        r = client.get("/appointments/")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_list_bills_unlinked(self, test_data):
        client = make_client_as(test_data["profile_unlinked"])
        r = client.get("/bills/")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_list_medical_records_unlinked(self, test_data):
        client = make_client_as(test_data["profile_unlinked"])
        r = client.get("/medical-records/")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_list_prescriptions_unlinked(self, test_data):
        client = make_client_as(test_data["profile_unlinked"])
        r = client.get("/prescriptions/")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_list_prescription_items_unlinked(self, test_data):
        client = make_client_as(test_data["profile_unlinked"])
        r = client.get("/prescription-items/")
        reset_overrides()
        assert r.status_code == 403, r.text


class TestPatientAOwnsData:
    """Patient A sees only their own data."""

    def test_list_appointments_returns_only_own(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get("/appointments/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [a["appointment_id"] for a in r.json()]
        assert test_data["appt_a"].appointment_id in ids
        assert test_data["appt_b"].appointment_id not in ids

    def test_get_own_appointment(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/appointments/{test_data['appt_a'].appointment_id}")
        reset_overrides()
        assert r.status_code == 200, r.text
        assert r.json()["appointment_id"] == test_data["appt_a"].appointment_id

    def test_list_bills_returns_only_own(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get("/bills/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [b["bill_id"] for b in r.json()]
        assert test_data["bill_a"].bill_id in ids
        assert test_data["bill_b"].bill_id not in ids

    def test_get_own_bill(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/bills/{test_data['bill_a'].bill_id}")
        reset_overrides()
        assert r.status_code == 200, r.text

    def test_list_medical_records_returns_only_own(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get("/medical-records/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [rec["record_id"] for rec in r.json()]
        assert test_data["record_a"].record_id in ids
        assert test_data["record_b"].record_id not in ids

    def test_list_prescriptions_returns_only_own(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get("/prescriptions/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [p["prescription_id"] for p in r.json()]
        assert test_data["presc_a"].prescription_id in ids
        assert test_data["presc_b"].prescription_id not in ids

    def test_list_prescription_items_returns_only_own(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get("/prescription-items/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [i["prescription_item_id"] for i in r.json()]
        assert test_data["item_a"].prescription_item_id in ids
        assert test_data["item_b"].prescription_item_id not in ids

    def test_patient_sees_own_patient_record(self, test_data):
        client = make_client_as(test_data["profile_a"])
        pid = test_data["patient_a"].patient_id
        r = client.get(f"/patients/{pid}")
        reset_overrides()
        assert r.status_code == 200, r.text
        assert r.json()["patient_id"] == pid

    def test_list_patients_returns_only_own(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get("/patients/")
        reset_overrides()
        assert r.status_code == 200, r.text
        result = r.json()
        assert len(result) == 1
        assert result[0]["patient_id"] == test_data["patient_a"].patient_id


class TestPatientACannotAccessPatientBData:
    """Patient A must be blocked from all of Patient B's data."""

    def test_cannot_get_b_appointment_detail(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/appointments/{test_data['appt_b'].appointment_id}")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_cannot_get_b_bill_detail(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/bills/{test_data['bill_b'].bill_id}")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_cannot_get_b_medical_record(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/medical-records/{test_data['record_b'].record_id}")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_cannot_get_b_prescription(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/prescriptions/{test_data['presc_b'].prescription_id}")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_cannot_get_b_prescription_item(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/prescription-items/{test_data['item_b'].prescription_item_id}")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_cannot_get_b_patient_record(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/patients/{test_data['patient_b'].patient_id}")
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_patient_id_query_param_ignored_in_bill_list(self, test_data):
        """Patient A cannot pass patient_b's ID in the query string to see B's bills."""
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/bills/?patient_id={test_data['patient_b'].patient_id}")
        reset_overrides()
        assert r.status_code == 200, r.text
        # Should return A's bills, not B's
        ids = [b["bill_id"] for b in r.json()]
        assert test_data["bill_b"].bill_id not in ids
        assert test_data["bill_a"].bill_id in ids

    def test_patient_id_query_param_ignored_in_appt_list(self, test_data):
        """Patient A cannot pass patient_b's ID in the query string."""
        client = make_client_as(test_data["profile_a"])
        r = client.get(f"/appointments/?patient_id={test_data['patient_b'].patient_id}")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [a["appointment_id"] for a in r.json()]
        assert test_data["appt_b"].appointment_id not in ids


class TestAdminSeesEverything:
    """Admin must still access all records."""

    def test_admin_list_all_patients(self, test_data):
        client = make_client_as(test_data["profile_admin"])
        r = client.get("/patients/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [p["patient_id"] for p in r.json()]
        assert test_data["patient_a"].patient_id in ids
        assert test_data["patient_b"].patient_id in ids

    def test_admin_list_all_appointments(self, test_data):
        client = make_client_as(test_data["profile_admin"])
        r = client.get("/appointments/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [a["appointment_id"] for a in r.json()]
        assert test_data["appt_a"].appointment_id in ids
        assert test_data["appt_b"].appointment_id in ids

    def test_admin_get_b_appointment(self, test_data):
        client = make_client_as(test_data["profile_admin"])
        r = client.get(f"/appointments/{test_data['appt_b'].appointment_id}")
        reset_overrides()
        assert r.status_code == 200, r.text

    def test_admin_list_all_bills(self, test_data):
        client = make_client_as(test_data["profile_admin"])
        r = client.get("/bills/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [b["bill_id"] for b in r.json()]
        assert test_data["bill_a"].bill_id in ids
        assert test_data["bill_b"].bill_id in ids

    def test_admin_list_all_medical_records(self, test_data):
        client = make_client_as(test_data["profile_admin"])
        r = client.get("/medical-records/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [rec["record_id"] for rec in r.json()]
        assert test_data["record_a"].record_id in ids
        assert test_data["record_b"].record_id in ids

    def test_admin_list_all_prescriptions(self, test_data):
        client = make_client_as(test_data["profile_admin"])
        r = client.get("/prescriptions/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [p["prescription_id"] for p in r.json()]
        assert test_data["presc_a"].prescription_id in ids
        assert test_data["presc_b"].prescription_id in ids

    def test_admin_list_all_prescription_items(self, test_data):
        client = make_client_as(test_data["profile_admin"])
        r = client.get("/prescription-items/")
        reset_overrides()
        assert r.status_code == 200, r.text
        ids = [i["prescription_item_id"] for i in r.json()]
        assert test_data["item_a"].prescription_item_id in ids
        assert test_data["item_b"].prescription_item_id in ids


class TestPatientReadOnly:
    """Patients cannot create, update, or delete records."""

    def test_patient_cannot_create_appointment(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.post("/appointments/", json={
            "patient_id": test_data["patient_a"].patient_id,
            "doctor_id": test_data["doctor"].doctor_id,
            "appointment_date": "2025-07-01",
            "appointment_time": "10:00:00",
        })
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_patient_cannot_create_bill(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.post("/bills/", json={
            "patient_id": test_data["patient_a"].patient_id,
            "appointment_id": test_data["appt_a"].appointment_id,
            "amount": "10.00",
        })
        reset_overrides()
        assert r.status_code == 403, r.text

    def test_patient_cannot_update_bill(self, test_data):
        client = make_client_as(test_data["profile_a"])
        r = client.patch(f"/bills/{test_data['bill_a'].bill_id}", json={"amount": "999.00"})
        reset_overrides()
        assert r.status_code == 403, r.text
