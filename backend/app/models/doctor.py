from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from sqlalchemy import BigInteger, ForeignKey, String


class Doctor(Base):
    __tablename__ = "doctors"

    doctor_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    department_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("departments.department_id"),
        nullable=False,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    specialization: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        unique=True,
    )

    license_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
    )

    department: Mapped["Department"] = relationship(
        back_populates="doctors",
    )

    appointments: Mapped[list["Appointment"]] = relationship(
        back_populates="doctor",
    )