"""Role management and deny-by-default authorization."""
import asyncio

import pytest
from fastapi import HTTPException

from app.auth.dependencies import allow_patient_or, require_permission
from app.auth.permissions import ROLE_PERMISSIONS, has_permission
from app.models.user_profile import UserProfile
from tests.factories import STAFF, auth


def test_admin_can_assign_any_role(client, world):
    target = world.uids["user"]
    for role in ("patient", "doctor", "pharmacist", "receptionist", "accountant", "user"):
        r = client.patch(f"/auth/users/{target}/role", headers=auth(world.uids["admin"]), json={"role": role})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == role


@pytest.mark.parametrize("role", ["receptionist", "doctor", "pharmacist", "accountant", "patient_a", "user"])
def test_non_admin_cannot_change_roles_or_list_users(client, world, role):
    uid = world.uids[role]
    r = client.patch(f"/auth/users/{uid}/role", headers=auth(uid), json={"role": "admin"})
    assert r.status_code == 403
    assert client.get("/auth/users", headers=auth(uid)).status_code == 403
    r = client.patch(f"/auth/users/{uid}/link-patient", headers=auth(uid), json={"patient_id": world.ids["patient_b"]})
    assert r.status_code == 403
    me = client.get("/auth/me", headers=auth(uid)).json()
    assert me["role"] != "admin"


def test_invalid_role_rejected(client, world):
    r = client.patch(f"/auth/users/{world.uids['user']}/role",
                     headers=auth(world.uids["admin"]), json={"role": "superuser"})
    assert r.status_code == 422


def test_unknown_user_404(client, world):
    r = client.patch("/auth/users/NOPE/role", headers=auth(world.uids["admin"]), json={"role": "patient"})
    assert r.status_code == 404


def test_admin_cannot_demote_self(client, world):
    admin = world.uids["admin"]
    r = client.patch(f"/auth/users/{admin}/role", headers=auth(admin), json={"role": "user"})
    assert r.status_code == 409


def test_last_admin_cannot_be_demoted(client, db, world):
    from tests.factories import make_profile
    make_profile(db, "SECOND_ADMIN", "admin")
    # Second admin demotes the first: allowed while two admins exist.
    r = client.patch(f"/auth/users/{world.uids['admin']}/role", headers=auth("SECOND_ADMIN"), json={"role": "doctor"})
    assert r.status_code == 200
    # The remaining admin cannot be demoted by anyone (only they are admin; self-demotion blocked).
    r = client.patch("/auth/users/SECOND_ADMIN/role", headers=auth("SECOND_ADMIN"), json={"role": "doctor"})
    assert r.status_code == 409


def test_role_change_takes_effect_on_next_request(client, world):
    uid = world.uids["user"]
    assert client.get("/patients/", headers=auth(uid)).status_code == 403
    client.patch(f"/auth/users/{uid}/role", headers=auth(world.uids["admin"]), json={"role": "receptionist"})
    assert client.get("/patients/", headers=auth(uid)).status_code == 200
    client.patch(f"/auth/users/{uid}/role", headers=auth(world.uids["admin"]), json={"role": "user"})
    assert client.get("/patients/", headers=auth(uid)).status_code == 403


def test_demoting_patient_to_user_clears_link(client, world):
    uid = world.uids["patient_a"]
    r = client.patch(f"/auth/users/{uid}/role", headers=auth(world.uids["admin"]), json={"role": "user"})
    assert r.json()["patient_id"] is None


def test_matrix_covers_every_role_and_user_has_nothing():
    assert set(ROLE_PERMISSIONS) == {"user", "patient", *STAFF}
    assert ROLE_PERMISSIONS["user"] == frozenset()
    assert ROLE_PERMISSIONS["patient"] == frozenset()


@pytest.mark.parametrize("role", ["superuser", "", None, "ADMIN", "admin "])
def test_unknown_roles_hold_no_permissions(role):
    assert not has_permission(role, "patients:read")
    fake = UserProfile(firebase_uid="X", role=role)
    for dep in (require_permission("patients:read"), allow_patient_or("patients:read")):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(dep(fake))
        assert exc.value.status_code == 403


def test_unknown_permission_name_is_a_programming_error():
    with pytest.raises(ValueError):
        require_permission("patients:raed")
