from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PositiveId, RequestModel, UpdateModel


class MedicalRecordCreate(RequestModel):
    appointment_id: PositiveId
    diagnosis: str | None = Field(default=None, max_length=5000)
    symptoms: str | None = Field(default=None, max_length=5000)
    treatment_notes: str | None = Field(default=None, max_length=5000)


class MedicalRecordUpdate(UpdateModel):
    diagnosis: str | None = Field(default=None, max_length=5000)
    symptoms: str | None = Field(default=None, max_length=5000)
    treatment_notes: str | None = Field(default=None, max_length=5000)


class MedicalRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    record_id: int
    appointment_id: int
    diagnosis: str | None
    symptoms: str | None
    treatment_notes: str | None
    record_date: datetime
    patient_id: int | None = None
    patient_name: str | None = None
