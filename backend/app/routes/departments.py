from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, Limit, Skip
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

# Department reads are public (the website lists departments without login).
router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post(
    "/",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_department_endpoint(
    data: DepartmentCreate,
    _: Annotated[UserProfile, Depends(require_permission("departments:write"))],
    db: Session = Depends(get_db),
):
    return create_department(db, data)


@router.get("/", response_model=list[DepartmentResponse])
def list_departments(
    skip: Skip = 0,
    limit: Limit = 20,
    db: Session = Depends(get_db),
):
    return get_departments(db, skip=skip, limit=limit)


@router.get("/{department_id}", response_model=DepartmentResponse)
def retrieve_department(
    department_id: IdPath,
    db: Session = Depends(get_db),
):
    department = get_department(db, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    return department


@router.patch("/{department_id}", response_model=DepartmentResponse)
def edit_department(
    department_id: IdPath,
    data: DepartmentUpdate,
    _: Annotated[UserProfile, Depends(require_permission("departments:write"))],
    db: Session = Depends(get_db),
):
    department = get_department(db, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    return update_department(db, department, data)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_department(
    department_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("departments:delete"))],
    db: Session = Depends(get_db),
):
    department = get_department(db, department_id)
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    delete_department(db, department)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
