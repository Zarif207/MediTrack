"""Doctors access only the appointments and clinical data of their linked doctor record."""
import pytest

from app.models import Appointment, MedicalRecord
from tests.factories import auth, future_weekday

CLINICAL = [
    ("/medical-records/", "record_id", "record_a"),
    ("/prescriptions/", "prescription_id", "rx_a"),
    ("/prescription-items/", "prescription_item_id", "item_a"),
    ("/appointments/", "appointment_id", "appt_a"),
]


@pytest.mark.parametrize("path,key,item", CLINICAL)
def test_linked_doctor_sees_own_patients_data(client, world, path, key, item):
    rows = client.get(path, headers=auth(world.uids["doctor"])).json()
    assert world.ids[item] in [r[key] for r in rows]
    assert client.get(f"{path}{world.ids[item]}", headers=auth(world.uids["doctor"])).status_code == 200


@pytest.mark.parametrize("uid_key", ["doctor2", "doctor_unlinked"])
@pytest.mark.parametrize("path,key,item", CLINICAL)
def test_other_or_unlinked_doctor_sees_nothing(client, world, uid_key, path, key, item):
    h = auth(world.uids[uid_key])
    r = client.get(path, headers=h)
    assert r.status_code == 200 and r.json() == []
    assert client.get(f"{path}{world.ids[item]}", headers=h).status_code == 404


def test_doctor_sees_only_records_for_their_own_appointments(client, db, world):
    # Give doctor2 an appointment + record for patient A; doctor 1 must not see it.
    appt = Appointment(patient_id=world.ids["patient_a"], doctor_id=world.ids["doctor2"],
                       appointment_date=future_weekday(3), appointment_time=__import__("datetime").time(9, 0),
                       status="completed", created_at=__import__("datetime").datetime.now())
    db.add(appt); db.flush()
    rec = MedicalRecord(appointment_id=appt.appointment_id, diagnosis="Doctor 2 only",
                        record_date=__import__("datetime").datetime.now())
    db.add(rec); db.commit()
    d1 = [r["record_id"] for r in client.get("/medical-records/", headers=auth(world.uids["doctor"])).json()]
    d2 = [r["record_id"] for r in client.get("/medical-records/", headers=auth(world.uids["doctor2"])).json()]
    assert rec.record_id not in d1 and world.ids["record_a"] in d1
    assert d2 == [rec.record_id]
    assert client.get(f"/medical-records/{rec.record_id}", headers=auth(world.uids["doctor"])).status_code == 404


def test_other_doctor_cannot_write_clinical_data(client, world):
    h = auth(world.uids["doctor2"])
    assert client.patch(f"/medical-records/{world.ids['record_a']}", headers=h, json={"diagnosis": "x"}).status_code == 404
    assert client.post("/medical-records/", headers=h, json={"appointment_id": world.ids["appt_a"]}).status_code == 404
    assert client.post("/prescriptions/", headers=h, json={"record_id": world.ids["record_a"]}).status_code == 404
    assert client.patch(f"/prescriptions/{world.ids['rx_a']}", headers=h, json={"instructions": "x"}).status_code == 404
    item = {"prescription_id": world.ids["rx_a"], "medicine_id": world.ids["medicine"], "dosage": "1",
            "frequency": "daily", "duration": "1 day", "quantity": 1}
    assert client.post("/prescription-items/", headers=h, json=item).status_code == 404
    assert client.patch(f"/prescription-items/{world.ids['item_a']}", headers=h, json={"quantity": 2}).status_code == 404
    assert client.delete(f"/prescription-items/{world.ids['item_a']}", headers=h).status_code == 404


def test_linked_doctor_can_write_own_clinical_data(client, db, world):
    h = auth(world.uids["doctor"])
    assert client.patch(f"/medical-records/{world.ids['record_a']}", headers=h, json={"diagnosis": "Updated"}).status_code == 200
    rx = client.post("/prescriptions/", headers=h, json={"record_id": world.ids["record_a"], "instructions": "New"})
    assert rx.status_code == 201
    assert client.patch(f"/prescription-items/{world.ids['item_a']}", headers=h, json={"quantity": 12}).status_code == 200


def test_admin_and_pharmacist_are_not_doctor_scoped(client, world):
    for role in ("admin", "pharmacist"):
        ids = [r["prescription_id"] for r in client.get("/prescriptions/", headers=auth(world.uids[role])).json()]
        assert {world.ids["rx_a"], world.ids["rx_b"]} <= set(ids)


def test_query_filter_cannot_widen_doctor_scope(client, world):
    rows = client.get("/appointments/", params={"doctor_id": world.ids["doctor"]},
                      headers=auth(world.uids["doctor2"])).json()
    assert rows == []


# ── Linking ───────────────────────────────────────────────────────────────────

def test_admin_links_doctor_account_and_access_follows(client, world):
    uid = world.uids["doctor_unlinked"]
    assert client.get("/medical-records/", headers=auth(uid)).json() == []
    r = client.patch(f"/auth/users/{uid}/link-doctor", headers=auth(world.uids["admin"]),
                     json={"doctor_id": world.ids["doctor2"]})
    assert r.status_code == 409  # doctor2 already linked to UID_DOCTOR2
    client.patch(f"/auth/users/{world.uids['doctor']}/link-doctor", headers=auth(world.uids["admin"]), json={"doctor_id": None})
    r = client.patch(f"/auth/users/{uid}/link-doctor", headers=auth(world.uids["admin"]), json={"doctor_id": world.ids["doctor"]})
    assert r.status_code == 200 and r.json()["doctor_id"] == world.ids["doctor"]
    assert world.ids["record_a"] in [x["record_id"] for x in client.get("/medical-records/", headers=auth(uid)).json()]
    # The previously linked account lost access when it was unlinked.
    assert client.get("/medical-records/", headers=auth(world.uids["doctor"])).json() == []


@pytest.mark.parametrize("role", ["doctor", "receptionist", "patient_a", "user"])
def test_only_admin_can_link_doctors(client, world, role):
    uid = world.uids[role]
    r = client.patch(f"/auth/users/{uid}/link-doctor", headers=auth(uid), json={"doctor_id": world.ids["doctor2"]})
    assert r.status_code == 403


def test_link_unknown_doctor_or_user(client, world):
    h = auth(world.uids["admin"])
    assert client.patch(f"/auth/users/{world.uids['doctor_unlinked']}/link-doctor", headers=h, json={"doctor_id": 999999}).status_code == 404
    assert client.patch("/auth/users/NOPE/link-doctor", headers=h, json={"doctor_id": world.ids["doctor"]}).status_code == 404


def test_me_reports_doctor_link(client, world):
    assert client.get("/auth/me", headers=auth(world.uids["doctor"])).json()["doctor_id"] == world.ids["doctor"]
    assert client.get("/auth/me", headers=auth(world.uids["doctor_unlinked"])).json()["doctor_id"] is None
