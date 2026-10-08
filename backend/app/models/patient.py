from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Patient(Base):
    __tablename__ = "patients"

    patient_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    date_of_birth: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    gender: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        unique=True,
    )

    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    blood_group: Mapped[str | None] = mapped_column(
        String(5),
        nullable=True,
    )

    emergency_contact: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    registered_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    appointments: Mapped[list["Appointment"]] = relationship(
        back_populates="patient",
    )

    bills: Mapped[list["Bill"]] = relationship(
        back_populates="patient",
    )