"""Patients see only their own clinical data; everything else looks absent."""
import pytest

from tests.factories import auth, future_weekday

RESOURCES = [
    # (list path, id key in response, own-id world key, other-id world key)
    ("/appointments/", "appointment_id", "appt_a", "appt_b"),
    ("/medical-records/", "record_id", "record_a", "record_b"),
    ("/prescriptions/", "prescription_id", "rx_a", "rx_b"),
    ("/prescription-items/", "prescription_item_id", "item_a", "item_b"),
    ("/bills/", "bill_id", "bill_a", "bill_b"),
    ("/patients/", "patient_id", "patient_a", "patient_b"),
]


@pytest.mark.parametrize("path,key,own,other", RESOURCES)
def test_list_returns_only_own_rows(client, world, path, key, own, other):
    rows = client.get(path, headers=auth(world.uids["patient_a"])).json()
    assert [r[key] for r in rows] == [world.ids[own]]


@pytest.mark.parametrize("path,key,own,other", RESOURCES)
def test_detail_of_own_row(client, world, path, key, own, other):
    r = client.get(f"{path}{world.ids[own]}", headers=auth(world.uids["patient_a"]))
    assert r.status_code == 200 and r.json()[key] == world.ids[own]


@pytest.mark.parametrize("path,key,own,other", RESOURCES)
def test_other_patients_rows_look_absent(client, world, path, key, own, other):
    r = client.get(f"{path}{world.ids[other]}", headers=auth(world.uids["patient_a"]))
    assert r.status_code == 404
    # Same answer as for an ID that does not exist at all.
    assert client.get(f"{path}999999", headers=auth(world.uids["patient_a"])).status_code == 404


@pytest.mark.parametrize("path,key,own,other", RESOURCES)
def test_unlinked_patient_gets_empty_lists_not_errors(client, world, path, key, own, other):
    r = client.get(path, headers=auth(world.uids["patient_u"]))
    assert r.status_code == 200 and r.json() == []
    assert client.get(f"{path}{world.ids[own]}", headers=auth(world.uids["patient_u"])).status_code == 404


@pytest.mark.parametrize("path,param", [
    ("/appointments/", "patient_id"),
    ("/bills/", "patient_id"),
])
def test_query_param_cannot_widen_scope(client, world, path, param):
    rows = client.get(path, params={param: world.ids["patient_b"]}, headers=auth(world.uids["patient_a"])).json()
    assert all(r.get("patient_id") in (None, world.ids["patient_a"]) for r in rows)


@pytest.mark.parametrize("path,param,other", [
    ("/medical-records/", "appointment_id", "appt_b"),
    ("/prescriptions/", "record_id", "record_b"),
    ("/prescription-items/", "prescription_id", "rx_b"),
    ("/bills/", "appointment_id", "appt_b"),
])
def test_filters_on_other_patients_ids_return_nothing(client, world, path, param, other):
    r = client.get(path, params={param: world.ids[other]}, headers=auth(world.uids["patient_a"]))
    assert r.status_code == 200 and r.json() == []


def test_patient_cannot_mutate_anything(client, world):
    h = auth(world.uids["patient_a"])
    assert client.patch(f"/appointments/{world.ids['appt_a']}", headers=h, json={"status": "cancelled"}).status_code == 403
    assert client.patch(f"/bills/{world.ids['bill_a']}", headers=h, json={"payment_status": "paid"}).status_code == 403
    assert client.patch(f"/patients/{world.ids['patient_a']}", headers=h, json={"first_name": "X"}).status_code == 403
    assert client.delete(f"/medical-records/{world.ids['record_a']}", headers=h).status_code == 403


def test_records_on_a_uid_booking_become_visible_to_the_booker(client, world):
    """Staff associate an unlinked booking with a record; the booker sees the clinical note."""
    uid = world.uids["patient_u"]
    appt = client.post("/appointments/book", headers=auth(uid), json={
        "doctor_id": world.ids["doctor"], "appointment_date": future_weekday(7).isoformat(),
        "appointment_time": "15:00"}).json()

    # Clinical records require a patient record on the appointment.
    r = client.post("/medical-records/", headers=auth(world.uids["doctor"]),
                    json={"appointment_id": appt["appointment_id"], "diagnosis": "x"})
    assert r.status_code == 409

    new_patient = client.post("/patients/", headers=auth(world.uids["receptionist"]), json={
        "first_name": "Una", "last_name": "Unlinked", "date_of_birth": "1999-09-09",
        "gender": "Female", "phone": "+1 555 0101"}).json()
    r = client.patch(f"/appointments/{appt['appointment_id']}", headers=auth(world.uids["receptionist"]),
                     json={"patient_id": new_patient["patient_id"]})
    assert r.status_code == 200
    rec = client.post("/medical-records/", headers=auth(world.uids["doctor"]),
                      json={"appointment_id": appt["appointment_id"], "diagnosis": "Healthy"})
    assert rec.status_code == 201
    mine = client.get("/medical-records/", headers=auth(uid)).json()
    assert [m["record_id"] for m in mine] == [rec.json()["record_id"]]
    # ...and still none of patient A's or B's.
    assert world.ids["record_a"] not in [m["record_id"] for m in mine]


def test_booking_of_a_linked_account_cannot_be_moved_to_another_patient(client, world):
    appt = client.post("/appointments/book", headers=auth(world.uids["patient_a"]), json={
        "doctor_id": world.ids["doctor"], "appointment_date": future_weekday(7).isoformat(),
        "appointment_time": "15:30"}).json()
    r = client.patch(f"/appointments/{appt['appointment_id']}", headers=auth(world.uids["receptionist"]),
                     json={"patient_id": world.ids["patient_b"]})
    assert r.status_code == 409


def test_prescription_shows_patient_name_to_pharmacist(client, world):
    rows = client.get("/prescriptions/", headers=auth(world.uids["pharmacist"])).json()
    names = {r["prescription_id"]: r["patient_name"] for r in rows}
    assert names[world.ids["rx_a"]] == "Alice Synthetic"


def test_patient_sees_medicine_names_on_own_items(client, world):
    rows = client.get("/prescription-items/", headers=auth(world.uids["patient_a"])).json()
    assert rows[0]["medicine_name"] == "Testamol" and rows[0]["medicine_strength"] == "500mg"
    # Patients still cannot browse the medicine inventory.
    assert client.get("/medicines/", headers=auth(world.uids["patient_a"])).status_code == 403
