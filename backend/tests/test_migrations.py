"""
`python -m migrations` against the isolated test database: it upgrades an
older schema without touching rows, and is a no-op on a current one.
"""
from datetime import datetime

from sqlalchemy import inspect, text

from app.database.connection import engine
from migrations.__main__ import main as migrate


def _schema():
    insp = inspect(engine)
    indexes = {i["name"] for t in insp.get_table_names() for i in insp.get_indexes(t)}
    with engine.connect() as conn:
        constraints = set(conn.execute(text("SELECT conname FROM pg_constraint")).scalars())
    return set(insp.get_table_names()), {c["name"] for c in insp.get_columns("user_profiles")}, indexes, constraints


def test_current_schema_is_a_no_op_and_repeatable(capsys):
    before = _schema()
    migrate()
    migrate()
    assert _schema() == before
    assert "Schema is up to date." in capsys.readouterr().out


def test_upgrades_an_older_schema_and_keeps_rows():
    current = _schema()
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO user_profiles (firebase_uid, role, created_at) VALUES ('MIGRATE_KEEP', 'admin', :t)"),
            {"t": datetime.now()})
        # Roll the schema back to before doctor links, ownership guards and Stripe.
        conn.execute(text("DROP TABLE stripe_events, bill_payments"))
        conn.execute(text("ALTER TABLE user_profiles DROP COLUMN doctor_id"))
        conn.execute(text("DROP INDEX uq_appointments_doctor_active_slot"))
        conn.execute(text("ALTER TABLE user_profiles DROP CONSTRAINT ck_user_profiles_role"))

    migrate()

    assert _schema() == current
    with engine.connect() as conn:
        assert conn.execute(text(
            "SELECT role FROM user_profiles WHERE firebase_uid = 'MIGRATE_KEEP'")).scalar() == "admin"
