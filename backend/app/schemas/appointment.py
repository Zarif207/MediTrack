from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AppointmentStatus = Literal[
    "scheduled",
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
]


class AppointmentCreate(BaseModel):
    patient_id: int = Field(gt=0)
    doctor_id: int = Field(gt=0)
    appointment_date: date
    appointment_time: time
    status: AppointmentStatus = "scheduled"
    reason: str | None = None


class AppointmentUpdate(BaseModel):
    patient_id: int | None = Field(default=None, gt=0)
    doctor_id: int | None = Field(default=None, gt=0)
    appointment_date: date | None = None
    appointment_time: time | None = None
    status: AppointmentStatus | None = None
    reason: str | None = None


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    appointment_id: int
    patient_id: int
    doctor_id: int
    appointment_date: date
    appointment_time: time
    status: AppointmentStatus
    reason: str | None
    created_at: datetime