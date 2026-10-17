from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PositiveId, RequestModel, UpdateModel


AppointmentStatus = Literal[
    "scheduled",
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
]


class AppointmentCreate(RequestModel):
    """Staff-created appointment for an existing clinical patient record."""

    patient_id: PositiveId
    doctor_id: PositiveId
    appointment_date: date
    appointment_time: time
    status: AppointmentStatus = "scheduled"
    reason: str | None = Field(default=None, max_length=1000)


class AppointmentUpdate(UpdateModel):
    NON_NULLABLE = ("doctor_id", "appointment_date", "appointment_time", "status")

    patient_id: PositiveId | None = None
    doctor_id: PositiveId | None = None
    appointment_date: date | None = None
    appointment_time: time | None = None
    status: AppointmentStatus | None = None
    reason: str | None = Field(default=None, max_length=1000)


class PatientBookingRequest(RequestModel):
    """
    Self-booking by a patient-role account. The owner is always the verified
    Firebase UID; any patient_id / firebase_uid in the body is ignored.
    """

    doctor_id: PositiveId
    appointment_date: date
    appointment_time: time
    reason: str | None = Field(default=None, max_length=1000)


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    appointment_id: int
    patient_id: int | None
    doctor_id: int
    appointment_date: date
    appointment_time: time
    status: AppointmentStatus
    reason: str | None
    created_at: datetime
    firebase_uid: str | None = None
    patient_name: str | None = None
    booked_by_name: str | None = None
    booked_by_email: str | None = None


class AvailabilityResponse(BaseModel):
    doctor_id: int
    date: date
    slot_minutes: int
    opens_at: time
    closes_at: time
    available: list[time]
    unavailable: list[time]
