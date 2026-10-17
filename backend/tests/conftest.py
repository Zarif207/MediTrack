"""
Test-suite bootstrap.

All tests run against an ISOLATED PostgreSQL database, never the development
database. The test database URL is taken from TEST_DATABASE_URL, or derived
from DATABASE_URL by appending "_test" to the database name
(meditrack_db -> meditrack_db_test).

The test database is created if missing and its schema is rebuilt from the
SQLAlchemy models at the start of every session, so tests never depend on —
or touch — real project data.

This module must run before anything imports app.database.connection, which
pytest guarantees for conftest.py.
"""
import os

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

os.environ.setdefault("DB_ECHO", "false")
os.environ.setdefault("APP_ENV", "test")

from app.core.config import settings  # noqa: E402

_dev_url = make_url(settings.database_url)
_test_url = make_url(
    os.getenv("TEST_DATABASE_URL")
    or _dev_url.set(database=f"{_dev_url.database}_test")
)

if _test_url.database == _dev_url.database or not _test_url.database.endswith("_test"):
    raise RuntimeError(
        "Refusing to run tests: the test database name must end in '_test' and "
        "differ from the development database."
    )

# Point the application at the test database before its engine is created.
settings.database_url = _test_url.render_as_string(hide_password=False)


def _ensure_test_database() -> None:
    admin_engine = create_engine(
        _test_url.set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": _test_url.database},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{_test_url.database}"'))
    admin_engine.dispose()


_ensure_test_database()

import pytest  # noqa: E402


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "firebase_emulator: uses the Firebase Auth Emulator (FIREBASE_AUTH_EMULATOR_HOST) "
        "instead of the fake token verifier",
    )

import app.models  # noqa: E402,F401  (registers all tables)
from app.database.base import Base  # noqa: E402
from app.database.connection import engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402

assert engine.url.database == _test_url.database


@pytest.fixture(scope="session", autouse=True)
def _fresh_schema():
    """Rebuild the schema in the isolated test database once per session."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    fastapi_app.dependency_overrides.clear()
    yield
    fastapi_app.dependency_overrides.clear()


# ── Per-test isolation ────────────────────────────────────────────────────────

from sqlalchemy.orm import Session  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from firebase_admin import auth as firebase_auth  # noqa: E402

import app.auth.dependencies as auth_deps  # noqa: E402


@pytest.fixture(autouse=True)
def _truncate_after_test():
    yield
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


# ── Fake Firebase token verification ─────────────────────────────────────────
#
# Only the Firebase network call is replaced. The real verify_firebase_token,
# get_current_user and permission dependencies run against the test database.
#
#   "uid:<UID>"   → valid token for <UID>
#   "expired" / "revoked" / "disabled" / "certs" / anything else → failures

TOKEN_CLAIMS: dict[str, dict] = {}


def _fake_verify_id_token(token, check_revoked=False, **_):
    if token.startswith("uid:"):
        uid = token[4:]
        return {"uid": uid, **TOKEN_CLAIMS.get(uid, {})}
    if token == "expired":
        raise firebase_auth.ExpiredIdTokenError("Token expired at 123", None)
    if token == "revoked":
        raise firebase_auth.RevokedIdTokenError("The Firebase ID token has been revoked.")
    if token == "disabled":
        raise firebase_auth.UserDisabledError("The user record is disabled.")
    if token == "certs":
        raise firebase_auth.CertificateFetchError("Failed to fetch certs", None)
    raise firebase_auth.InvalidIdTokenError("Wrong number of segments in token: b'secret-internal'")


@pytest.fixture(autouse=True)
def fake_firebase(request, monkeypatch):
    TOKEN_CLAIMS.clear()
    if request.node.get_closest_marker("firebase_emulator"):
        # Real Admin SDK verification against the local Auth Emulator.
        yield TOKEN_CLAIMS
        return
    monkeypatch.setattr(auth_deps.firebase_auth, "verify_id_token", _fake_verify_id_token)
    monkeypatch.setattr(auth_deps, "_is_firebase_configured", lambda: True)
    yield TOKEN_CLAIMS


@pytest.fixture
def client():
    return TestClient(fastapi_app, raise_server_exceptions=False)


@pytest.fixture
def db():
    with Session(engine) as session:
        yield session


def auth(uid: str) -> dict:
    return {"Authorization": f"Bearer uid:{uid}"}


@pytest.fixture
def world(db):
    from tests.factories import build_world

    return build_world(db)
