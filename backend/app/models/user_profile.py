"""
UserProfile — maps a Firebase UID to a role stored in PostgreSQL.

Role hierarchy:
  user          — default role for new registrations. Cannot access patient or
                  staff endpoints. Admin must assign a specific role.
  patient       — can book appointments and access own health data (when linked).
  doctor        — clinical staff.
  pharmacist    — pharmacy staff.
  receptionist  — reception/scheduling staff.
  accountant    — billing staff.
  admin         — system administrator with full management access.

Design notes:
- We do NOT store passwords. Firebase handles authentication.
- firebase_uid is the primary key (the string UID Firebase assigns).
- role is application-level and authoritative; the client cannot self-promote.
- patient_id is a nullable FK to patients.patient_id — set by admin only.
- display_name and email are cached from the Firebase token for display only.
"""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


VALID_ROLES = frozenset({
    "user",           # default — new registration, no clinical permissions
    "patient",        # can book appointments, view own health data when linked
    "admin",
    "receptionist",
    "doctor",
    "pharmacist",
    "accountant",
})

# Roles that have patient-level access to health endpoints
PATIENT_ROLES = frozenset({"patient"})

# Roles considered "staff" (can access most management endpoints)
STAFF_ROLES = frozenset({"admin", "receptionist", "doctor", "pharmacist", "accountant"})


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
        default="user",
        comment=(
            "Application role: user|patient|admin|receptionist|"
            "doctor|pharmacist|accountant"
        ),
    )

    patient_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("patients.patient_id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        comment="FK to patients.patient_id — set by admin only, never by the user",
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

    patient: Mapped["Patient | None"] = relationship(
        "Patient",
        foreign_keys=[patient_id],
        uselist=False,
    )
