from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MedicalRecordCreate(BaseModel):
    appointment_id: int = Field(gt=0)
    diagnosis: str | None = None
    symptoms: str | None = None
    treatment_notes: str | None = None


class MedicalRecordUpdate(BaseModel):
    diagnosis: str | None = None
    symptoms: str | None = None
    treatment_notes: str | None = None


class MedicalRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    record_id: int
    appointment_id: int
    diagnosis: str | None
    symptoms: str | None
    treatment_notes: str | None
    record_date: datetime