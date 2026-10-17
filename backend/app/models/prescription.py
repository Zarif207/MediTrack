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

    # ── Read-only values exposed in API responses ────────────────────────────
    @property
    def patient_id(self) -> int | None:
        return self.medical_record.patient_id if self.medical_record else None

    @property
    def patient_name(self) -> str | None:
        return self.medical_record.patient_name if self.medical_record else None
