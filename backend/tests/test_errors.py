"""Error responses are predictable and never leak internals."""
import pytest
from fastapi import APIRouter

from app.main import app
from tests.factories import auth


@pytest.mark.parametrize("path", [
    "/patients/99999999999999999999",
    "/patients/-1",
    "/patients/abc",
    "/appointments/0",
])
def test_bad_ids_are_422_not_500(client, world, path):
    r = client.get(path, headers=auth(world.uids["admin"]))
    assert r.status_code == 422


def test_malformed_json_is_422(client, world):
    r = client.post("/patients/", headers={**auth(world.uids["admin"]), "Content-Type": "application/json"},
                    content=b"{not json")
    assert r.status_code == 422


def test_unexpected_exception_returns_generic_json_500(client):
    router = APIRouter()

    @router.get("/__boom")
    def boom():
        raise RuntimeError("database password is hunter2")

    app.include_router(router)
    r = client.get("/__boom")
    assert r.status_code == 500
    assert r.json() == {"detail": "An unexpected error occurred."}
    assert "hunter2" not in r.text and "Traceback" not in r.text


def test_cors_allows_configured_origin_only(client):
    ok = client.options("/departments/", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/departments/", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


def test_health(client):
    assert client.get("/health").json() == {"status": "ok", "database": "connected"}


def test_production_settings_reject_unsafe_values():
    from pydantic import ValidationError

    from app.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(app_env="production", database_url="postgresql://x/y", allowed_origins="*")
    with pytest.raises(ValidationError):
        Settings(app_env="production", database_url="postgresql://x/y",
                 allowed_origins="http://localhost:5173")
    with pytest.raises(ValidationError):
        Settings(app_env="production", database_url="postgresql://x/y",
                 allowed_origins="https://meditrack.example", db_echo=True)
    ok = Settings(app_env="production", database_url="postgresql://x/y",
                  allowed_origins="https://meditrack.example", db_echo=False)
    assert ok.cors_origins == ["https://meditrack.example"]


def test_production_refuses_auth_emulator(monkeypatch):
    from pydantic import ValidationError

    from app.core.config import Settings

    monkeypatch.setenv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099")
    with pytest.raises(ValidationError, match="FIREBASE_AUTH_EMULATOR_HOST"):
        Settings(app_env="production", database_url="postgresql://x/y",
                 allowed_origins="https://meditrack.example", db_echo=False)
    # Development still allows it for local testing.
    assert Settings(app_env="development", database_url="postgresql://x/y").app_env == "development"
