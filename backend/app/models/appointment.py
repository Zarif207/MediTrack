from datetime import date, datetime, time

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')",
            name="ck_appointments_status",
        ),
    )

    appointment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    patient_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("patients.patient_id"),
        nullable=False,
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

    # Set when an unlinked patient (role=patient, patient_id=NULL) books.
    # Used to retrieve their own bookings before the patient record is linked.
    # Once the account is linked the patient_id relationship takes over.
    firebase_uid: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("user_profiles.firebase_uid", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment=(
            "Firebase UID of the booking user. "
            "Set for unlinked-patient bookings so they can view their own appointments."
        ),
    )

    # Relationships
    patient: Mapped["Patient"] = relationship(back_populates="appointments")
    doctor: Mapped["Doctor"] = relationship(back_populates="appointments")
    medical_record: Mapped["MedicalRecord | None"] = relationship(
        back_populates="appointment", uselist=False
    )
    bill: Mapped["Bill | None"] = relationship(
        back_populates="appointment", uselist=False
    )
