from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    __table_args__ = (
    UniqueConstraint(
        "prescription_id",
        "medicine_id",
        name="uq_prescription_medicine",
    ),
    CheckConstraint(
        "quantity > 0",
        name="ck_prescription_items_quantity_positive",
    ),
)


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

    # ── Read-only values exposed in API responses ────────────────────────────
    @property
    def medicine_name(self) -> str | None:
        return self.medicine.medicine_name if self.medicine else None

    @property
    def medicine_strength(self) -> str | None:
        return self.medicine.strength if self.medicine else None

    @property
    def medicine_form(self) -> str | None:
        return self.medicine.dosage_form if self.medicine else None
