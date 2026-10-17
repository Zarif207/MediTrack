"""Shared field types and base classes for request schemas."""
from typing import Annotated, ClassVar

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Digits with optional +, spaces, dashes, dots and parentheses.
Phone = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=6, max_length=20,
                      pattern=r"^\+?[0-9()\-.\s]{6,20}$"),
]

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]

PositiveId = Annotated[int, Field(gt=0, le=2**63 - 1)]


class RequestModel(BaseModel):
    """Strips surrounding whitespace from every string field."""

    model_config = ConfigDict(str_strip_whitespace=True)


class UpdateModel(RequestModel):
    """
    Base for PATCH bodies. Subclasses list the columns that are NOT NULL in the
    database; sending an explicit null for one of them is a validation error
    instead of an IntegrityError at commit time.
    """

    NON_NULLABLE: ClassVar[tuple[str, ...]] = ()

    def changes(self) -> dict:
        data = self.model_dump(exclude_unset=True)
        nulls = [f for f in self.NON_NULLABLE if f in data and data[f] is None]
        if nulls:
            raise HTTPException(
                status_code=422,
                detail=f"These fields cannot be empty: {', '.join(nulls)}.",
            )
        if not data:
            raise HTTPException(status_code=400, detail="Provide at least one field to update.")
        return data
