"""Set a role in the *_test* database (bootstraps the first admin, like create_admin.py). Test DB only."""
import os
import sys
from pathlib import Path

os.environ["DB_ECHO"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from app.core.config import settings  # noqa: E402

dev = make_url(settings.database_url)
test = make_url(os.getenv("TEST_DATABASE_URL") or dev.set(database=f"{dev.database}_test"))
if test.database == dev.database or not test.database.endswith("_test"):
    sys.exit("Refusing: not a *_test database.")
uid, role = sys.argv[1], sys.argv[2]
with create_engine(test).begin() as c:
    n = c.execute(text("UPDATE user_profiles SET role=:r WHERE firebase_uid=:u"), {"r": role, "u": uid}).rowcount
print(f"updated {n}")
