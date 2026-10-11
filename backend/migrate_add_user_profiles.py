"""
Safe additive migration — creates the user_profiles table if it does not
already exist.  This script NEVER modifies, drops, or truncates any
existing table.

Run from the backend/ directory with the virtual environment activated:

    python migrate_add_user_profiles.py

The script is idempotent — running it multiple times is safe.
"""
import sys

from sqlalchemy import inspect, text

from app.database.connection import engine
from app.models.user_profile import UserProfile
from app.database.base import Base


def main() -> None:
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if "user_profiles" in existing_tables:
        print("✓ user_profiles table already exists — nothing to do.")
        return

    print("Creating user_profiles table …")
    # Only create the new table; checkfirst=True means existing tables are skipped.
    UserProfile.__table__.create(engine, checkfirst=True)
    print("✓ user_profiles table created.")

    # Verify
    inspector2 = inspect(engine)
    if "user_profiles" in inspector2.get_table_names():
        print("✓ Verified: table is present.")
    else:
        print("✗ ERROR: table was not created!", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
