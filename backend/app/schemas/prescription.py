from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PrescriptionCreate(BaseModel):
    record_id: int = Field(gt=0)
    instructions: str | None = None


class PrescriptionUpdate(BaseModel):
    instructions: str | None = None


class PrescriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prescription_id: int
    record_id: int
    prescription_date: datetime
    instructions: str | None