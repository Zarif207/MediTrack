"""
Vercel build step for the API. Migrations do NOT run on ordinary builds; they
run only when a deployment asks for them explicitly, naming its environment:

    vercel deploy --prod --build-env MIGRATE=production
    vercel deploy --target=preview --build-env MIGRATE=preview

To look before changing anything, use MIGRATE=inspect: the build prints the
target database, its tables and row counts, then stops on purpose, so nothing
is migrated and nothing is deployed.

The named environment must match the one Vercel is building, so a value meant
for Preview can never migrate the Production database (each environment has
its own DATABASE_URL). The target host and database are printed first.
"""
import os
import sys


def inspect_target(building: str | None) -> None:
    from sqlalchemy import inspect, text

    from app.database.connection import engine

    print(f"[{building}] target: database {engine.url.database!r} on host {engine.url.host!r}")
    tables = sorted(inspect(engine).get_table_names())
    print(f"[{building}] {len(tables)} tables")
    with engine.connect() as conn:
        for table in tables:
            print(f"  {table}: {conn.execute(text(f'SELECT count(*) FROM \"{table}\"')).scalar()} rows")


def main() -> None:
    wanted = os.getenv("MIGRATE")
    building = os.getenv("VERCEL_TARGET_ENV") or os.getenv("VERCEL_ENV")
    if not wanted:
        print("Migrations skipped. To apply them, deploy with --build-env MIGRATE=<environment>.")
        return
    if wanted == "inspect":
        inspect_target(building)
        sys.exit("Inspection only: build stopped on purpose; nothing was migrated or deployed.")
    if wanted != building:
        sys.exit(f"Refusing to migrate: MIGRATE={wanted!r} but this build is for {building!r}.")

    from migrations.__main__ import main as migrate

    print(f"Applying migrations for the {building} environment.")
    migrate()


if __name__ == "__main__":
    main()
