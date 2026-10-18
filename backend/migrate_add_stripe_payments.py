"""
Safe additive migration — tables for Stripe Checkout payments.

Creates (if missing):
  - bill_payments: one row per Checkout attempt for a bill, with a partial
    unique index allowing at most one *paid* attempt per bill.
  - stripe_events: processed webhook event IDs, so retried deliveries are
    acknowledged without being applied twice.

Existing tables and rows are not modified. Idempotent; single transaction.

Rollback (manual, loses online-payment history):
    DROP TABLE IF EXISTS stripe_events;
    DROP TABLE IF EXISTS bill_payments;

Run from backend/ with the virtual environment activated:
    python migrate_add_stripe_payments.py
"""
from sqlalchemy import inspect, text

from app.database.connection import engine
from app.models.payment import BillPayment, StripeEvent


def main() -> None:
    with engine.begin() as conn:
        print(f"Database: {conn.execute(text('SELECT current_database()')).scalar()}")
        existing = set(inspect(conn).get_table_names())
        for table in (BillPayment.__table__, StripeEvent.__table__):
            if table.name in existing:
                print(f"· {table.name} already exists.")
            else:
                table.create(conn)
                print(f"✓ Created {table.name}.")
    print("Migration complete.")


if __name__ == "__main__":
    main()
