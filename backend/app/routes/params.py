"""Shared request parameter types for routers."""
from typing import Annotated

from fastapi import Path, Query

# Database IDs are BIGINT; reject values PostgreSQL cannot represent.
IdPath = Annotated[int, Path(gt=0, le=2**63 - 1)]

Skip = Annotated[int, Query(ge=0, le=100_000)]
Limit = Annotated[int, Query(ge=1, le=100)]
IdQuery = Annotated[int, Query(gt=0, le=2**63 - 1)]
