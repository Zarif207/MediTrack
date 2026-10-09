from pydantic import BaseModel, ConfigDict, EmailStr, Field


class DoctorCreate(BaseModel):
    department_id: int = Field(gt=0)
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    specialization: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=20)
    email: EmailStr = Field(max_length=150)
    license_number: str = Field(min_length=1, max_length=50)


class DoctorUpdate(BaseModel):
    department_id: int | None = Field(default=None, gt=0)
    first_name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, min_length=1, max_length=50)
    specialization: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, min_length=1, max_length=20)
    email: EmailStr | None = Field(default=None, max_length=150)
    license_number: str | None = Field(default=None, min_length=1, max_length=50)


class DoctorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    doctor_id: int
    department_id: int
    first_name: str
    last_name: str
    specialization: str
    phone: str
    email: EmailStr
    license_number: str