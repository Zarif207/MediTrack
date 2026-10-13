"""
Full system tests — covers:
  Part 2: user role as new default
  Part 3: admin role management + patient linking
  Part 4: patient appointment booking (linked and unlinked)
  Part 5: display_name sync
  Part 8: security / authorization boundaries

Run from backend/:
    python -m pytest tests/test_full_system.py -v
"""
import pytest
import time as time_module   # avoid shadowing datetime.time
from datetime import date, time, datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.auth.dependencies import (
    get_current_user,
    get_patient_id_for_user,
    get_optional_patient_id,
)
from app.database.connection import engine
from app.models.user_profile import UserProfile, VALID_ROLES
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.department import Department
from app.models.appointment import Appointment
from app.models.bill import Bill
from app.models.medical_record import MedicalRecord


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _install_overrides(profile: UserProfile) -> TestClient:
    """Install dependency overrides for the given profile and return a client."""
    client = TestClient(app, raise_server_exceptions=False)

    async def fake_user():
        return profile

    async def fake_patient_id():
        if profile.role == "patient":
            # New behavior: return None for unlinked patients (not 403)
            # Routes handle None gracefully (empty list, not error)
            return profile.patient_id  # None when unlinked
        if profile.role == "user":
            from fastapi import HTTPException, status as s
            raise HTTPException(status_code=s.HTTP_403_FORBIDDEN, detail="Access denied.")
        return None  # staff

    async def fake_opt():
        if profile.role == "patient":
            return profile.patient_id  # may be None for unlinked
        return None

    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_patient_id_for_user] = fake_patient_id
    app.dependency_overrides[get_optional_patient_id] = fake_opt
    return client


def make_client(profile: UserProfile) -> TestClient:
    """Install overrides and return a TestClient. Call reset() after use."""
    return _install_overrides(profile)


def reset():
    """Always call after make_client() to clear dependency overrides."""
    app.dependency_overrides.clear()


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
    Module-scoped test data. Uses a timestamp suffix to avoid duplicate key
    violations if a previous run's cleanup failed.
    Cleans up after all tests in this module complete.
    """
    now = datetime.now()
    suffix = str(int(time_module.time()))[-6:]  # last 6 digits of unix time

    dept = Department(
        department_name=f"SYS_DEPT_{suffix}",
        description="test dept",
    )
    db.add(dept)
    db.flush()

    doctor = Doctor(
        department_id=dept.department_id,
        first_name="SYS", last_name=f"Doc{suffix}",
        specialization="Testing",
        phone=f"999{suffix}",
        email=f"sys.doc.{suffix}@example.com",
        license_number=f"SYS-{suffix}",
    )
    db.add(doctor)
    db.flush()

    patient_a = Patient(
        first_name="SYS", last_name=f"PatA{suffix}",
        date_of_birth=date(1990, 1, 1), gender="Other",
        phone=f"111{suffix}",
        email=f"sys.pta.{suffix}@test.invalid",
        registered_at=now,
    )
    patient_b = Patient(
        first_name="SYS", last_name=f"PatB{suffix}",
        date_of_birth=date(1991, 1, 1), gender="Other",
        phone=f"222{suffix}",
        email=f"sys.ptb.{suffix}@test.invalid",
        registered_at=now,
    )
    db.add_all([patient_a, patient_b])
    db.flush()

    appt_a = Appointment(
        patient_id=patient_a.patient_id,
        doctor_id=doctor.doctor_id,
        appointment_date=date(2025, 8, 1),
        appointment_time=time(10, 0),
        status="scheduled",
        created_at=now,
    )
    appt_b = Appointment(
        patient_id=patient_b.patient_id,
        doctor_id=doctor.doctor_id,
        appointment_date=date(2025, 8, 2),
        appointment_time=time(11, 0),
        status="scheduled",
        created_at=now,
    )
    db.add_all([appt_a, appt_b])
    db.flush()

    record_a = MedicalRecord(
        appointment_id=appt_a.appointment_id,
        diagnosis=f"Test A {suffix}",
        record_date=now,
    )
    db.add(record_a)
    db.flush()

    bill_a = Bill(
        patient_id=patient_a.patient_id,
        appointment_id=appt_a.appointment_id,
        amount="100.00",
        payment_status="pending",
        issued_at=now,
    )
    db.add(bill_a)
    db.commit()

    # Profiles
    uid_user    = f"SYS_USER_{suffix}"
    uid_pat_l   = f"SYS_PAT_L_{suffix}"
    uid_pat_u   = f"SYS_PAT_U_{suffix}"
    uid_admin   = f"SYS_ADMIN_{suffix}"
    uid_doctor  = f"SYS_DOC_{suffix}"

    profile_user             = UserProfile(firebase_uid=uid_user,   role="user",    patient_id=None,                    email=f"sys.user.{suffix}@test.invalid",  display_name="Sys User",   created_at=now)
    profile_patient_linked   = UserProfile(firebase_uid=uid_pat_l,  role="patient", patient_id=patient_a.patient_id,    email=f"sys.patl.{suffix}@test.invalid",  display_name="Sys PatA",   created_at=now)
    profile_patient_unlinked = UserProfile(firebase_uid=uid_pat_u,  role="patient", patient_id=None,                    email=f"sys.patu.{suffix}@test.invalid",  display_name="Sys PatU",   created_at=now)
    profile_admin            = UserProfile(firebase_uid=uid_admin,  role="admin",   patient_id=None,                    email=f"sys.admin.{suffix}@test.invalid", display_name="Sys Admin",  created_at=now)
    profile_doctor           = UserProfile(firebase_uid=uid_doctor, role="doctor",  patient_id=None,                    email=f"sys.doc.{suffix}@test.invalid",   display_name="Sys Doctor", created_at=now)
    db.add_all([profile_user, profile_patient_linked, profile_patient_unlinked,
                profile_admin, profile_doctor])
    db.commit()

    data = {
        "patient_a": patient_a,
        "patient_b": patient_b,
        "appt_a": appt_a,
        "appt_b": appt_b,
        "record_a": record_a,
        "bill_a": bill_a,
        "doctor": doctor,
        "dept": dept,
        "profile_user": profile_user,
        "profile_patient_linked": profile_patient_linked,
        "profile_patient_unlinked": profile_patient_unlinked,
        "profile_admin": profile_admin,
        "profile_doctor": profile_doctor,
        "suffix": suffix,
    }
    yield data

    # ── Cleanup (FK-safe order) ──────────────────────────────────────────────
    reset()  # clear any stale overrides

    # All profiles that may have been auto-linked during tests
    for profile in [profile_user, profile_patient_linked,
                    profile_patient_unlinked, profile_admin, profile_doctor]:
        try:
            db.refresh(profile)
            profile.patient_id = None
        except Exception:
            pass
    try:
        db.commit()
    except Exception:
        db.rollback()

    # Delete any extra appointments created during booking tests
    extra_appts = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.doctor_id,
        Appointment.appointment_id.notin_([appt_a.appointment_id, appt_b.appointment_id]),
    ).all()
    for a in extra_appts:
        try:
            db.delete(a)
        except Exception:
            pass
    try:
        db.commit()
    except Exception:
        db.rollback()

    for obj in [bill_a, record_a, appt_a, appt_b,
                profile_user, profile_patient_linked, profile_patient_unlinked,
                profile_admin, profile_doctor,
                patient_a, patient_b, doctor, dept]:
        try:
            db.delete(obj)
        except Exception:
            pass
    try:
        db.commit()
    except Exception:
        db.rollback()

    # Clean up any auto-created patients from unlinked booking tests
    from sqlalchemy import text
    db.execute(text(f"DELETE FROM patients WHERE email LIKE '%.{suffix}@test.invalid' OR email LIKE '%sys.book.unlinked%'"))
    db.execute(text(f"DELETE FROM user_profiles WHERE firebase_uid LIKE '%{suffix}%' OR firebase_uid LIKE 'SYS_BOOK%'"))
    # Clean the doctor too (use example.com email pattern)
    db.execute(text(f"DELETE FROM appointments WHERE doctor_id IN (SELECT doctor_id FROM doctors WHERE email LIKE '%.{suffix}@example.com')"))
    db.execute(text(f"DELETE FROM doctors WHERE email LIKE '%.{suffix}@example.com'"))
    db.execute(text(f"DELETE FROM departments WHERE department_name LIKE 'SYS_DEPT_{suffix}%'"))
    db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# PART 2: user role as default
# ──────────────────────────────────────────────────────────────────────────────

class TestUserRoleDefault:
    """Tests 1–8: user role is the new default; user cannot access patient/staff endpoints."""

    def test_register_creates_user_role(self, db):
        """New registrations get role='user', not 'patient'."""
        uid = "SYS_REG_DFLT_001"
        try:
            r = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "New User", "email": "new.default@test.invalid"},
            )
            assert r.status_code == 201, r.text
            assert r.json()["role"] == "user", f"Expected 'user', got {r.json()['role']}"
        finally:
            p = db.get(UserProfile, uid)
            if p:
                db.delete(p)
                db.commit()

    def test_register_idempotent_preserves_role(self, db):
        """Re-registering does NOT revert an existing role to 'user'."""
        uid = "SYS_REG_PRSRV_001"
        try:
            TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "email": "prsrv@test.invalid"},
            )
            p = db.get(UserProfile, uid)
            p.role = "doctor"
            db.commit()

            r2 = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "email": "prsrv@test.invalid"},
            )
            assert r2.json()["role"] == "doctor", "Role was overwritten by re-registration"
        finally:
            p = db.get(UserProfile, uid)
            if p:
                db.delete(p)
                db.commit()

    def test_valid_roles_includes_user(self):
        assert "user" in VALID_ROLES

    def test_user_cannot_access_patient_list(self, test_data):
        r = make_client(test_data["profile_user"]).get("/patients/")
        reset()
        assert r.status_code == 403

    def test_user_cannot_access_appointments(self, test_data):
        r = make_client(test_data["profile_user"]).get("/appointments/")
        reset()
        assert r.status_code == 403

    def test_user_cannot_access_medical_records(self, test_data):
        r = make_client(test_data["profile_user"]).get("/medical-records/")
        reset()
        assert r.status_code == 403

    def test_user_cannot_book_appointments(self, test_data):
        r = make_client(test_data["profile_user"]).post(
            "/appointments/book",
            json={"doctor_id": test_data["doctor"].doctor_id,
                  "appointment_date": "2027-01-01", "appointment_time": "10:00"},
        )
        reset()
        assert r.status_code == 403, r.text

    def test_user_can_call_auth_me(self, test_data):
        """Any authenticated user can call /auth/me."""
        r = make_client(test_data["profile_user"]).get("/auth/me")
        reset()
        assert r.status_code == 200
        assert r.json()["role"] == "user"


# ──────────────────────────────────────────────────────────────────────────────
# PART 3: admin role management
# ──────────────────────────────────────────────────────────────────────────────

class TestRoleManagement:
    """Tests 9–12: admin promotes/demotes, linking updates appointments."""

    def test_admin_can_promote_user_to_patient(self, test_data, db):
        uid = "SYS_PRMT_001"
        try:
            profile = UserProfile(firebase_uid=uid, role="user",
                                  email="prmt@test.invalid", created_at=datetime.now())
            db.add(profile)
            db.commit()

            r = make_client(test_data["profile_admin"]).patch(
                f"/auth/users/{uid}/role", json={"role": "patient"},
            )
            reset()
            assert r.status_code == 200, r.text
            assert r.json()["role"] == "patient"
        finally:
            p = db.get(UserProfile, uid)
            if p:
                db.delete(p)
                db.commit()

    def test_admin_can_demote_patient_to_user_clears_link(self, test_data, db):
        """Demoting patient→user clears patient_id link but preserves the patient record."""
        uid = "SYS_DMOT_001"
        try:
            profile = UserProfile(
                firebase_uid=uid, role="patient",
                patient_id=test_data["patient_b"].patient_id,
                email="dmot@test.invalid", created_at=datetime.now(),
            )
            db.add(profile)
            db.commit()

            r = make_client(test_data["profile_admin"]).patch(
                f"/auth/users/{uid}/role", json={"role": "user"},
            )
            reset()
            assert r.status_code == 200, r.text
            assert r.json()["role"] == "user"
            assert r.json()["patient_id"] is None, "patient_id should be cleared on demotion"

            # Patient record still exists
            assert db.get(Patient, test_data["patient_b"].patient_id) is not None
        finally:
            p = db.get(UserProfile, uid)
            if p:
                db.delete(p)
                db.commit()

    def test_non_admin_cannot_change_roles(self, test_data):
        uid = test_data["profile_user"].firebase_uid
        r = make_client(test_data["profile_patient_linked"]).patch(
            f"/auth/users/{uid}/role", json={"role": "admin"},
        )
        reset()
        assert r.status_code == 403

    def test_admin_link_associates_pending_appointments(self, test_data, db):
        """
        When admin links a firebase_uid to a patient, appointments that were
        booked with that firebase_uid get their patient_id updated.
        """
        uid = "SYS_LINK_001"
        now = datetime.now()
        profile = UserProfile(
            firebase_uid=uid, role="patient", patient_id=None,
            email=None, created_at=now,
        )
        db.add(profile)
        # Create a fresh patient to link
        pt = Patient(
            first_name="SYS", last_name="LinkPt",
            date_of_birth=date(1990, 1, 1), gender="Other",
            phone="9990001111", registered_at=now,
        )
        db.add(pt)
        db.flush()

        # Simulate an appointment booked while unlinked (patient_id = some placeholder)
        appt = Appointment(
            patient_id=test_data["patient_a"].patient_id,  # temporary placeholder
            doctor_id=test_data["doctor"].doctor_id,
            appointment_date=date(2026, 9, 10),
            appointment_time=time(10, 0),
            status="scheduled",
            firebase_uid=uid,
            created_at=now,
        )
        db.add(appt)
        db.commit()

        try:
            r = make_client(test_data["profile_admin"]).patch(
                f"/auth/users/{uid}/link-patient",
                json={"patient_id": pt.patient_id},
            )
            reset()
            assert r.status_code == 200, r.text
            assert r.json()["patient_id"] == pt.patient_id

            # Appointment should now belong to the correct patient
            db.expire(appt)
            db.refresh(appt)
            assert appt.patient_id == pt.patient_id
        finally:
            db.delete(appt)
            db.delete(profile)
            db.delete(pt)
            db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# PART 4: appointment booking
# ──────────────────────────────────────────────────────────────────────────────

class TestAppointmentBooking:
    """Tests 13–19: linked/unlinked booking, conflict detection, staff access."""

    def test_linked_patient_can_book(self, test_data, db):
        """Linked patient books via /appointments/book; patient_id from UserProfile."""
        r = make_client(test_data["profile_patient_linked"]).post(
            "/appointments/book",
            json={
                "doctor_id": test_data["doctor"].doctor_id,
                "appointment_date": "2026-11-01",
                "appointment_time": "09:00",
                "reason": "SYS TEST booking",
            },
        )
        reset()
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["patient_id"] == test_data["patient_a"].patient_id
        assert body["firebase_uid"] == test_data["profile_patient_linked"].firebase_uid
        # Clean up
        a = db.get(Appointment, body["appointment_id"])
        if a:
            db.delete(a)
            db.commit()

    def test_unlinked_patient_booking_creates_patient_record(self, test_data, db):
        """
        An unlinked patient (role=patient, patient_id=None) books an appointment.
        The route auto-creates a minimal patient record and links the account.
        Uses its own isolated session for the profile to avoid module-fixture conflict.
        """
        suffix = test_data["suffix"]
        uid = f"SYS_BOOK_UNL_{suffix}"
        unl_email = f"sys.unl.{suffix}@test.invalid"
        now = datetime.now()

        # Create the profile in a separate function-scoped session
        with Session(engine) as local_db:
            fresh = UserProfile(
                firebase_uid=uid, role="patient", patient_id=None,
                email=unl_email, display_name="Unlinked Booker",
                created_at=now,
            )
            local_db.add(fresh)
            local_db.commit()
            # Grab the plain data we need for the override (no ORM object crossing sessions)
            fresh_uid = fresh.firebase_uid
            fresh_role = fresh.role
            fresh_patient_id = fresh.patient_id

        # Build a lightweight stand-in profile for the override
        # (does not belong to any session — just carries the fields the route needs)
        class StandInProfile:
            firebase_uid = fresh_uid
            role = fresh_role
            patient_id = fresh_patient_id
            email = unl_email
            display_name = "Unlinked Booker"

        stand_in = StandInProfile()

        try:
            r = make_client(stand_in).post(
                "/appointments/book",
                json={
                    "doctor_id": test_data["doctor"].doctor_id,
                    "appointment_date": "2026-11-20",
                    "appointment_time": "11:30",
                },
            )
        finally:
            reset()

        assert r.status_code == 201, r.text
        body = r.json()
        assert body["patient_id"] is not None
        assert body["firebase_uid"] == uid

        # Cleanup with a fresh session
        with Session(engine) as local_db:
            a = local_db.get(Appointment, body["appointment_id"])
            if a:
                local_db.delete(a)
                local_db.commit()
            # Find the auto-linked profile and its patient
            p = local_db.get(UserProfile, uid)
            if p:
                pid = p.patient_id
                p.patient_id = None
                local_db.commit()
                if pid:
                    pt = local_db.get(Patient, pid)
                    if pt:
                        local_db.delete(pt)
                local_db.delete(p)
                local_db.commit()

    def test_unlinked_patient_sees_own_bookings_via_firebase_uid(self, test_data, db):
        """An unlinked patient can list their bookings via firebase_uid filter."""
        profile = test_data["profile_patient_unlinked"]
        # Ensure unlinked
        db.refresh(profile)
        profile.patient_id = None
        db.commit()

        now = datetime.now()
        appt = Appointment(
            patient_id=test_data["patient_a"].patient_id,
            doctor_id=test_data["doctor"].doctor_id,
            appointment_date=date(2026, 12, 1),
            appointment_time=time(9, 0),
            status="scheduled",
            firebase_uid=profile.firebase_uid,
            created_at=now,
        )
        db.add(appt)
        db.commit()

        try:
            r = make_client(profile).get("/appointments/")
            reset()
            assert r.status_code == 200, r.text
            ids = [a["appointment_id"] for a in r.json()]
            assert appt.appointment_id in ids
        finally:
            db.delete(appt)
            db.commit()

    def test_booking_conflict_rejected(self, test_data, db):
        """Cannot book the same doctor/date/time as an existing scheduled appointment."""
        now = datetime.now()
        existing = Appointment(
            patient_id=test_data["patient_a"].patient_id,
            doctor_id=test_data["doctor"].doctor_id,
            appointment_date=date(2026, 10, 1),
            appointment_time=time(14, 0),
            status="scheduled",
            created_at=now,
        )
        db.add(existing)
        db.commit()

        try:
            r = make_client(test_data["profile_patient_linked"]).post(
                "/appointments/book",
                json={
                    "doctor_id": test_data["doctor"].doctor_id,
                    "appointment_date": "2026-10-01",
                    "appointment_time": "14:00",
                },
            )
            reset()
            assert r.status_code == 409, r.text
        finally:
            db.delete(existing)
            db.commit()

    def test_patient_cannot_use_staff_create_endpoint(self, test_data):
        """POST /appointments/ is staff-only — patient gets 403."""
        r = make_client(test_data["profile_patient_linked"]).post(
            "/appointments/",
            json={
                "patient_id": test_data["patient_a"].patient_id,
                "doctor_id": test_data["doctor"].doctor_id,
                "appointment_date": "2027-01-01",
                "appointment_time": "10:00:00",
            },
        )
        reset()
        assert r.status_code == 403

    def test_staff_can_create_appointments(self, test_data, db):
        """Admin can POST /appointments/."""
        r = make_client(test_data["profile_admin"]).post(
            "/appointments/",
            json={
                "patient_id": test_data["patient_a"].patient_id,
                "doctor_id": test_data["doctor"].doctor_id,
                "appointment_date": "2027-06-01",
                "appointment_time": "10:00:00",
            },
        )
        reset()
        assert r.status_code == 201, r.text
        a = db.get(Appointment, r.json()["appointment_id"])
        if a:
            db.delete(a)
            db.commit()

    def test_patient_a_cannot_see_patient_b_appointment(self, test_data):
        """Patient A cannot retrieve Patient B's appointment."""
        r = make_client(test_data["profile_patient_linked"]).get(
            f"/appointments/{test_data['appt_b'].appointment_id}"
        )
        reset()
        assert r.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# PART 5: display_name sync
# ──────────────────────────────────────────────────────────────────────────────

class TestDisplayNameSync:
    """Tests 20–23: register stores/updates name; role is never overwritten."""

    def test_register_stores_display_name(self, db):
        uid = "SYS_NAME_001"
        try:
            r = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "Alice Test",
                      "email": "alice@test.invalid"},
            )
            assert r.status_code == 201
            assert r.json()["display_name"] == "Alice Test"
        finally:
            p = db.get(UserProfile, uid)
            if p:
                db.delete(p)
                db.commit()

    def test_register_updates_display_name_on_second_call(self, db):
        uid = "SYS_NAME_002"
        try:
            TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "Old Name"},
            )
            r2 = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "display_name": "New Name"},
            )
            assert r2.json()["display_name"] == "New Name"
        finally:
            p = db.get(UserProfile, uid)
            if p:
                db.delete(p)
                db.commit()

    def test_register_null_name_does_not_error(self, db):
        uid = "SYS_NAME_003"
        try:
            r = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "email": "noname@test.invalid"},
            )
            assert r.status_code == 201
            assert r.json()["display_name"] is None
            assert r.json()["email"] == "noname@test.invalid"
        finally:
            p = db.get(UserProfile, uid)
            if p:
                db.delete(p)
                db.commit()

    def test_register_never_overwrites_role(self, db):
        uid = "SYS_NAME_004"
        try:
            TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "email": "roletest@test.invalid"},
            )
            p = db.get(UserProfile, uid)
            p.role = "admin"
            db.commit()

            r2 = TestClient(app, raise_server_exceptions=False).post(
                "/auth/register",
                json={"firebase_uid": uid, "email": "roletest@test.invalid"},
            )
            assert r2.json()["role"] == "admin", "Role was overwritten"
        finally:
            p = db.get(UserProfile, uid)
            if p:
                db.delete(p)
                db.commit()

    def test_me_returns_patient_id_for_linked_patient(self, test_data):
        r = make_client(test_data["profile_patient_linked"]).get("/auth/me")
        reset()
        assert r.status_code == 200
        assert r.json()["patient_id"] == test_data["patient_a"].patient_id

    def test_me_returns_null_patient_id_for_user(self, test_data):
        r = make_client(test_data["profile_user"]).get("/auth/me")
        reset()
        assert r.status_code == 200
        assert r.json()["patient_id"] is None


# ──────────────────────────────────────────────────────────────────────────────
# PART 8: security / authorization boundaries
# ──────────────────────────────────────────────────────────────────────────────

class TestSecurityBoundaries:
    """Tests 24–30: cross-patient isolation, public endpoints, auth requirements."""

    def test_patient_a_can_read_own_medical_record(self, test_data):
        r = make_client(test_data["profile_patient_linked"]).get(
            f"/medical-records/{test_data['record_a'].record_id}"
        )
        reset()
        assert r.status_code == 200

    def test_patient_a_can_read_own_bill(self, test_data):
        r = make_client(test_data["profile_patient_linked"]).get(
            f"/bills/{test_data['bill_a'].bill_id}"
        )
        reset()
        assert r.status_code == 200

    def test_user_role_blocked_from_medical_records(self, test_data):
        r = make_client(test_data["profile_user"]).get("/medical-records/")
        reset()
        assert r.status_code == 403

    def test_user_role_blocked_from_bills(self, test_data):
        r = make_client(test_data["profile_user"]).get("/bills/")
        reset()
        assert r.status_code == 403

    def test_query_param_override_blocked_for_patients(self, test_data):
        """Patient A cannot pass patient_b's ID in a query param to see B's data."""
        r = make_client(test_data["profile_patient_linked"]).get(
            f"/appointments/?patient_id={test_data['patient_b'].patient_id}"
        )
        reset()
        assert r.status_code == 200
        ids = [a["appointment_id"] for a in r.json()]
        assert test_data["appt_b"].appointment_id not in ids

    def test_public_departments_open(self):
        reset()
        r = TestClient(app, raise_server_exceptions=False).get("/departments/")
        assert r.status_code == 200

    def test_public_doctors_open(self):
        reset()
        r = TestClient(app, raise_server_exceptions=False).get("/doctors/")
        assert r.status_code == 200

    def test_no_auth_returns_401_patients(self):
        reset()
        r = TestClient(app, raise_server_exceptions=False).get("/patients/")
        assert r.status_code == 401

    def test_no_auth_returns_401_appointments(self):
        reset()
        r = TestClient(app, raise_server_exceptions=False).get("/appointments/")
        assert r.status_code == 401

    def test_admin_can_list_all_patients(self, test_data):
        r = make_client(test_data["profile_admin"]).get("/patients/")
        reset()
        assert r.status_code == 200
        ids = [p["patient_id"] for p in r.json()]
        assert test_data["patient_a"].patient_id in ids
        assert test_data["patient_b"].patient_id in ids

    def test_duplicate_patient_link_rejected(self, test_data, db):
        """Two accounts cannot be linked to the same patient_id."""
        uid_x = "SYS_DUP_X"
        uid_y = "SYS_DUP_Y"
        now = datetime.now()
        pt = Patient(
            first_name="SYS", last_name="Dup",
            date_of_birth=date(1990, 1, 1), gender="Other",
            phone="9990099999", registered_at=now,
        )
        db.add(pt)
        db.flush()
        px = UserProfile(firebase_uid=uid_x, role="patient",
                         patient_id=pt.patient_id, created_at=now)
        py = UserProfile(firebase_uid=uid_y, role="patient",
                         patient_id=None, created_at=now)
        db.add_all([px, py])
        db.commit()

        try:
            r = make_client(test_data["profile_admin"]).patch(
                f"/auth/users/{uid_y}/link-patient",
                json={"patient_id": pt.patient_id},
            )
            reset()
            assert r.status_code == 409, r.text
        finally:
            db.delete(px)
            db.delete(py)
            db.delete(pt)
            db.commit()
