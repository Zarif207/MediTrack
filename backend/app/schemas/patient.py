from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    date_of_birth: date
    gender: str = Field(min_length=1, max_length=20)
    phone: str = Field(min_length=1, max_length=20)
    email: str | None = Field(default=None, max_length=150)
    address: str | None = None
    blood_group: str | None = Field(default=None, max_length=5)
    emergency_contact: str | None = Field(default=None, max_length=20)


class PatientUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, min_length=1, max_length=50)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, min_length=1, max_length=20)
    phone: str | None = Field(default=None, min_length=1, max_length=20)
    email: str | None = Field(default=None, max_length=150)
    address: str | None = None
    blood_group: str | None = Field(default=None, max_length=5)
    emergency_contact: str | None = Field(default=None, max_length=20)


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