"""
Patient ownership + onboarding tests — run against the live PostgreSQL database.

Tests verify:
  1. Unlinked patient-role account gets 403 on health-data endpoints (never all records).
  2. Unlinked patient-role account gets a useful error (not a crash) on the dashboard endpoints.
  3. Linked patient sees only their own records.
  4. Patient A cannot access Patient B's records by guessing IDs.
  5. Bills, appointments, medical records, prescriptions, prescription items respect ownership.
  6. Staff roles (admin) still see everything.
  7. Public endpoints (departments, doctors) remain open.
  8. Patient self-booking (POST /appointments/book) works for linked patients.
  9. Patient self-booking is blocked for unlinked patients with a clear 403.
  10. Patient cannot POST to staff-only appointment creation endpoint.
  11. Profile sync: display_name and email are updated on GET /auth/me.
  12. Admin can link and unlink patient records.
  13. Duplicate patient links are prevented.
"""
import pytest
from datetime import date, time, datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.auth.dependencies import get_current_user, get_patient_id_for_user, get_optional_patient_id
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
    """Create isolated test data; clean up after all tests in this module."""
    import time as time_mod
    now = datetime.now()
    suffix = str(int(time_mod.time()))[-6:]

    dept = Department(department_name=f"PYTEST_Dept_{suffix}", description="Test dept")
    db.add(dept); db.flush()

    doctor = Doctor(
        department_id=dept.department_id,
        first_name="PYTEST", last_name=f"Doc{suffix}",
        specialization="Testing",
        phone=f"000{suffix}1",
        email=f"pytest.doc.{suffix}@example.com",
        license_number=f"PYTEST-{suffix}",
    )
    db.add(doctor); db.flush()

    patient_a = Patient(
        first_name="PYTEST", last_name="PatientA",
        date_of_birth=date(1990, 1, 1), gender="Other",
        phone=f"000{suffix}2", email=f"pytest.pta.{suffix}@test.invalid",
        registered_at=now,
    )
    patient_b = Patient(
        first_name="PYTEST", last_name="PatientB",
        date_of_birth=date(1991, 1, 1), gender="Other",
        phone=f"000{suffix}3", email=f"pytest.ptb.{suffix}@test.invalid",
        registered_at=now,
    )
    db.add_all([patient_a, patient_b]); db.flush()

    appt_a = Appointment(
        patient_id=patient_a.patient_id, doctor_id=doctor.doctor_id,
        appointment_date=date(2025, 6, 1), appointment_time=time(10, 0),
        status="scheduled", created_at=now,
    )
    appt_b = Appointment(
        patient_id=patient_b.patient_id, doctor_id=doctor.doctor_id,
        appointment_date=date(2025, 6, 2), appointment_time=time(11, 0),
        status="scheduled", created_at=now,
    )
    db.add_all([appt_a, appt_b]); db.flush()

    record_a = MedicalRecord(appointment_id=appt_a.appointment_id, diagnosis="Test A", record_date=now)
    record_b = MedicalRecord(appointment_id=appt_b.appointment_id, diagnosis="Test B", record_date=now)
    db.add_all([record_a, record_b]); db.flush()

    presc_a = Prescription(record_id=record_a.record_id, prescription_date=now)
    presc_b = Prescription(record_id=record_b.record_id, prescription_date=now)
    db.add_all([presc_a, presc_b]); db.flush()

    med = Medicine(
        medicine_name="PYTEST_Med", generic_name="PYTEST_Gen",
        dosage_form="Tablet", strength="100mg",
        manufacturer="PYTEST_Co", unit_price="10.00", stock_quantity=100,
    )
    db.add(med); db.flush()

    item_a = PrescriptionItem(
        prescription_id=presc_a.prescription_id, medicine_id=med.medicine_id,
        dosage="1 tablet", frequency="Once daily", duration="7 days", quantity=7,
    )
    item_b = PrescriptionItem(
        prescription_id=presc_b.prescription_id, medicine_id=med.medicine_id,
        dosage="2 tablets", frequency="Twice daily", duration="5 days", quantity=10,
    )
    db.add_all([item_a, item_b]); db.flush()

    bill_a = Bill(
        patient_id=patient_a.patient_id, appointment_id=appt_a.appointment_id,
        amount="50.00", payment_status="pending", issued_at=now,
    )
    bill_b = Bill(
        patient_id=patient_b.patient_id, appointment_id=appt_b.appointment_id,
        amount="75.00", payment_status="pending", issued_at=now,
    )
    db.add_all([bill_a, bill_b]); db.commit()

    # A linked appointment-free appointment for booking test
    appt_bookable = Appointment(
        patient_id=patient_a.patient_id, doctor_id=doctor.doctor_id,
        appointment_date=date(2025, 7, 1), appointment_time=time(9, 0),
        status="scheduled", created_at=now,
    )
    db.add(appt_bookable); db.commit()

    profile_a = UserProfile(firebase_uid=f"PYTEST_UID_A_{suffix}", role="patient", patient_id=patient_a.patient_id, email=patient_a.email, created_at=now)
    profile_b = UserProfile(firebase_uid=f"PYTEST_UID_B_{suffix}", role="patient", patient_id=patient_b.patient_id, email=patient_b.email, created_at=now)
    profile_unlinked = UserProfile(firebase_uid=f"PYTEST_UID_UNLINKED_{suffix}", role="patient", patient_id=None, email=f"pytest.unlinked.{suffix}@test.invalid", created_at=now)
    profile_admin = UserProfile(firebase_uid=f"PYTEST_UID_ADMIN_{suffix}", role="admin", patient_id=None, email=f"pytest.admin.{suffix}@test.invalid", display_name="Admin User", created_at=now)
    db.add_all([profile_a, profile_b, profile_unlinked, profile_admin]); db.commit()

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
        "appt_bookable": appt_bookable,
    }
    yield data

    # Cleanup in FK-safe order
    # First reset any patient links to avoid FK conflicts
    for obj in [profile_a, profile_b, profile_unlinked, profile_admin]:
        try:
            db.refresh(obj)
            obj.patient_id = None
        except Exception:
            pass
    try:
        db.commit()
    except Exception:
        db.rollback()

    # Remove created prescription/bill data first
    for obj in [item_a, item_b, bill_a, bill_b, presc_a, presc_b, record_a, record_b]:
        try: db.delete(obj)
        except Exception: pass
    try: db.commit()
    except Exception: db.rollback()

    # Remove extra appointments created during booking tests
    extra_appts = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.doctor_id,
        Appointment.appointment_id.notin_([appt_a.appointment_id, appt_b.appointment_id, appt_bookable.appointment_id]),
    ).all()
    for a in extra_appts:
        try: db.delete(a)
        except Exception: pass
    try: db.commit()
    except Exception: db.rollback()

    for obj in [appt_a, appt_b, appt_bookable,
                profile_a, profile_b, profile_unlinked, profile_admin,
                patient_a, patient_b, med, doctor, dept]:
        try: db.delete(obj)
        except Exception: pass
    try: db.commit()
    except Exception: db.rollback()

    # Clean any auto-created patients from unlinked booking tests
    from sqlalchemy import text
    db.execute(text(f"DELETE FROM appointments WHERE firebase_uid LIKE '%PYTEST_UID_UNLINKED%'"))
    db.execute(text(f"DELETE FROM patients WHERE email LIKE '%pytest.unlinked%' OR email LIKE '%pytest.pta%' OR email LIKE '%pytest.ptb%'"))
    db.execute(text(f"DELETE FROM doctors WHERE email LIKE '%.{suffix}@example.com'"))
    db.execute(text(f"DELETE FROM departments WHERE department_name LIKE 'PYTEST_Dept_{suffix}%'"))
    db.execute(text(f"DELETE FROM user_profiles WHERE firebase_uid LIKE '%{suffix}%'"))
    try: db.commit()
    except Exception: db.rollback()


def make_client(profile: UserProfile) -> TestClient:
    """TestClient with dependency overrides for the given profile."""
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

    async def fake_optional_patient_id():
        if profile.role == "patient":
            return profile.patient_id  # None for unlinked
        return None

    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_patient_id_for_user] = fake_patient_id
    app.dependency_overrides[get_optional_patient_id] = fake_optional_patient_id
    return client


def reset():
    app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Public endpoints
# ──────────────────────────────────────────────────────────────────────────────

class TestPublicEndpoints:
    def test_departments_open(self):
        r = TestClient(app, raise_server_exceptions=False).get("/departments/")
        assert r.status_code == 200, r.text

    def test_doctors_open(self):
        r = TestClient(app, raise_server_exceptions=False).get("/doctors/")
        assert r.status_code == 200, r.text

    def test_register_open(self):
        """POST /auth/register is public — should not require a token."""
        r = TestClient(app, raise_server_exceptions=False).post(
            "/auth/register",
            json={"firebase_uid": "PYTEST_REG_TEST", "display_name": "Test", "email": "t@t.com"},
        )
        # 201 created or 422 if UID has unique constraint issue — just not 401/403/500
        assert r.status_code in (201, 200), r.text

    def test_patients_requires_auth(self):
        r = TestClient(app, raise_server_exceptions=False).get("/patients/")
        assert r.status_code == 401, r.text

    def test_appointments_requires_auth(self):
        r = TestClient(app, raise_server_exceptions=False).get("/appointments/")
        assert r.status_code == 401, r.text


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Unlinked patient
# ──────────────────────────────────────────────────────────────────────────────

class TestUnlinkedPatient:
    """Unlinked patient-role: health-data endpoints return 403 with a clear message."""

    def test_list_patients_unlinked(self, test_data):
        r = make_client(test_data["profile_unlinked"]).get("/patients/")
        reset()
        assert r.status_code == 403
        assert "linked" in r.json()["detail"].lower()

    def test_list_appointments_unlinked(self, test_data):
        """Unlinked patient gets 200 with empty list (not 403) since they can view own bookings."""
        r = make_client(test_data["profile_unlinked"]).get("/appointments/")
        reset()
        # New behavior: unlinked patient gets empty list (no appointments yet)
        # rather than 403, because the route filters by firebase_uid
        assert r.status_code == 200
        assert r.json() == []

    def test_list_bills_unlinked(self, test_data):
        r = make_client(test_data["profile_unlinked"]).get("/bills/")
        reset()
        assert r.status_code == 403

    def test_list_medical_records_unlinked(self, test_data):
        r = make_client(test_data["profile_unlinked"]).get("/medical-records/")
        reset()
        assert r.status_code == 403

    def test_list_prescriptions_unlinked(self, test_data):
        r = make_client(test_data["profile_unlinked"]).get("/prescriptions/")
        reset()
        assert r.status_code == 403

    def test_list_prescription_items_unlinked(self, test_data):
        r = make_client(test_data["profile_unlinked"]).get("/prescription-items/")
        reset()
        assert r.status_code == 403

    def test_book_appointment_unlinked_patient_auto_creates_record(self, test_data, db):
        """Unlinked patient can now book — a minimal patient record is auto-created."""
        r = make_client(test_data["profile_unlinked"]).post(
            "/appointments/book",
            json={"doctor_id": test_data["doctor"].doctor_id,
                  "appointment_date": "2026-01-15", "appointment_time": "10:00"},
        )
        reset()
        # New behavior: auto-creates a patient record and books
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["patient_id"] is not None
        assert body["firebase_uid"] == test_data["profile_unlinked"].firebase_uid
        # Clean up the created appointment
        a = db.get(Appointment, body["appointment_id"])
        if a: db.delete(a)
        # Clean up auto-created patient
        db.refresh(test_data["profile_unlinked"])
        created_pid = test_data["profile_unlinked"].patient_id
        test_data["profile_unlinked"].patient_id = None
        db.commit()
        if created_pid:
            pt = db.get(Patient, created_pid)
            if pt: db.delete(pt)
        db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Patient A owns only their data
# ──────────────────────────────────────────────────────────────────────────────

class TestPatientAOwnsData:
    def test_list_appointments_own_only(self, test_data):
        r = make_client(test_data["profile_a"]).get("/appointments/")
        reset()
        assert r.status_code == 200
        ids = [a["appointment_id"] for a in r.json()]
        assert test_data["appt_a"].appointment_id in ids
        assert test_data["appt_b"].appointment_id not in ids

    def test_get_own_appointment(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/appointments/{test_data['appt_a'].appointment_id}")
        reset()
        assert r.status_code == 200

    def test_list_bills_own_only(self, test_data):
        r = make_client(test_data["profile_a"]).get("/bills/")
        reset()
        assert r.status_code == 200
        ids = [b["bill_id"] for b in r.json()]
        assert test_data["bill_a"].bill_id in ids
        assert test_data["bill_b"].bill_id not in ids

    def test_get_own_bill(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/bills/{test_data['bill_a'].bill_id}")
        reset()
        assert r.status_code == 200

    def test_list_medical_records_own_only(self, test_data):
        r = make_client(test_data["profile_a"]).get("/medical-records/")
        reset()
        assert r.status_code == 200
        ids = [rec["record_id"] for rec in r.json()]
        assert test_data["record_a"].record_id in ids
        assert test_data["record_b"].record_id not in ids

    def test_list_prescriptions_own_only(self, test_data):
        r = make_client(test_data["profile_a"]).get("/prescriptions/")
        reset()
        assert r.status_code == 200
        ids = [p["prescription_id"] for p in r.json()]
        assert test_data["presc_a"].prescription_id in ids
        assert test_data["presc_b"].prescription_id not in ids

    def test_list_prescription_items_own_only(self, test_data):
        r = make_client(test_data["profile_a"]).get("/prescription-items/")
        reset()
        assert r.status_code == 200
        ids = [i["prescription_item_id"] for i in r.json()]
        assert test_data["item_a"].prescription_item_id in ids
        assert test_data["item_b"].prescription_item_id not in ids

    def test_list_patients_returns_own_only(self, test_data):
        r = make_client(test_data["profile_a"]).get("/patients/")
        reset()
        assert r.status_code == 200
        result = r.json()
        assert len(result) == 1
        assert result[0]["patient_id"] == test_data["patient_a"].patient_id


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Cross-patient access prevention
# ──────────────────────────────────────────────────────────────────────────────

class TestCrossPatientBlocked:
    def test_cannot_get_b_appointment(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/appointments/{test_data['appt_b'].appointment_id}")
        reset()
        assert r.status_code == 403

    def test_cannot_get_b_bill(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/bills/{test_data['bill_b'].bill_id}")
        reset()
        assert r.status_code == 403

    def test_cannot_get_b_medical_record(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/medical-records/{test_data['record_b'].record_id}")
        reset()
        assert r.status_code == 403

    def test_cannot_get_b_prescription(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/prescriptions/{test_data['presc_b'].prescription_id}")
        reset()
        assert r.status_code == 403

    def test_cannot_get_b_prescription_item(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/prescription-items/{test_data['item_b'].prescription_item_id}")
        reset()
        assert r.status_code == 403

    def test_cannot_get_b_patient_record(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/patients/{test_data['patient_b'].patient_id}")
        reset()
        assert r.status_code == 403

    def test_query_param_patient_id_ignored_bills(self, test_data):
        """Patient A passes B's patient_id in query param — still sees only own bills."""
        r = make_client(test_data["profile_a"]).get(f"/bills/?patient_id={test_data['patient_b'].patient_id}")
        reset()
        assert r.status_code == 200
        ids = [b["bill_id"] for b in r.json()]
        assert test_data["bill_b"].bill_id not in ids
        assert test_data["bill_a"].bill_id in ids

    def test_query_param_patient_id_ignored_appointments(self, test_data):
        r = make_client(test_data["profile_a"]).get(f"/appointments/?patient_id={test_data['patient_b'].patient_id}")
        reset()
        assert r.status_code == 200
        ids = [a["appointment_id"] for a in r.json()]
        assert test_data["appt_b"].appointment_id not in ids


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Patient booking
# ──────────────────────────────────────────────────────────────────────────────

class TestPatientBooking:
    def test_linked_patient_can_book(self, test_data):
        """Linked patient can POST /appointments/book using trusted patient_id."""
        r = make_client(test_data["profile_a"]).post(
            "/appointments/book",
            json={
                "doctor_id": test_data["doctor"].doctor_id,
                "appointment_date": "2026-12-01",
                "appointment_time": "14:00",
                "reason": "PYTEST booking test",
            },
        )
        reset()
        assert r.status_code == 201, r.text
        body = r.json()
        # Patient_id must be the trusted value from the profile, not from request
        assert body["patient_id"] == test_data["patient_a"].patient_id
        # Clean up the booking
        from sqlalchemy.orm import Session
        with Session(engine) as db:
            appt = db.get(Appointment, body["appointment_id"])
            if appt:
                db.delete(appt)
                db.commit()

    def test_booking_uses_trusted_patient_id_not_request(self, test_data):
        """The booking endpoint does not accept patient_id in the request body."""
        # Send doctor_id + date + time; patient_id should come from profile
        r = make_client(test_data["profile_a"]).post(
            "/appointments/book",
            json={
                "doctor_id": test_data["doctor"].doctor_id,
                "appointment_date": "2026-11-05",
                "appointment_time": "09:30",
            },
        )
        reset()
        assert r.status_code == 201, r.text
        assert r.json()["patient_id"] == test_data["patient_a"].patient_id
        from sqlalchemy.orm import Session
        with Session(engine) as db:
            appt = db.get(Appointment, r.json()["appointment_id"])
            if appt: db.delete(appt); db.commit()

    def test_staff_cannot_use_book_endpoint(self, test_data):
        """Staff roles cannot use the patient booking endpoint."""
        r = make_client(test_data["profile_admin"]).post(
            "/appointments/book",
            json={"doctor_id": test_data["doctor"].doctor_id,
                  "appointment_date": "2026-12-15", "appointment_time": "10:00"},
        )
        reset()
        assert r.status_code == 403

    def test_patient_cannot_use_staff_create_endpoint(self, test_data):
        """Patient cannot use POST /appointments/ (staff-only)."""
        r = make_client(test_data["profile_a"]).post(
            "/appointments/",
            json={
                "patient_id": test_data["patient_a"].patient_id,
                "doctor_id": test_data["doctor"].doctor_id,
                "appointment_date": "2026-12-15",
                "appointment_time": "10:00:00",
            },
        )
        reset()
        assert r.status_code == 403

    def test_conflict_detection_on_booking(self, test_data, db):
        """Booking the same doctor/date/time twice raises 409."""
        # First booking
        appt = Appointment(
            patient_id=test_data["patient_a"].patient_id,
            doctor_id=test_data["doctor"].doctor_id,
            appointment_date=date(2026, 12, 20),
            appointment_time=time(15, 0),
            status="scheduled",
            created_at=datetime.now(),
        )
        db.add(appt); db.commit()

        # Try to book same slot
        r = make_client(test_data["profile_b"]).post(
            "/appointments/book",
            json={
                "doctor_id": test_data["doctor"].doctor_id,
                "appointment_date": "2026-12-20",
                "appointment_time": "15:00",
            },
        )
        reset()
        assert r.status_code == 409, r.text
        # Cleanup
        db.delete(appt); db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Admin sees everything
# ──────────────────────────────────────────────────────────────────────────────

class TestAdminAccess:
    def test_admin_sees_all_patients(self, test_data):
        r = make_client(test_data["profile_admin"]).get("/patients/")
        reset()
        assert r.status_code == 200
        ids = [p["patient_id"] for p in r.json()]
        assert test_data["patient_a"].patient_id in ids
        assert test_data["patient_b"].patient_id in ids

    def test_admin_sees_all_appointments(self, test_data):
        r = make_client(test_data["profile_admin"]).get("/appointments/")
        reset()
        assert r.status_code == 200
        ids = [a["appointment_id"] for a in r.json()]
        assert test_data["appt_a"].appointment_id in ids
        assert test_data["appt_b"].appointment_id in ids

    def test_admin_sees_all_bills(self, test_data):
        r = make_client(test_data["profile_admin"]).get("/bills/")
        reset()
        assert r.status_code == 200
        ids = [b["bill_id"] for b in r.json()]
        assert test_data["bill_a"].bill_id in ids
        assert test_data["bill_b"].bill_id in ids

    def test_admin_sees_all_medical_records(self, test_data):
        r = make_client(test_data["profile_admin"]).get("/medical-records/")
        reset()
        assert r.status_code == 200
        ids = [rec["record_id"] for rec in r.json()]
        assert test_data["record_a"].record_id in ids
        assert test_data["record_b"].record_id in ids

    def test_admin_sees_all_prescriptions(self, test_data):
        r = make_client(test_data["profile_admin"]).get("/prescriptions/")
        reset()
        assert r.status_code == 200
        ids = [p["prescription_id"] for p in r.json()]
        assert test_data["presc_a"].prescription_id in ids
        assert test_data["presc_b"].prescription_id in ids

    def test_admin_sees_all_prescription_items(self, test_data):
        r = make_client(test_data["profile_admin"]).get("/prescription-items/")
        reset()
        assert r.status_code == 200
        ids = [i["prescription_item_id"] for i in r.json()]
        assert test_data["item_a"].prescription_item_id in ids
        assert test_data["item_b"].prescription_item_id in ids


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Patient read-only restrictions
# ──────────────────────────────────────────────────────────────────────────────

class TestPatientReadOnly:
    def test_cannot_create_appointment(self, test_data):
        r = make_client(test_data["profile_a"]).post("/appointments/", json={
            "patient_id": test_data["patient_a"].patient_id,
            "doctor_id": test_data["doctor"].doctor_id,
            "appointment_date": "2027-01-01", "appointment_time": "10:00:00",
        })
        reset()
        assert r.status_code == 403

    def test_cannot_create_bill(self, test_data):
        r = make_client(test_data["profile_a"]).post("/bills/", json={
            "patient_id": test_data["patient_a"].patient_id,
            "appointment_id": test_data["appt_a"].appointment_id,
            "amount": "10.00",
        })
        reset()
        assert r.status_code == 403

    def test_cannot_update_bill(self, test_data):
        r = make_client(test_data["profile_a"]).patch(f"/bills/{test_data['bill_a'].bill_id}", json={"amount": "999.00"})
        reset()
        assert r.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Auth profile sync
# ──────────────────────────────────────────────────────────────────────────────

class TestProfileSync:
    def test_get_register_creates_profile_with_name(self, db):
        """POST /auth/register creates a profile with role='user' (new default)."""
        uid = "PYTEST_SYNC_TEST_001"
        try:
            r = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "John Sync", "email": "sync@test.invalid"},
            )
            assert r.status_code == 201, r.text
            assert r.json()["display_name"] == "John Sync"
            assert r.json()["email"] == "sync@test.invalid"
            assert r.json()["role"] == "user"   # new default is 'user', not 'patient'
        finally:
            p = db.get(UserProfile, uid)
            if p: db.delete(p); db.commit()

    def test_register_updates_existing_name(self, db):
        """Calling /auth/register again updates display_name if changed."""
        uid = "PYTEST_SYNC_TEST_002"
        try:
            # First call
            TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "Old Name", "email": "sync2@test.invalid"},
            )
            # Second call with new name
            r2 = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "New Name", "email": "sync2@test.invalid"},
            )
            assert r2.status_code == 201, r2.text
            assert r2.json()["display_name"] == "New Name"
        finally:
            p = db.get(UserProfile, uid)
            if p: db.delete(p); db.commit()

    def test_register_does_not_change_role(self, db):
        """Re-registering an existing account never changes the role."""
        uid = "PYTEST_SYNC_TEST_003"
        try:
            TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "Staff User", "email": "staff@test.invalid"},
            )
            # Manually promote to admin
            profile = db.get(UserProfile, uid)
            profile.role = "admin"; db.commit()

            # Re-register — role must not revert to 'patient'
            r2 = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "Staff User", "email": "staff@test.invalid"},
            )
            assert r2.json()["role"] == "admin", "Role was overwritten by re-registration"
        finally:
            p = db.get(UserProfile, uid)
            if p: db.delete(p); db.commit()

    def test_profile_includes_patient_id(self, test_data):
        """GET /auth/me returns patient_id in the response."""
        client = make_client(test_data["profile_a"])
        r = client.get("/auth/me")
        reset()
        assert r.status_code == 200
        assert r.json()["patient_id"] == test_data["patient_a"].patient_id

    def test_unlinked_profile_patient_id_is_null(self, test_data):
        client = make_client(test_data["profile_unlinked"])
        r = client.get("/auth/me")
        reset()
        assert r.status_code == 200
        assert r.json()["patient_id"] is None


# ──────────────────────────────────────────────────────────────────────────────
# Tests: Admin patient linking
# ──────────────────────────────────────────────────────────────────────────────

class TestPatientLinking:
    def test_admin_can_link_patient(self, test_data, db):
        """Admin can link a patient record to a user profile."""
        uid = "PYTEST_LINK_TEST_001"
        now = datetime.now()
        # Create a fresh patient that isn't linked to anyone
        fresh_patient = Patient(
            first_name="PYTEST", last_name="LinkTest",
            date_of_birth=date(1990, 1, 1), gender="Other",
            phone="9888888888", registered_at=now,
        )
        db.add(fresh_patient); db.flush()
        profile = UserProfile(firebase_uid=uid, role="patient", patient_id=None, email="link@test.invalid", created_at=now)
        db.add(profile); db.commit()

        try:
            client = make_client(test_data["profile_admin"])
            r = client.patch(f"/auth/users/{uid}/link-patient", json={"patient_id": fresh_patient.patient_id})
            reset()
            assert r.status_code == 200, r.text
            assert r.json()["patient_id"] == fresh_patient.patient_id
        finally:
            db.delete(profile); db.delete(fresh_patient); db.commit()

    def test_duplicate_link_rejected(self, test_data, db):
        """Two profiles cannot be linked to the same patient_id."""
        uid_x = "PYTEST_DUP_LINK_001"
        uid_y = "PYTEST_DUP_LINK_002"
        now = datetime.now()
        # Create a fresh patient for this test
        pt = Patient(first_name="PYTEST", last_name="DupLink", date_of_birth=date(1990,1,1), gender="Other", phone="9999999", registered_at=now)
        db.add(pt); db.flush()
        px = UserProfile(firebase_uid=uid_x, role="patient", patient_id=pt.patient_id, email="x@test.invalid", created_at=now)
        py = UserProfile(firebase_uid=uid_y, role="patient", patient_id=None, email="y@test.invalid", created_at=now)
        db.add_all([px, py]); db.commit()

        try:
            client = make_client(test_data["profile_admin"])
            r = client.patch(f"/auth/users/{uid_y}/link-patient", json={"patient_id": pt.patient_id})
            reset()
            assert r.status_code == 409, r.text
        finally:
            db.delete(px); db.delete(py); db.delete(pt); db.commit()

    def test_non_admin_cannot_link(self, test_data):
        """Non-admin cannot call the link-patient endpoint."""
        uid = test_data["profile_unlinked"].firebase_uid
        r = make_client(test_data["profile_a"]).patch(f"/auth/users/{uid}/link-patient", json={"patient_id": test_data["patient_a"].patient_id})
        reset()
        assert r.status_code == 403
