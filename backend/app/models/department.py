from sqlalchemy import BigInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Department(Base):
    __tablename__ = "departments"

    department_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    department_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    doctors: Mapped[list["Doctor"]] = relationship(
        back_populates="department",
    )