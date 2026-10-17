from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import RequestModel, UpdateModel


class DepartmentCreate(RequestModel):
    department_name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)


class DepartmentUpdate(UpdateModel):
    NON_NULLABLE = ("department_name",)

    department_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    description: str | None = Field(default=None, max_length=2000)


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department_id: int
    department_name: str
    description: str | None
