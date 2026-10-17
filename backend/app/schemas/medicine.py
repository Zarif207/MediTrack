from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import RequestModel, UpdateModel


class MedicineCreate(RequestModel):
    medicine_name: str = Field(min_length=1, max_length=150)
    generic_name: str = Field(min_length=1, max_length=150)
    dosage_form: str = Field(min_length=1, max_length=50)
    strength: str = Field(min_length=1, max_length=50)
    manufacturer: str = Field(min_length=1, max_length=150)
    unit_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    stock_quantity: int = Field(ge=0, le=1_000_000)


class MedicineUpdate(UpdateModel):
    NON_NULLABLE = (
        "medicine_name", "generic_name", "dosage_form", "strength",
        "manufacturer", "unit_price", "stock_quantity",
    )

    medicine_name: str | None = Field(default=None, min_length=1, max_length=150)
    generic_name: str | None = Field(default=None, min_length=1, max_length=150)
    dosage_form: str | None = Field(default=None, min_length=1, max_length=50)
    strength: str | None = Field(default=None, min_length=1, max_length=50)
    manufacturer: str | None = Field(default=None, min_length=1, max_length=150)
    unit_price: Decimal | None = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    stock_quantity: int | None = Field(default=None, ge=0, le=1_000_000)


class MedicineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    medicine_id: int
    medicine_name: str
    generic_name: str
    dosage_form: str
    strength: str
    manufacturer: str
    unit_price: Decimal
    stock_quantity: int
