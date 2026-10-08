from sqlalchemy import BigInteger, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    prescription_item_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    prescription_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("prescriptions.prescription_id"),
        nullable=False,
    )

    medicine_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("medicines.medicine_id"),
        nullable=False,
    )

    dosage: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    frequency: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    duration: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    prescription: Mapped["Prescription"] = relationship(
        back_populates="prescription_items",
    )

    medicine: Mapped["Medicine"] = relationship(
        back_populates="prescription_items",
    )

    __table_args__ = (
        UniqueConstraint(
            "prescription_id",
            "medicine_id",
            name="uq_prescription_medicine",
        ),
    )