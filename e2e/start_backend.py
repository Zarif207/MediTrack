"""
Start the API for browser end-to-end tests.

- Uses the ISOLATED test database (DATABASE_URL name + "_test"); refuses anything else.
- Rebuilds that database's schema and seeds synthetic departments/doctors.
- Requires FIREBASE_AUTH_EMULATOR_HOST, so tokens come from the local Auth
  Emulator and production Firebase is never contacted.

Run from the repository root:
    cd backend && FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 .venv/bin/python ../e2e/start_backend.py
"""
import os
import sys
from pathlib import Path

if not os.getenv("FIREBASE_AUTH_EMULATOR_HOST"):
    sys.exit("Set FIREBASE_AUTH_EMULATOR_HOST (e.g. 127.0.0.1:9099) first.")
os.environ["DB_ECHO"] = "false"
os.environ["APP_ENV"] = "test"
PORT = int(os.getenv("E2E_API_PORT", "8001"))
os.environ.setdefault("ALLOWED_ORIGINS", f"http://localhost:{os.getenv('E2E_APP_PORT', '5174')}")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy.engine import make_url  # noqa: E402

from app.core.config import settings  # noqa: E402

dev = make_url(settings.database_url)
test = make_url(os.getenv("TEST_DATABASE_URL") or dev.set(database=f"{dev.database}_test"))
if test.database == dev.database or not test.database.endswith("_test"):
    sys.exit("Refusing to run: the database must be a *_test database.")
settings.database_url = test.render_as_string(hide_password=False)

if os.getenv("E2E_FAKE_STRIPE"):
    import stripe  # noqa: E402

    import fake_stripe  # noqa: E402

    fake_stripe.install(settings, stripe)

import uvicorn  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

admin = create_engine(test.set(database="postgres"), isolation_level="AUTOCOMMIT")
with admin.connect() as c:
    if not c.execute(text("SELECT 1 FROM pg_database WHERE datname=:n"), {"n": test.database}).scalar():
        c.execute(text(f'CREATE DATABASE "{test.database}"'))
admin.dispose()

import app.models  # noqa: E402,F401
from app.database.base import Base  # noqa: E402
from app.database.connection import engine  # noqa: E402
from app.main import app  # noqa: E402

assert engine.url.database == test.database
from seed import seed  # noqa: E402

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
seed(engine)
print(f"E2E API on :{PORT}, {test.database}, fake Stripe={bool(os.getenv('E2E_FAKE_STRIPE'))} (emulator {os.environ['FIREBASE_AUTH_EMULATOR_HOST']})", flush=True)
uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
