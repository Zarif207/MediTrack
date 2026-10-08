from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    record_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    appointment_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("appointments.appointment_id"),
        nullable=False,
        unique=True,
    )

    diagnosis: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    symptoms: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    treatment_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    record_date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    appointment: Mapped["Appointment"] = relationship(
        back_populates="medical_record",
    )

    prescriptions: Mapped[list["Prescription"]] = relationship(
        back_populates="medical_record",
    )