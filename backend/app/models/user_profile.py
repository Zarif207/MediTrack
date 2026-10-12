"""
UserProfile — maps a Firebase UID to a role stored in PostgreSQL.

Design notes:
- We do NOT store passwords.  Firebase handles authentication.
- firebase_uid is the primary key (the string UID Firebase assigns).
- role is application-level and authoritative; the client cannot self-promote.
- patient_id is a nullable FK to patients.patient_id.
  It is the ONLY trusted mapping between a Firebase account and a patient record.
  Admins set it via PATCH /auth/users/{uid}/link-patient.
  Patients cannot set it themselves.
- display_name and email are cached from the Firebase token for display only;
  they are never used as authorization signals.
"""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

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

    # Trusted server-side mapping: Firebase UID → patients.patient_id
    # Nullable — not every Firebase account corresponds to a patients row.
    # ON DELETE SET NULL: deleting a patient does not delete their Firebase account.
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

    # Relationship back to Patient (optional — not eager-loaded)
    patient: Mapped["Patient | None"] = relationship(
        "Patient",
        foreign_keys=[patient_id],
        uselist=False,
    )
