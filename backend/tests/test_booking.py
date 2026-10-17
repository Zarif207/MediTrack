"""Patient self-booking without a clinical patient record."""
import threading
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.main import app
from app.models import Appointment, Patient
from tests.factories import auth, future_weekday

DAY = future_weekday(7).isoformat()


def book(client, uid, doctor_id, day=DAY, at="10:00", **extra):
    return client.post(
        "/appointments/book",
        headers=auth(uid),
        json={"doctor_id": doctor_id, "appointment_date": day, "appointment_time": at, **extra},
    )


def test_unlinked_patient_can_book_and_no_patient_record_is_created(client, db, world):
    patients_before = db.scalar(select(func.count()).select_from(Patient))
    r = book(client, world.uids["patient_u"], world.ids["doctor"], reason="  Check-up  ")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["patient_id"] is None
    assert body["firebase_uid"] == world.uids["patient_u"]
    assert body["status"] == "scheduled"
    assert body["reason"] == "Check-up"
    assert body["patient_name"] == "Una Unlinked"
    assert db.scalar(select(func.count()).select_from(Patient)) == patients_before

    stored = db.get(Appointment, body["appointment_id"])
    assert stored is not None and stored.firebase_uid == world.uids["patient_u"]


def test_booking_is_listed_immediately_and_persists_across_sessions(client, world):
    uid = world.uids["patient_u"]
    appt_id = book(client, uid, world.ids["doctor"]).json()["appointment_id"]
    listed = client.get("/appointments/", headers=auth(uid)).json()
    assert [a["appointment_id"] for a in listed] == [appt_id]
    # A brand-new client (new "login") sees the same data from the database.
    fresh = TestClient(app, raise_server_exceptions=False)
    assert fresh.get(f"/appointments/{appt_id}", headers=auth(uid)).status_code == 200


def test_linked_patient_booking_carries_patient_record(client, world):
    r = book(client, world.uids["patient_a"], world.ids["doctor"])
    assert r.status_code == 201
    assert r.json()["patient_id"] == world.ids["patient_a"]


def test_body_cannot_choose_the_owner(client, world):
    r = book(client, world.uids["patient_u"], world.ids["doctor"],
             patient_id=world.ids["patient_b"], firebase_uid=world.uids["patient_b"], status="completed")
    assert r.status_code == 201
    body = r.json()
    assert body["patient_id"] is None
    assert body["firebase_uid"] == world.uids["patient_u"]
    assert body["status"] == "scheduled"
    # Patient B does not see it.
    ids = [a["appointment_id"] for a in client.get("/appointments/", headers=auth(world.uids["patient_b"])).json()]
    assert body["appointment_id"] not in ids


def test_other_patients_cannot_read_or_cancel_a_booking(client, world):
    appt_id = book(client, world.uids["patient_u"], world.ids["doctor"]).json()["appointment_id"]
    for other in ("patient_a", "patient_b"):
        assert client.get(f"/appointments/{appt_id}", headers=auth(world.uids[other])).status_code == 404
        assert client.post(f"/appointments/{appt_id}/cancel", headers=auth(world.uids[other])).status_code == 404


@pytest.mark.parametrize("role", ["user", "admin", "receptionist", "doctor"])
def test_only_patients_can_self_book(client, world, role):
    assert book(client, world.uids[role], world.ids["doctor"]).status_code == 403


def test_staff_see_unlinked_booking_with_booker_details(client, world):
    appt_id = book(client, world.uids["patient_u"], world.ids["doctor"]).json()["appointment_id"]
    r = client.get(f"/appointments/{appt_id}", headers=auth(world.uids["receptionist"]))
    assert r.status_code == 200
    assert r.json()["booked_by_email"] == "uid_patient_u@test.invalid"


@pytest.mark.parametrize("day,at,detail", [
    ((date.today() - timedelta(days=1)).isoformat(), "10:00", "future"),
    (DAY, "10:15", "slot"),
    (DAY, "08:30", "slot"),
    (DAY, "17:00", "slot"),
    (DAY, "10:00:30", "slot"),
    ((date.today() + timedelta(days=400)).isoformat(), "10:00", "days ahead"),
])
def test_booking_policy(client, world, day, at, detail):
    r = book(client, world.uids["patient_u"], world.ids["doctor"], day=day, at=at)
    assert r.status_code == 422
    assert detail in r.json()["detail"]


@pytest.mark.parametrize("payload", [
    {"doctor_id": 1, "appointment_date": "not-a-date", "appointment_time": "10:00"},
    {"doctor_id": 1, "appointment_date": DAY, "appointment_time": "25:00"},
    {"doctor_id": 0, "appointment_date": DAY, "appointment_time": "10:00"},
    {"doctor_id": "x", "appointment_date": DAY, "appointment_time": "10:00"},
    {"appointment_date": DAY, "appointment_time": "10:00"},
    {"doctor_id": 1, "appointment_date": DAY, "appointment_time": "10:00", "reason": "x" * 1001},
])
def test_invalid_booking_payloads(client, world, payload):
    r = client.post("/appointments/book", headers=auth(world.uids["patient_u"]), json=payload)
    assert r.status_code == 422


def test_unknown_doctor_is_404(client, world):
    assert book(client, world.uids["patient_u"], 999999).status_code == 404


def test_slot_conflict_with_another_patient(client, world):
    assert book(client, world.uids["patient_a"], world.ids["doctor"]).status_code == 201
    r = book(client, world.uids["patient_u"], world.ids["doctor"])
    assert r.status_code == 409
    assert "already has an active appointment" in r.json()["detail"]


def test_patient_cannot_double_book_same_time_or_same_doctor_day(client, world):
    uid = world.uids["patient_u"]
    assert book(client, uid, world.ids["doctor"], at="10:00").status_code == 201
    r = book(client, uid, world.ids["doctor2"], at="10:00")
    assert r.status_code == 409 and "at that time" in r.json()["detail"]
    r = book(client, uid, world.ids["doctor"], at="11:00")
    assert r.status_code == 409 and "this doctor" in r.json()["detail"]
    # A different doctor at a different time is fine.
    assert book(client, uid, world.ids["doctor2"], at="11:00").status_code == 201


def test_cancelled_slot_can_be_rebooked(client, world):
    appt_id = book(client, world.uids["patient_u"], world.ids["doctor"]).json()["appointment_id"]
    r = client.post(f"/appointments/{appt_id}/cancel", headers=auth(world.uids["patient_u"]))
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert book(client, world.uids["patient_a"], world.ids["doctor"]).status_code == 201


def test_cannot_cancel_twice_or_cancel_past_or_completed(client, world):
    uid = world.uids["patient_u"]
    appt_id = book(client, uid, world.ids["doctor"]).json()["appointment_id"]
    client.post(f"/appointments/{appt_id}/cancel", headers=auth(uid))
    assert client.post(f"/appointments/{appt_id}/cancel", headers=auth(uid)).status_code == 409
    # appt_a is completed and in the past.
    r = client.post(f"/appointments/{world.ids['appt_a']}/cancel", headers=auth(world.uids["patient_a"]))
    assert r.status_code == 409


def test_concurrent_bookings_for_one_slot_produce_exactly_one_appointment(db, world):
    uids = [world.uids["patient_a"], world.uids["patient_b"], world.uids["patient_u"]]
    results = []
    barrier = threading.Barrier(len(uids))

    def worker(uid):
        c = TestClient(app, raise_server_exceptions=False)
        barrier.wait()
        results.append(book(c, uid, world.ids["doctor"], at="14:00").status_code)

    threads = [threading.Thread(target=worker, args=(u,)) for u in uids]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results) == [201, 409, 409]
    count = db.scalar(select(func.count()).select_from(Appointment).where(
        Appointment.doctor_id == world.ids["doctor"],
        Appointment.appointment_time == __import__("datetime").time(14, 0),
        Appointment.status == "scheduled",
    ))
    assert count == 1


def test_availability_reveals_times_only(client, world):
    book(client, world.uids["patient_a"], world.ids["doctor"], at="09:30")
    r = client.get(f"/doctors/{world.ids['doctor']}/availability", params={"on": DAY},
                   headers=auth(world.uids["patient_u"]))
    assert r.status_code == 200
    body = r.json()
    assert "09:30:00" in body["unavailable"]
    assert "09:00:00" in body["available"]
    assert body["slot_minutes"] == 30
    assert "patient" not in str(body).lower()


def test_availability_requires_patient_or_staff(client, world):
    path = f"/doctors/{world.ids['doctor']}/availability"
    assert client.get(path, params={"on": DAY}).status_code == 401
    assert client.get(path, params={"on": DAY}, headers=auth(world.uids["user"])).status_code == 403
    assert client.get("/doctors/999999/availability", params={"on": DAY},
                      headers=auth(world.uids["patient_u"])).status_code == 404


def test_linking_account_attaches_unlinked_bookings_only(client, db, world):
    uid = world.uids["patient_u"]
    own = book(client, uid, world.ids["doctor"]).json()["appointment_id"]
    r = client.patch(f"/auth/users/{uid}/link-patient", headers=auth(world.uids["admin"]),
                     json={"patient_id": world.ids["patient_b"]})
    assert r.status_code == 409  # patient_b already linked to another account

    # Create a fresh clinical record and link to it.
    created = client.post("/patients/", headers=auth(world.uids["receptionist"]), json={
        "first_name": "Una", "last_name": "Unlinked", "date_of_birth": "1999-09-09",
        "gender": "Female", "phone": "+1 555 0100"}).json()
    r = client.patch(f"/auth/users/{uid}/link-patient", headers=auth(world.uids["admin"]),
                     json={"patient_id": created["patient_id"]})
    assert r.status_code == 200
    db.expire_all()
    assert db.get(Appointment, own).patient_id == created["patient_id"]
    # Appointments of other patients were not touched.
    assert db.get(Appointment, world.ids["appt_b"]).patient_id == world.ids["patient_b"]

    # Unlinking moves the booking back to account-only ownership; it stays visible.
    client.patch(f"/auth/users/{uid}/link-patient", headers=auth(world.uids["admin"]), json={"patient_id": None})
    db.expire_all()
    assert db.get(Appointment, own).patient_id is None
    assert client.get(f"/appointments/{own}", headers=auth(uid)).status_code == 200
