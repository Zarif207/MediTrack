from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import allow_patient_or, require_permission
from app.auth.ownership import is_patient, not_found, owns_appointment
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, IdQuery, Limit, Skip
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

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])


def _owned(user: UserProfile, prescription) -> bool:
    record = prescription.medical_record
    return record is not None and owns_appointment(user, record.appointment)


@router.post("/", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
def create_prescription_endpoint(
    data: PrescriptionCreate,
    _: Annotated[UserProfile, Depends(require_permission("prescriptions:write"))],
    db: Session = Depends(get_db),
):
    return create_prescription(db, data)


@router.get("/", response_model=list[PrescriptionResponse])
def list_prescriptions(
    current_user: Annotated[UserProfile, Depends(allow_patient_or("prescriptions:read"))],
    skip: Skip = 0,
    limit: Limit = 20,
    record_id: IdQuery | None = None,
    db: Session = Depends(get_db),
):
    return get_prescriptions(
        db, skip=skip, limit=limit,
        record_id=record_id,
        owner=current_user if is_patient(current_user) else None,
    )


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
def retrieve_prescription(
    prescription_id: IdPath,
    current_user: Annotated[UserProfile, Depends(allow_patient_or("prescriptions:read"))],
    db: Session = Depends(get_db),
):
    prescription = get_prescription(db, prescription_id)
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    if is_patient(current_user) and not _owned(current_user, prescription):
        raise not_found("Prescription")
    return prescription


@router.patch("/{prescription_id}", response_model=PrescriptionResponse)
def edit_prescription(
    prescription_id: IdPath,
    data: PrescriptionUpdate,
    _: Annotated[UserProfile, Depends(require_permission("prescriptions:write"))],
    db: Session = Depends(get_db),
):
    prescription = get_prescription(db, prescription_id)
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return update_prescription(db, prescription, data)


@router.delete("/{prescription_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_prescription(
    prescription_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("prescriptions:delete"))],
    db: Session = Depends(get_db),
):
    prescription = get_prescription(db, prescription_id)
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    delete_prescription(db, prescription)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
