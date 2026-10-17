"""
Real Firebase ID tokens, issued by the Firebase Auth Emulator.

These tests do not replace the token verifier: requests go through the real
firebase_admin.auth.verify_id_token(token, check_revoked=True), pointed at the
local emulator. Production Firebase is never contacted.

Limitation (verified in firebase_admin/_token_gen.py): in emulator mode the
Admin SDK skips signature AND expiry verification and checks only audience,
issuer and subject. Forged signatures and expired tokens therefore cannot be
tested here; expiry handling is covered by test_auth.py and enforced by
Google's verifier in production. Revocation and disabled accounts are checked
against the emulator and are covered below.

Run:
    npx firebase-tools emulators:start --only auth --project meditrack-7fe46
    FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 python -m pytest tests/test_firebase_emulator.py -v

Skipped automatically when FIREBASE_AUTH_EMULATOR_HOST is not set.
"""
import base64
import functools
import json
import os
import time
import uuid

import firebase_admin
import httpx
import pytest
from firebase_admin import auth as admin_auth

import app.auth.dependencies as auth_deps
from app.core.config import settings
from app.models.user_profile import UserProfile
from tests.factories import future_weekday

EMULATOR = os.getenv("FIREBASE_AUTH_EMULATOR_HOST")
PROJECT = settings.firebase_project_id

pytestmark = [
    pytest.mark.firebase_emulator,
    pytest.mark.skipif(not EMULATOR, reason="FIREBASE_AUTH_EMULATOR_HOST not set"),
]

ID_TOOLKIT = f"http://{EMULATOR}/identitytoolkit.googleapis.com/v1"
SECURE_TOKEN = f"http://{EMULATOR}/securetoken.googleapis.com/v1"
KEY = {"key": "emulator-api-key"}  # the emulator accepts any API key


@pytest.fixture(scope="module")
def emulator_app():
    # A dedicated, credential-less app: with FIREBASE_AUTH_EMULATOR_HOST set the
    # SDK talks only to the emulator and accepts its unsigned tokens.
    app = firebase_admin.initialize_app(options={"projectId": PROJECT}, name=f"emulator-{uuid.uuid4().hex[:6]}")
    yield app
    httpx.delete(f"http://{EMULATOR}/emulator/v1/projects/{PROJECT}/accounts")
    firebase_admin.delete_app(app)


@pytest.fixture(autouse=True)
def real_verifier(emulator_app, monkeypatch):
    real = admin_auth.verify_id_token
    monkeypatch.setattr(auth_deps.firebase_auth, "verify_id_token", functools.partial(real, app=emulator_app))
    monkeypatch.setattr(auth_deps, "_is_firebase_configured", lambda: True)


def sign_up(email=None, password="Emulator-Pass-123"):
    email = email or f"e2e-{uuid.uuid4().hex[:8]}@example.com"
    r = httpx.post(f"{ID_TOOLKIT}/accounts:signUp", params=KEY,
                   json={"email": email, "password": password, "returnSecureToken": True})
    r.raise_for_status()
    return {**r.json(), "email": email, "password": password}


def sign_in(email, password):
    r = httpx.post(f"{ID_TOOLKIT}/accounts:signInWithPassword", params=KEY,
                   json={"email": email, "password": password, "returnSecureToken": True})
    r.raise_for_status()
    return r.json()


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_sign_up_then_register_creates_user_role_profile(client, db):
    acct = sign_up()
    r = client.post("/auth/register", headers=bearer(acct["idToken"]),
                    json={"display_name": "Emulator Person", "firebase_uid": "SPOOFED", "role": "admin"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["firebase_uid"] == acct["localId"]
    assert body["email"] == acct["email"]
    assert body["role"] == "user" and body["permissions"] == []
    assert db.get(UserProfile, "SPOOFED") is None
    # Idempotent on the next sign-in.
    again = sign_in(acct["email"], acct["password"])
    assert client.post("/auth/register", headers=bearer(again["idToken"])).status_code == 200


def _with_claims(token, **changes):
    header, payload, sig = token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    claims.update(changes)
    body = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    return f"{header}.{body}.{sig}"


def test_protected_calls_need_a_valid_token(client):
    acct = sign_up()
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=bearer("not-a-jwt")).status_code == 401
    other_project = _with_claims(acct["idToken"], aud="another-project",
                                 iss="https://securetoken.google.com/another-project")
    assert client.get("/auth/me", headers=bearer(other_project)).status_code == 401
    assert client.get("/auth/me", headers=bearer(acct["idToken"])).status_code == 200


def test_refreshed_token_is_accepted(client):
    acct = sign_up()
    time.sleep(1.1)  # a refreshed token issued in the same second would be identical
    r = httpx.post(f"{SECURE_TOKEN}/token", params=KEY,
                   data={"grant_type": "refresh_token", "refresh_token": acct["refreshToken"]})
    r.raise_for_status()
    fresh = r.json()["id_token"]
    assert fresh != acct["idToken"]
    assert client.get("/auth/me", headers=bearer(fresh)).json()["firebase_uid"] == acct["localId"]


def test_revoked_session_is_rejected_until_new_sign_in(client, emulator_app):
    acct = sign_up()
    assert client.get("/auth/me", headers=bearer(acct["idToken"])).status_code == 200
    time.sleep(1.1)  # revocation compares whole seconds
    admin_auth.revoke_refresh_tokens(acct["localId"], app=emulator_app)
    r = client.get("/auth/me", headers=bearer(acct["idToken"]))
    assert r.status_code == 401 and "revoked" in r.json()["detail"]
    time.sleep(1.1)
    new = sign_in(acct["email"], acct["password"])
    assert client.get("/auth/me", headers=bearer(new["idToken"])).status_code == 200


def test_disabled_account_is_rejected(client, emulator_app):
    acct = sign_up()
    admin_auth.update_user(acct["localId"], disabled=True, app=emulator_app)
    r = client.get("/auth/me", headers=bearer(acct["idToken"]))
    assert r.status_code == 401 and "disabled" in r.json()["detail"]


def test_role_comes_from_database_and_patient_can_book(client, db, world):
    # Bootstrap an admin the way create_admin.py does, then use real tokens only.
    admin = sign_up()
    client.post("/auth/register", headers=bearer(admin["idToken"]))
    db.get(UserProfile, admin["localId"]).role = "admin"
    db.commit()

    acct = sign_up()
    h = bearer(acct["idToken"])
    client.post("/auth/register", headers=h)
    slot = {"doctor_id": world.ids["doctor"], "appointment_date": future_weekday(7).isoformat(),
            "appointment_time": "10:00"}
    assert client.post("/appointments/book", headers=h, json=slot).status_code == 403

    # The new account cannot promote itself; the admin can.
    assert client.patch(f"/auth/users/{acct['localId']}/role", headers=h, json={"role": "admin"}).status_code == 403
    r = client.patch(f"/auth/users/{acct['localId']}/role", headers=bearer(admin["idToken"]), json={"role": "patient"})
    assert r.status_code == 200

    # The same token now carries patient access: roles are read from the database.
    booked = client.post("/appointments/book", headers=h, json=slot)
    assert booked.status_code == 201, booked.text
    assert booked.json()["firebase_uid"] == acct["localId"] and booked.json()["patient_id"] is None
    mine = client.get("/appointments/", headers=h).json()
    assert [a["appointment_id"] for a in mine] == [booked.json()["appointment_id"]]
