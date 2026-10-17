from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PositiveId, RequestModel, UpdateModel


class PrescriptionItemCreate(RequestModel):
    prescription_id: PositiveId
    medicine_id: PositiveId
    dosage: str = Field(min_length=1, max_length=50)
    frequency: str = Field(min_length=1, max_length=100)
    duration: str = Field(min_length=1, max_length=50)
    quantity: int = Field(gt=0, le=10_000)


class PrescriptionItemUpdate(UpdateModel):
    NON_NULLABLE = ("dosage", "frequency", "duration", "quantity")

    dosage: str | None = Field(default=None, min_length=1, max_length=50)
    frequency: str | None = Field(default=None, min_length=1, max_length=100)
    duration: str | None = Field(default=None, min_length=1, max_length=50)
    quantity: int | None = Field(default=None, gt=0, le=10_000)


class PrescriptionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prescription_item_id: int
    prescription_id: int
    medicine_id: int
    dosage: str
    frequency: str
    duration: str
    quantity: int
    medicine_name: str | None = None
    medicine_strength: str | None = None
    medicine_form: str | None = None
