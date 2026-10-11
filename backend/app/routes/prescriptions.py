from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from app.services.prescription_service import (
    create_prescription,
    delete_prescription,
    get_prescription,
    get_prescriptions,
    update_prescription,
)

_READ_ROLES = require_roles("admin", "doctor", "pharmacist")
_WRITE_ROLES = require_roles("admin", "doctor")

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])


@router.post("/", response_model=PrescriptionResponse, status_code=201)
def create_prescription_endpoint(
    data: PrescriptionCreate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    return create_prescription(db, data)


@router.get("/", response_model=list[PrescriptionResponse])
def list_prescriptions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    record_id: int | None = Query(default=None, gt=0),
    _: Annotated[UserProfile, Depends(_READ_ROLES)] = None,
    db: Session = Depends(get_db),
):
    return get_prescriptions(db, skip, limit, record_id)


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
def retrieve_prescription(
    prescription_id: int,
    _: Annotated[UserProfile, Depends(_READ_ROLES)] = None,
    db: Session = Depends(get_db),
):
    prescription = get_prescription(db, prescription_id)
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return prescription


@router.patch("/{prescription_id}", response_model=PrescriptionResponse)
def edit_prescription(
    prescription_id: int,
    data: PrescriptionUpdate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    prescription = get_prescription(db, prescription_id)
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return update_prescription(db, prescription, data)


@router.delete("/{prescription_id}", status_code=204)
def remove_prescription(
    prescription_id: int,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    prescription = get_prescription(db, prescription_id)
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    delete_prescription(db, prescription)
    return Response(status_code=204)
