from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import Phone, PositiveId, RequestModel, UpdateModel


class DoctorCreate(RequestModel):
    department_id: PositiveId
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    specialization: str = Field(min_length=1, max_length=100)
    phone: Phone
    email: EmailStr = Field(max_length=150)
    license_number: str = Field(min_length=1, max_length=50)


class DoctorUpdate(UpdateModel):
    NON_NULLABLE = (
        "department_id", "first_name", "last_name", "specialization",
        "phone", "email", "license_number",
    )

    department_id: PositiveId | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, min_length=1, max_length=50)
    specialization: str | None = Field(default=None, min_length=1, max_length=100)
    phone: Phone | None = None
    email: EmailStr | None = Field(default=None, max_length=150)
    license_number: str | None = Field(default=None, min_length=1, max_length=50)


class DoctorPublicResponse(BaseModel):
    """Directory view for visitors, patients and unassigned accounts."""

    model_config = ConfigDict(from_attributes=True)

    doctor_id: int
    department_id: int
    first_name: str
    last_name: str
    specialization: str


class DoctorResponse(DoctorPublicResponse):
    """Full record, including contact and licensing details, for staff."""

    phone: str
    email: str
    license_number: str
