"""
One-time admin setup script.

After creating a user in Firebase Console (or via Firebase Auth sign-up),
run this script to promote them to admin in the PostgreSQL user_profiles table.

Usage:
    python create_admin.py <firebase_uid> [display_name] [email]

Example:
    python create_admin.py "abc123firebaseUID" "Dr. Admin" "admin@example.com"

This script never creates a Firebase account — do that in Firebase Console first.
It only writes to the local PostgreSQL database.
"""
import sys
from datetime import datetime

from app.database.connection import engine
from sqlalchemy.orm import Session
from app.models.user_profile import UserProfile


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    uid = args[0]
    display_name = args[1] if len(args) > 1 else None
    email = args[2] if len(args) > 2 else None

    with Session(engine) as db:
        existing = db.get(UserProfile, uid)
        if existing:
            existing.role = "admin"
            existing.display_name = display_name or existing.display_name
            existing.email = email or existing.email
            db.commit()
            print(f"✓ Updated existing profile for {uid} → role=admin")
        else:
            profile = UserProfile(
                firebase_uid=uid,
                role="admin",
                display_name=display_name,
                email=email,
                created_at=datetime.now(),
            )
            db.add(profile)
            db.commit()
            print(f"✓ Created admin profile for {uid}")

        db.refresh(existing or profile)
        final = db.get(UserProfile, uid)
        print(f"  uid={final.firebase_uid}, role={final.role}, email={final.email}")


if __name__ == "__main__":
    main()
