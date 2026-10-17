"""Authentication: token handling, profile provisioning, registration."""
import pytest

import app.auth.dependencies as auth_deps
from app.models.user_profile import UserProfile
from tests.factories import auth, make_profile

PROTECTED = [
    ("get", "/auth/me"),
    ("get", "/patients/"),
    ("get", "/appointments/"),
    ("get", "/medical-records/"),
    ("get", "/bills/"),
    ("post", "/appointments/book"),
    ("post", "/auth/register"),
]


@pytest.mark.parametrize("method,path", PROTECTED)
def test_missing_token_is_401(client, method, path):
    r = getattr(client, method)(path)
    assert r.status_code == 401
    assert r.headers.get("www-authenticate") == "Bearer"


@pytest.mark.parametrize("header", ["Token abc", "Bearer", "Basic dXNlcjpwYXNz", ""])
def test_malformed_authorization_header_is_401(client, header):
    r = client.get("/auth/me", headers={"Authorization": header})
    assert r.status_code == 401


@pytest.mark.parametrize("token,message", [
    ("expired", "expired"),
    ("revoked", "revoked"),
    ("disabled", "disabled"),
    ("not-a-jwt", "Invalid authentication token."),
])
def test_bad_tokens_rejected_without_leaking_internals(client, token, message):
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    detail = r.json()["detail"]
    assert message in detail
    assert "secret-internal" not in detail and "segments" not in detail


def test_certificate_fetch_failure_is_503(client):
    r = client.get("/auth/me", headers={"Authorization": "Bearer certs"})
    assert r.status_code == 503


def test_firebase_not_configured_is_503(client, monkeypatch):
    monkeypatch.setattr(auth_deps, "_is_firebase_configured", lambda: False)
    r = client.get("/auth/me", headers=auth("ANY"))
    assert r.status_code == 503
    assert "FIREBASE" not in r.json()["detail"]


def test_first_request_provisions_user_role(client, db, fake_firebase):
    fake_firebase["NEW_UID"] = {"email": "new@test.invalid", "name": "New Person"}
    r = client.get("/auth/me", headers=auth("NEW_UID"))
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "user"
    assert body["patient_id"] is None
    assert body["permissions"] == []
    assert body["email"] == "new@test.invalid"
    assert db.get(UserProfile, "NEW_UID").role == "user"


def test_register_uses_token_uid_and_ignores_body_identity(client, db, fake_firebase):
    fake_firebase["REAL_UID"] = {"email": "real@test.invalid"}
    make_profile(db, "VICTIM_UID", "admin", name="Victim Admin")
    r = client.post(
        "/auth/register",
        headers=auth("REAL_UID"),
        json={"firebase_uid": "VICTIM_UID", "display_name": "Mallory",
              "email": "attacker@test.invalid", "role": "admin", "patient_id": 1},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["firebase_uid"] == "REAL_UID"
    assert body["role"] == "user"
    assert body["patient_id"] is None
    assert body["email"] == "real@test.invalid"
    db.expire_all()
    victim = db.get(UserProfile, "VICTIM_UID")
    assert victim.display_name == "Victim Admin"
    assert victim.email == "victim_uid@test.invalid"


def test_register_is_idempotent_and_never_changes_role(client, db):
    make_profile(db, "DOC_UID", "doctor", name="Existing Name")
    r = client.post("/auth/register", headers=auth("DOC_UID"), json={"display_name": "Other"})
    assert r.status_code == 200
    assert r.json()["role"] == "doctor"
    assert r.json()["display_name"] == "Existing Name"


def test_register_without_body(client):
    r = client.post("/auth/register", headers=auth("BODYLESS"))
    assert r.status_code == 201
    assert r.json()["role"] == "user"


def test_email_synced_from_token(client, db, fake_firebase):
    make_profile(db, "SYNC_UID", "patient")
    fake_firebase["SYNC_UID"] = {"email": "changed@test.invalid"}
    assert client.get("/auth/me", headers=auth("SYNC_UID")).json()["email"] == "changed@test.invalid"


def test_display_name_patch_is_not_overwritten_by_token(client, db, fake_firebase):
    make_profile(db, "NAME_UID", "patient", name="Original")
    fake_firebase["NAME_UID"] = {"name": "Token Name"}
    r = client.patch("/auth/me", headers=auth("NAME_UID"), json={"display_name": "  Chosen  "})
    assert r.status_code == 200 and r.json()["display_name"] == "Chosen"
    assert client.get("/auth/me", headers=auth("NAME_UID")).json()["display_name"] == "Chosen"


def test_patch_me_cannot_change_role(client, db):
    make_profile(db, "SELF_UID", "user")
    r = client.patch("/auth/me", headers=auth("SELF_UID"), json={"role": "admin", "patient_id": 1})
    assert r.status_code == 200
    assert r.json()["role"] == "user" and r.json()["patient_id"] is None


def test_me_reports_permissions(client, world):
    body = client.get("/auth/me", headers=auth(world.uids["pharmacist"])).json()
    assert "medicines:write" in body["permissions"]
    assert "bills:read" not in body["permissions"]
