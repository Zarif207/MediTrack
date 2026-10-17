from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PositiveId, RequestModel, UpdateModel


class PrescriptionCreate(RequestModel):
    record_id: PositiveId
    instructions: str | None = Field(default=None, max_length=2000)


class PrescriptionUpdate(UpdateModel):
    instructions: str | None = Field(default=None, max_length=2000)


class PrescriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prescription_id: int
    record_id: int
    prescription_date: datetime
    instructions: str | None
    patient_id: int | None = None
    patient_name: str | None = None
