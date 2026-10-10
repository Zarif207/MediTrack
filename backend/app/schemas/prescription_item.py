from pydantic import BaseModel, ConfigDict, Field


class PrescriptionItemCreate(BaseModel):
    prescription_id: int = Field(gt=0)
    medicine_id: int = Field(gt=0)
    dosage: str = Field(min_length=1, max_length=50)
    frequency: str = Field(min_length=1, max_length=100)
    duration: str = Field(min_length=1, max_length=50)
    quantity: int = Field(gt=0)


class PrescriptionItemUpdate(BaseModel):
    dosage: str | None = Field(default=None, min_length=1, max_length=50)
    frequency: str | None = Field(default=None, min_length=1, max_length=100)
    duration: str | None = Field(default=None, min_length=1, max_length=50)
    quantity: int | None = Field(default=None, gt=0)


class PrescriptionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prescription_item_id: int
    prescription_id: int
    medicine_id: int
    dosage: str
    frequency: str
    duration: str
    quantity: int