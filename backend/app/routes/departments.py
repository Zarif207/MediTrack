from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.services.department_service import (
    create_department,
    delete_department,
    get_department,
    get_departments,
    update_department,
)

# Department reads are open (public website shows departments/doctors without login)
# Writes require admin or receptionist
_WRITE_ROLES = require_roles("admin", "receptionist")

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post(
    "/",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_department_endpoint(
    data: DepartmentCreate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    return create_department(db, data)


@router.get("/", response_model=list[DepartmentResponse])
def list_departments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return get_departments(db, skip=skip, limit=limit)


@router.get("/{department_id}", response_model=DepartmentResponse)
def retrieve_department(
    department_id: int,
    db: Session = Depends(get_db),
):
    department = get_department(db, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    return department


@router.patch("/{department_id}", response_model=DepartmentResponse)
def edit_department(
    department_id: int,
    data: DepartmentUpdate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    department = get_department(db, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    return update_department(db, department, data)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_department(
    department_id: int,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    department = get_department(db, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    delete_department(db, department)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
