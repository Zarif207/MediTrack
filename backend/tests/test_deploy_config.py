"""Hosting configuration: Vercel's serverless runtime and env-var credentials."""
import json

import firebase_admin
from pydantic import SecretStr
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from app.auth import firebase as firebase_module
from app.core.config import Settings, settings
from app.database.connection import engine, engine_options


def _settings(**kw):
    return Settings(_env_file=None, database_url="postgresql://u:p@h/db", **kw)


def test_long_running_server_keeps_a_connection_pool(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    options = engine_options(_settings())
    assert "poolclass" not in options and options["hide_parameters"] is True


def test_serverless_uses_no_local_pool_and_no_prepared_statements(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    options = engine_options(_settings())
    assert options["poolclass"] is NullPool
    assert options["connect_args"] == {"prepare_threshold": None}


def test_serverless_options_work_against_postgres(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    serverless = create_engine(engine.url, **engine_options(settings))
    try:
        with serverless.begin() as conn:
            # Booking relies on transaction-scoped advisory locks, which are
            # safe behind a transaction-mode pooler.
            conn.execute(text("SELECT pg_advisory_xact_lock(7301, 1)"))
            for _ in range(8):  # beyond psycopg's default prepare threshold (5)
                assert conn.execute(text("SELECT :x"), {"x": 1}).scalar() == 1
    finally:
        serverless.dispose()


def test_service_account_json_from_environment(monkeypatch):
    account = {"type": "service_account", "project_id": "meditrack-7fe46", "private_key": "-----FAKE-----"}
    seen = {}
    monkeypatch.setattr(firebase_admin, "_apps", {})
    monkeypatch.setattr(firebase_module.credentials, "Certificate", lambda value: seen.setdefault("cert", value))
    monkeypatch.setattr(firebase_admin, "initialize_app", lambda cred=None, options=None: seen.update(options=options))
    monkeypatch.setattr(settings, "firebase_service_account_json", SecretStr(json.dumps(account)))
    monkeypatch.setattr(settings, "firebase_service_account_path", "/should/not/be/used.json")

    firebase_module.initialize_firebase()

    assert seen["cert"] == account
    assert seen["options"] == {"projectId": settings.firebase_project_id}
    # The secret never appears in the settings' repr or logs.
    assert "FAKE" not in repr(settings)


def test_bad_service_account_json_aborts_production_startup(monkeypatch):
    import pytest

    monkeypatch.setattr(firebase_admin, "_apps", {})
    monkeypatch.setattr(settings, "firebase_service_account_json", SecretStr("{not json"))
    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(RuntimeError, match="could not be initialised"):
        firebase_module.initialize_firebase()
