"""
The documented permission matrix, verified endpoint by endpoint for every role.

Allowed requests are sent with an empty / missing body or a non-existent ID, so
an allowed role gets 422 or 404 (never 401/403) and a denied role gets 403.
"""
import pytest

from tests.factories import auth

ROLES = ("admin", "receptionist", "doctor", "pharmacist", "accountant", "patient_a", "user")

# path → roles that may list it (patients get their own rows)
READ = {
    "/patients/":           {"admin", "receptionist", "doctor", "accountant", "patient_a"},
    "/appointments/":       {"admin", "receptionist", "doctor", "accountant", "patient_a"},
    "/medical-records/":    {"admin", "doctor", "patient_a"},
    "/medicines/":          {"admin", "doctor", "pharmacist"},
    "/prescriptions/":      {"admin", "doctor", "pharmacist", "patient_a"},
    "/prescription-items/": {"admin", "doctor", "pharmacist", "patient_a"},
    "/bills/":              {"admin", "receptionist", "accountant", "patient_a"},
    "/auth/users":          {"admin"},
    "/departments/":        set(ROLES),
    "/doctors/":            set(ROLES),
}

CREATE = {
    "/patients/":           {"admin", "receptionist"},
    "/departments/":        {"admin"},
    "/doctors/":            {"admin"},
    "/appointments/":       {"admin", "receptionist"},
    "/appointments/book":   {"patient_a"},
    "/medical-records/":    {"admin", "doctor"},
    "/medicines/":          {"admin", "pharmacist"},
    "/prescriptions/":      {"admin", "doctor"},
    "/prescription-items/": {"admin", "doctor"},
    "/bills/":              {"admin", "receptionist", "accountant"},
}

UPDATE = {
    "/patients/999999":           {"admin", "receptionist"},
    "/departments/999999":        {"admin"},
    "/doctors/999999":            {"admin"},
    "/appointments/999999":       {"admin", "receptionist"},
    "/medical-records/999999":    {"admin", "doctor"},
    "/medicines/999999":          {"admin", "pharmacist"},
    "/prescriptions/999999":      {"admin", "doctor"},
    "/prescription-items/999999": {"admin", "doctor"},
    "/bills/999999":              {"admin", "receptionist", "accountant"},
}

DELETE = {
    "/patients/999999":           {"admin"},
    "/departments/999999":        {"admin"},
    "/doctors/999999":            {"admin"},
    "/appointments/999999":       {"admin"},
    "/medical-records/999999":    {"admin"},
    "/medicines/999999":          {"admin"},
    "/prescriptions/999999":      {"admin"},
    "/prescription-items/999999": {"admin", "doctor"},
    "/bills/999999":              {"admin"},
}


def _cases(table):
    return [(path, role, role in allowed) for path, allowed in table.items() for role in ROLES]


@pytest.mark.parametrize("path,role,allowed", _cases(READ))
def test_read(client, world, path, role, allowed):
    r = client.get(path, headers=auth(world.uids[role]))
    assert (r.status_code == 200) if allowed else (r.status_code == 403), (role, path, r.status_code, r.text)


@pytest.mark.parametrize("path,role,allowed", _cases(CREATE))
def test_create(client, world, path, role, allowed):
    r = client.post(path, headers=auth(world.uids[role]), json={})
    assert (r.status_code == 422) if allowed else (r.status_code == 403), (role, path, r.status_code, r.text)


@pytest.mark.parametrize("path,role,allowed", _cases(UPDATE))
def test_update(client, world, path, role, allowed):
    r = client.patch(path, headers=auth(world.uids[role]), json={"reason": "x"})
    assert (r.status_code in (404, 400)) if allowed else (r.status_code == 403), (role, path, r.status_code, r.text)


@pytest.mark.parametrize("path,role,allowed", _cases(DELETE))
def test_delete(client, world, path, role, allowed):
    r = client.delete(path, headers=auth(world.uids[role]))
    assert (r.status_code == 404) if allowed else (r.status_code == 403), (role, path, r.status_code, r.text)


@pytest.mark.parametrize("path", ["/departments/", "/doctors/", "/health"])
def test_public_reads_need_no_token(client, path):
    assert client.get(path).status_code == 200


@pytest.mark.parametrize("path", [p for p in READ if p not in ("/departments/", "/doctors/")])
def test_anonymous_denied(client, path):
    assert client.get(path).status_code == 401


def test_doctor_contact_details_only_for_staff(client, world):
    anon = client.get("/doctors/").json()[0]
    assert set(anon) == {"doctor_id", "department_id", "first_name", "last_name", "specialization"}
    patient = client.get("/doctors/", headers=auth(world.uids["patient_a"])).json()[0]
    assert "license_number" not in patient and "phone" not in patient
    staff = client.get(f"/doctors/{world.ids['doctor']}", headers=auth(world.uids["receptionist"])).json()
    assert staff["license_number"] == "TEST-LIC-1" and staff["phone"]


def test_invalid_token_on_public_endpoint_is_still_rejected(client):
    r = client.get("/doctors/", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401
