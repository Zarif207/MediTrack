from datetime import date, datetime, time

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Time,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

# Statuses that occupy a doctor's time slot.
ACTIVE_STATUSES = ("scheduled", "confirmed")


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')",
            name="ck_appointments_status",
        ),
        # Every appointment must belong to someone: a clinical patient record,
        # the verified Firebase account that booked it, or both.
        CheckConstraint(
            "patient_id IS NOT NULL OR firebase_uid IS NOT NULL",
            name="ck_appointments_owner_present",
        ),
        # A doctor cannot hold two active appointments in the same slot. This
        # is the database-level guard against concurrent double-booking.
        Index(
            "uq_appointments_doctor_active_slot",
            "doctor_id",
            "appointment_date",
            "appointment_time",
            unique=True,
            postgresql_where=text("status IN ('scheduled', 'confirmed')"),
        ),
    )

    appointment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # NULL while the booking belongs only to a patient account that has not
    # been associated with a clinical patient record yet.
    patient_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("patients.patient_id"),
        nullable=True,
        index=True,
    )

    doctor_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("doctors.doctor_id"),
        nullable=False,
        index=True,
    )

    appointment_date: Mapped[date] = mapped_column(Date, nullable=False)
    appointment_time: Mapped[time] = mapped_column(Time, nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False)

    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Verified Firebase UID of the patient account that booked the appointment.
    # Set server-side from the ID token; never accepted from the request body.
    firebase_uid: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("user_profiles.firebase_uid", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Firebase UID of the patient account that booked this appointment.",
    )

    # Relationships
    patient: Mapped["Patient | None"] = relationship(back_populates="appointments")
    doctor: Mapped["Doctor"] = relationship(back_populates="appointments")
    booker: Mapped["UserProfile | None"] = relationship(foreign_keys=[firebase_uid])
    medical_record: Mapped["MedicalRecord | None"] = relationship(
        back_populates="appointment", uselist=False
    )
    bill: Mapped["Bill | None"] = relationship(
        back_populates="appointment", uselist=False
    )

    # ── Read-only values exposed in API responses ────────────────────────────
    @property
    def booked_by_name(self) -> str | None:
        return self.booker.display_name if self.booker else None

    @property
    def booked_by_email(self) -> str | None:
        return self.booker.email if self.booker else None

    @property
    def patient_name(self) -> str | None:
        if self.patient is not None:
            return f"{self.patient.first_name} {self.patient.last_name}"
        return self.booked_by_name or self.booked_by_email
