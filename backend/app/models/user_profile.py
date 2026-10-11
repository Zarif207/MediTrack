"""
UserProfile — maps a Firebase UID to a role stored in PostgreSQL.

Design notes:
- We do NOT store passwords.  Firebase handles authentication.
- firebase_uid is the primary key (the string UID Firebase assigns).
- role is an application-level permission level.  It is authoritative
  on the server; the client cannot self-promote.
- display_name and email are cached from the Firebase token for
  convenience; they are never used as trust signals.
"""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


VALID_ROLES = frozenset({
    "admin",
    "receptionist",
    "doctor",
    "pharmacist",
    "accountant",
    "patient",
})


class UserProfile(Base):
    __tablename__ = "user_profiles"

    firebase_uid: Mapped[str] = mapped_column(
        String(128),
        primary_key=True,
        comment="Firebase Authentication UID — never a password",
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="patient",
        comment="Application role: admin|receptionist|doctor|pharmacist|accountant|patient",
    )

    display_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Cached from Firebase token for display only",
    )

    email: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Cached from Firebase token for display only",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )
