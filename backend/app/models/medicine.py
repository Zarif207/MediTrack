from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Medicine(Base):
    __tablename__ = "medicines"
    __table_args__ = (
    CheckConstraint(
        "unit_price >= 0",
        name="ck_medicines_unit_price_nonnegative",
    ),
    CheckConstraint(
        "stock_quantity >= 0",
        name="ck_medicines_stock_nonnegative",
    ),
)

    medicine_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    medicine_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    generic_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    dosage_form: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    strength: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    manufacturer: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    stock_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    prescription_items: Mapped[list["PrescriptionItem"]] = relationship(
        back_populates="medicine",
    )