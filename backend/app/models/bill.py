from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Bill(Base):
    __tablename__ = "bills"

    bill_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    patient_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("patients.patient_id"),
        nullable=False,
        index=True,
    )

    appointment_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("appointments.appointment_id"),
        nullable=False,
        unique=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    payment_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    payment_method: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    patient: Mapped["Patient"] = relationship(
        back_populates="bills",
    )

    appointment: Mapped["Appointment"] = relationship(
        back_populates="bill",
    )