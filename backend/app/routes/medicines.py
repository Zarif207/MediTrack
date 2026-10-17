from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, Limit, Skip
from app.schemas.medicine import MedicineCreate, MedicineResponse, MedicineUpdate
from app.services.medicine_service import (
    create_medicine,
    delete_medicine,
    get_medicine,
    get_medicines,
    update_medicine,
)

router = APIRouter(prefix="/medicines", tags=["Medicines"])


@router.post("/", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
def create_medicine_endpoint(
    data: MedicineCreate,
    _: Annotated[UserProfile, Depends(require_permission("medicines:write"))],
    db: Session = Depends(get_db),
):
    return create_medicine(db, data)


@router.get("/", response_model=list[MedicineResponse])
def list_medicines(
    _: Annotated[UserProfile, Depends(require_permission("medicines:read"))],
    skip: Skip = 0,
    limit: Limit = 20,
    db: Session = Depends(get_db),
):
    return get_medicines(db, skip, limit)


@router.get("/{medicine_id}", response_model=MedicineResponse)
def retrieve_medicine(
    medicine_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("medicines:read"))],
    db: Session = Depends(get_db),
):
    medicine = get_medicine(db, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    return medicine


@router.patch("/{medicine_id}", response_model=MedicineResponse)
def edit_medicine(
    medicine_id: IdPath,
    data: MedicineUpdate,
    _: Annotated[UserProfile, Depends(require_permission("medicines:write"))],
    db: Session = Depends(get_db),
):
    medicine = get_medicine(db, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    return update_medicine(db, medicine, data)


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_medicine(
    medicine_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("medicines:delete"))],
    db: Session = Depends(get_db),
):
    medicine = get_medicine(db, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    delete_medicine(db, medicine)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
