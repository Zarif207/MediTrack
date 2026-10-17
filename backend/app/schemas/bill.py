from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PositiveId, RequestModel, UpdateModel


PaymentStatus = Literal["pending", "paid", "cancelled"]


class BillCreate(RequestModel):
    patient_id: PositiveId
    appointment_id: PositiveId
    amount: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    payment_status: PaymentStatus = "pending"
    payment_method: str | None = Field(default=None, max_length=30)


class BillUpdate(UpdateModel):
    NON_NULLABLE = ("amount", "payment_status")

    amount: Decimal | None = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    payment_status: PaymentStatus | None = None
    payment_method: str | None = Field(default=None, max_length=30)


class BillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bill_id: int
    patient_id: int
    appointment_id: int
    amount: Decimal
    payment_status: str
    payment_method: str | None
    issued_at: datetime
    paid_at: datetime | None
