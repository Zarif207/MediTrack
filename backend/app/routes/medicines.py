from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.schemas.medicine import MedicineCreate, MedicineResponse, MedicineUpdate
from app.services.medicine_service import (
    create_medicine,
    delete_medicine,
    get_medicine,
    get_medicines,
    update_medicine,
)

_READ_ROLES = require_roles("admin", "doctor", "pharmacist")
_WRITE_ROLES = require_roles("admin", "pharmacist")

router = APIRouter(prefix="/medicines", tags=["Medicines"])


@router.post("/", response_model=MedicineResponse, status_code=201)
def create_medicine_endpoint(
    data: MedicineCreate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    return create_medicine(db, data)


@router.get("/", response_model=list[MedicineResponse])
def list_medicines(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _: Annotated[UserProfile, Depends(_READ_ROLES)] = None,
    db: Session = Depends(get_db),
):
    return get_medicines(db, skip, limit)


@router.get("/{medicine_id}", response_model=MedicineResponse)
def retrieve_medicine(
    medicine_id: int,
    _: Annotated[UserProfile, Depends(_READ_ROLES)] = None,
    db: Session = Depends(get_db),
):
    medicine = get_medicine(db, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    return medicine


@router.patch("/{medicine_id}", response_model=MedicineResponse)
def edit_medicine(
    medicine_id: int,
    data: MedicineUpdate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    medicine = get_medicine(db, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    return update_medicine(db, medicine, data)


@router.delete("/{medicine_id}", status_code=204)
def remove_medicine(
    medicine_id: int,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    medicine = get_medicine(db, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    delete_medicine(db, medicine)
    return Response(status_code=204)
