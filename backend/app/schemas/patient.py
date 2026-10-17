from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import Phone, RequestModel, UpdateModel

BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


def _check_dob(value: date | None) -> date | None:
    if value is None:
        return value
    if value > date.today():
        raise ValueError("Date of birth cannot be in the future.")
    if value.year < 1900:
        raise ValueError("Date of birth must be after 1900.")
    return value


class PatientCreate(RequestModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    date_of_birth: date
    gender: str = Field(min_length=1, max_length=20)
    phone: Phone
    email: EmailStr | None = Field(default=None, max_length=150)
    address: str | None = Field(default=None, max_length=500)
    blood_group: BloodGroup | None = None
    emergency_contact: Phone | None = None

    _dob = field_validator("date_of_birth")(_check_dob)


class PatientUpdate(UpdateModel):
    NON_NULLABLE = ("first_name", "last_name", "date_of_birth", "gender", "phone")

    first_name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, min_length=1, max_length=50)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, min_length=1, max_length=20)
    phone: Phone | None = None
    email: EmailStr | None = Field(default=None, max_length=150)
    address: str | None = Field(default=None, max_length=500)
    blood_group: BloodGroup | None = None
    emergency_contact: Phone | None = None

    _dob = field_validator("date_of_birth")(_check_dob)


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_id: int
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone: str
    email: str | None
    address: str | None
    blood_group: str | None
    emergency_contact: str | None
    registered_at: datetime
