"""CRUD behaviour, validation, constraints and transaction safety for staff."""
from datetime import date, timedelta

import pytest

from tests.factories import auth, future_weekday

PATIENT = {"first_name": "Cara", "last_name": "Synthetic", "date_of_birth": "1970-03-04",
           "gender": "Female", "phone": "+1 (555) 010-2000", "email": "cara@example.com",
           "blood_group": "O+"}


@pytest.fixture
def H(world):
    return {role: auth(uid) for role, uid in world.uids.items()}


# ── Patients ──────────────────────────────────────────────────────────────────

def test_patient_lifecycle(client, H):
    r = client.post("/patients/", headers=H["receptionist"], json={**PATIENT, "first_name": "  Cara  "})
    assert r.status_code == 201, r.text
    pid = r.json()["patient_id"]
    assert r.json()["first_name"] == "Cara"
    assert client.get(f"/patients/{pid}", headers=H["doctor"]).json()["email"] == "cara@example.com"
    r = client.patch(f"/patients/{pid}", headers=H["receptionist"], json={"address": "1 Test Street"})
    assert r.status_code == 200 and r.json()["address"] == "1 Test Street"
    assert client.delete(f"/patients/{pid}", headers=H["admin"]).status_code == 204
    assert client.get(f"/patients/{pid}", headers=H["admin"]).status_code == 404


@pytest.mark.parametrize("override", [
    {"email": "not-an-email"},
    {"phone": "call me"},
    {"phone": "12"},
    {"date_of_birth": (date.today() + timedelta(days=1)).isoformat()},
    {"date_of_birth": "1850-01-01"},
    {"blood_group": "Z+"},
    {"first_name": "   "},
    {"first_name": "x" * 51},
    {"gender": ""},
])
def test_patient_validation(client, H, override):
    assert client.post("/patients/", headers=H["admin"], json={**PATIENT, **override}).status_code == 422


def test_patient_duplicate_email_is_409(client, H):
    client.post("/patients/", headers=H["admin"], json=PATIENT)
    r = client.post("/patients/", headers=H["admin"], json={**PATIENT, "phone": "+15550102001"})
    assert r.status_code == 409
    assert "psycopg" not in r.text and "UniqueViolation" not in r.text


def test_patch_null_on_required_field_is_422_and_empty_patch_400(client, world, H):
    pid = world.ids["patient_a"]
    assert client.patch(f"/patients/{pid}", headers=H["admin"], json={"first_name": None}).status_code == 422
    assert client.patch(f"/patients/{pid}", headers=H["admin"], json={}).status_code == 400


def test_patient_with_appointments_cannot_be_deleted(client, world, H):
    r = client.delete(f"/patients/{world.ids['patient_a']}", headers=H["admin"])
    assert r.status_code == 409


def test_session_recovers_after_integrity_error(client, H):
    client.post("/patients/", headers=H["admin"], json=PATIENT)
    assert client.post("/patients/", headers=H["admin"], json=PATIENT).status_code == 409
    r = client.post("/patients/", headers=H["admin"], json={**PATIENT, "email": "other@example.com"})
    assert r.status_code == 201


# ── Departments & doctors ─────────────────────────────────────────────────────

def test_department_lifecycle_and_duplicates(client, H):
    r = client.post("/departments/", headers=H["admin"], json={"department_name": "Test Neurology"})
    assert r.status_code == 201
    did = r.json()["department_id"]
    assert client.post("/departments/", headers=H["admin"], json={"department_name": "Test Neurology"}).status_code == 409
    assert client.patch(f"/departments/{did}", headers=H["admin"], json={"description": "Brains"}).json()["description"] == "Brains"
    assert client.delete(f"/departments/{did}", headers=H["admin"]).status_code == 204


def test_department_with_doctors_cannot_be_deleted(client, world, H):
    assert client.delete(f"/departments/{world.ids['dept']}", headers=H["admin"]).status_code == 409


def test_doctor_lifecycle_and_unique_fields(client, world, H):
    doc = {"department_id": world.ids["dept"], "first_name": "Dee", "last_name": "Test",
           "specialization": "Neurology", "phone": "+15550103000",
           "email": "dee@example.com", "license_number": "TEST-LIC-9"}
    r = client.post("/doctors/", headers=H["admin"], json=doc)
    assert r.status_code == 201
    assert client.post("/doctors/", headers=H["admin"], json={**doc, "email": "x@example.com"}).status_code == 409
    assert client.post("/doctors/", headers=H["admin"], json={**doc, "department_id": 999999,
                                                              "email": "y@example.com",
                                                              "license_number": "TEST-LIC-10"}).status_code == 404
    assert client.delete(f"/doctors/{world.ids['doctor']}", headers=H["admin"]).status_code == 409


# ── Appointments (staff) ──────────────────────────────────────────────────────

def _staff_appt(client, H, world, **over):
    body = {"patient_id": world.ids["patient_a"], "doctor_id": world.ids["doctor"],
            "appointment_date": future_weekday(10).isoformat(), "appointment_time": "13:00", **over}
    return client.post("/appointments/", headers=H["receptionist"], json=body)


def test_staff_appointment_lifecycle(client, world, H):
    r = _staff_appt(client, H, world)
    assert r.status_code == 201, r.text
    aid = r.json()["appointment_id"]
    assert r.json()["patient_name"] == "Alice Synthetic"
    assert client.patch(f"/appointments/{aid}", headers=H["receptionist"], json={"status": "confirmed"}).status_code == 200
    assert client.patch(f"/appointments/{aid}", headers=H["receptionist"],
                        json={"appointment_time": "13:30"}).json()["appointment_time"] == "13:30:00"
    assert client.delete(f"/appointments/{aid}", headers=H["admin"]).status_code == 204


def test_staff_conflict_and_missing_references(client, world, H):
    assert _staff_appt(client, H, world).status_code == 201
    assert _staff_appt(client, H, world, patient_id=world.ids["patient_b"]).status_code == 409
    assert _staff_appt(client, H, world, patient_id=999999).status_code == 404
    assert _staff_appt(client, H, world, doctor_id=999999).status_code == 404


@pytest.mark.parametrize("start,target,ok", [
    ("scheduled", "confirmed", True),
    ("confirmed", "completed", True),
    ("scheduled", "no_show", True),
    ("completed", "scheduled", False),
    ("cancelled", "confirmed", False),
    ("no_show", "completed", False),
])
def test_status_transitions(client, world, H, start, target, ok):
    aid = _staff_appt(client, H, world, status="scheduled").json()["appointment_id"]
    if start != "scheduled":
        path = {"confirmed": ["confirmed"], "completed": ["completed"],
                "cancelled": ["cancelled"], "no_show": ["no_show"]}[start]
        for s in path:
            assert client.patch(f"/appointments/{aid}", headers=H["receptionist"], json={"status": s}).status_code == 200
    r = client.patch(f"/appointments/{aid}", headers=H["receptionist"], json={"status": target})
    assert (r.status_code == 200) is ok, r.text


def test_final_appointments_cannot_be_rescheduled(client, world, H):
    r = client.patch(f"/appointments/{world.ids['appt_a']}", headers=H["receptionist"],
                     json={"appointment_date": future_weekday(3).isoformat()})
    assert r.status_code == 409


def test_patient_change_blocked_when_clinical_data_exists(client, world, H):
    r = client.patch(f"/appointments/{world.ids['appt_a']}", headers=H["receptionist"],
                     json={"patient_id": world.ids["patient_b"]})
    assert r.status_code == 409


def test_appointment_with_record_cannot_be_deleted(client, world, H):
    assert client.delete(f"/appointments/{world.ids['appt_a']}", headers=H["admin"]).status_code == 409


# ── Medical records, prescriptions, items ─────────────────────────────────────

def test_clinical_chain(client, world, H):
    aid = _staff_appt(client, H, world).json()["appointment_id"]
    r = client.post("/medical-records/", headers=H["doctor"], json={"appointment_id": aid, "diagnosis": "Flu"})
    assert r.status_code == 201
    rid = r.json()["record_id"]
    assert r.json()["patient_id"] == world.ids["patient_a"]
    assert client.post("/medical-records/", headers=H["doctor"], json={"appointment_id": aid}).status_code == 409
    assert client.post("/medical-records/", headers=H["doctor"], json={"appointment_id": 999999}).status_code == 404

    rx = client.post("/prescriptions/", headers=H["doctor"], json={"record_id": rid, "instructions": "After food"})
    assert rx.status_code == 201
    rxid = rx.json()["prescription_id"]
    item = {"prescription_id": rxid, "medicine_id": world.ids["medicine"], "dosage": "1 tab",
            "frequency": "Daily", "duration": "3 days", "quantity": 3}
    r = client.post("/prescription-items/", headers=H["doctor"], json=item)
    assert r.status_code == 201
    iid = r.json()["prescription_item_id"]
    assert client.post("/prescription-items/", headers=H["doctor"], json=item).status_code == 409
    assert client.post("/prescription-items/", headers=H["doctor"], json={**item, "quantity": 0}).status_code == 422
    assert client.patch(f"/prescription-items/{iid}", headers=H["doctor"], json={"quantity": None}).status_code == 422

    # Deletion order is enforced.
    assert client.delete(f"/prescriptions/{rxid}", headers=H["admin"]).status_code == 409
    assert client.delete(f"/medical-records/{rid}", headers=H["admin"]).status_code == 409
    assert client.delete(f"/medicines/{world.ids['medicine']}", headers=H["admin"]).status_code == 409
    assert client.delete(f"/prescription-items/{iid}", headers=H["doctor"]).status_code == 204
    assert client.delete(f"/prescriptions/{rxid}", headers=H["admin"]).status_code == 204
    assert client.delete(f"/medical-records/{rid}", headers=H["admin"]).status_code == 204


def test_no_medical_record_for_cancelled_appointment(client, world, H):
    aid = _staff_appt(client, H, world, status="cancelled").json()["appointment_id"]
    assert client.post("/medical-records/", headers=H["doctor"], json={"appointment_id": aid}).status_code == 409


def test_clinical_text_length_limits(client, world, H):
    aid = _staff_appt(client, H, world).json()["appointment_id"]
    r = client.post("/medical-records/", headers=H["doctor"], json={"appointment_id": aid, "diagnosis": "x" * 5001})
    assert r.status_code == 422


# ── Medicines ─────────────────────────────────────────────────────────────────

def test_medicine_lifecycle_and_bounds(client, H):
    med = {"medicine_name": "Testafen", "generic_name": "Testafenum", "dosage_form": "Syrup",
           "strength": "100mg/5ml", "manufacturer": "Synthetic Pharma", "unit_price": "2.25",
           "stock_quantity": 5}
    r = client.post("/medicines/", headers=H["pharmacist"], json=med)
    assert r.status_code == 201
    mid = r.json()["medicine_id"]
    for bad in ({"unit_price": "-1"}, {"stock_quantity": -1}, {"unit_price": "1.234"}, {"stock_quantity": 10**7}):
        assert client.post("/medicines/", headers=H["pharmacist"], json={**med, **bad}).status_code == 422
    assert client.patch(f"/medicines/{mid}", headers=H["pharmacist"], json={"stock_quantity": 50}).json()["stock_quantity"] == 50
    assert client.delete(f"/medicines/{mid}", headers=H["admin"]).status_code == 204


# ── Bills ─────────────────────────────────────────────────────────────────────

def test_bill_lifecycle(client, world, H):
    aid = _staff_appt(client, H, world).json()["appointment_id"]
    body = {"patient_id": world.ids["patient_a"], "appointment_id": aid, "amount": "45.50"}
    r = client.post("/bills/", headers=H["accountant"], json=body)
    assert r.status_code == 201 and r.json()["paid_at"] is None
    bid = r.json()["bill_id"]
    assert client.post("/bills/", headers=H["accountant"], json=body).status_code == 409
    paid = client.patch(f"/bills/{bid}", headers=H["accountant"], json={"payment_status": "paid", "payment_method": "Card"})
    assert paid.status_code == 200 and paid.json()["paid_at"] is not None
    back = client.patch(f"/bills/{bid}", headers=H["accountant"], json={"payment_status": "pending"})
    assert back.json()["paid_at"] is None
    assert client.patch(f"/bills/{bid}", headers=H["accountant"], json={"amount": None}).status_code == 422
    assert client.delete(f"/bills/{bid}", headers=H["admin"]).status_code == 204


@pytest.mark.parametrize("override,code", [
    ({"amount": "-5"}, 422),
    ({"amount": "123456789012"}, 422),
    ({"payment_status": "refunded"}, 422),
    ({"patient_id": "PATIENT_B"}, 400),
    ({"appointment_id": 999999}, 404),
])
def test_bill_validation(client, world, H, override, code):
    aid = _staff_appt(client, H, world).json()["appointment_id"]
    body = {"patient_id": world.ids["patient_a"], "appointment_id": aid, "amount": "10.00", **override}
    if body["patient_id"] == "PATIENT_B":
        body["patient_id"] = world.ids["patient_b"]
    assert client.post("/bills/", headers=H["accountant"], json=body).status_code == code


def test_no_bill_for_unlinked_booking(client, world, H):
    appt = client.post("/appointments/book", headers=H["patient_u"], json={
        "doctor_id": world.ids["doctor"], "appointment_date": future_weekday(7).isoformat(),
        "appointment_time": "16:00"}).json()
    r = client.post("/bills/", headers=H["accountant"], json={
        "patient_id": world.ids["patient_a"], "appointment_id": appt["appointment_id"], "amount": "10.00"})
    assert r.status_code == 409


# ── Pagination ────────────────────────────────────────────────────────────────

def test_pagination_bounds(client, world, H):
    assert client.get("/patients/", params={"limit": 101}, headers=H["admin"]).status_code == 422
    assert client.get("/patients/", params={"skip": -1}, headers=H["admin"]).status_code == 422
    page = client.get("/patients/", params={"limit": 1, "skip": 1}, headers=H["admin"]).json()
    assert [p["patient_id"] for p in page] == [world.ids["patient_b"]]
