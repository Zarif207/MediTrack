from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    prescription_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    record_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("medical_records.record_id"),
        nullable=False,
        index=True,
    )

    prescription_date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    medical_record: Mapped["MedicalRecord"] = relationship(
        back_populates="prescriptions",
    )

    prescription_items: Mapped[list["PrescriptionItem"]] = relationship(
        back_populates="prescription",
    )