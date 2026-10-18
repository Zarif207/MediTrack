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


class PendingBill(BaseModel):
    bill_id: int
    patient_id: int
    patient_name: str | None
    appointment_id: int
    amount: Decimal
    issued_at: datetime
    days_outstanding: int
    checkout_open: bool


class FullyPaidPatient(BaseModel):
    patient_id: int
    patient_name: str | None
    bills_paid: int
    total_paid: Decimal
    last_paid_at: datetime | None


class BillSummary(BaseModel):
    pending: list[PendingBill]
    pending_total: Decimal
    fully_paid: list[FullyPaidPatient]
    online_payment_enabled: bool


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    expires_at: datetime


class PaymentStatusResponse(BaseModel):
    bill_id: int
    bill_status: str
    payment_status: str
