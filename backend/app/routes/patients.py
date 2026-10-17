from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import allow_patient_or, require_permission
from app.auth.ownership import is_patient, not_found
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, Limit, Skip
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.services.patient_service import (
    create_patient,
    delete_patient,
    get_patient,
    get_patients,
    update_patient,
)

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient_endpoint(
    data: PatientCreate,
    _: Annotated[UserProfile, Depends(require_permission("patients:write"))],
    db: Session = Depends(get_db),
):
    return create_patient(db, data)


@router.get("/", response_model=list[PatientResponse])
def list_patients(
    current_user: Annotated[UserProfile, Depends(allow_patient_or("patients:read"))],
    skip: Skip = 0,
    limit: Limit = 20,
    db: Session = Depends(get_db),
):
    # Patients only ever see the clinical record linked to their own account.
    if is_patient(current_user):
        if current_user.patient_id is None or skip > 0:
            return []
        record = get_patient(db, current_user.patient_id)
        return [record] if record else []

    return get_patients(db, skip=skip, limit=limit)


@router.get("/{patient_id}", response_model=PatientResponse)
def retrieve_patient(
    patient_id: IdPath,
    current_user: Annotated[UserProfile, Depends(allow_patient_or("patients:read"))],
    db: Session = Depends(get_db),
):
    if is_patient(current_user) and patient_id != current_user.patient_id:
        raise not_found("Patient")

    patient = get_patient(db, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return patient


@router.patch("/{patient_id}", response_model=PatientResponse)
def edit_patient(
    patient_id: IdPath,
    data: PatientUpdate,
    _: Annotated[UserProfile, Depends(require_permission("patients:write"))],
    db: Session = Depends(get_db),
):
    patient = get_patient(db, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return update_patient(db, patient, data)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_patient(
    patient_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("patients:delete"))],
    db: Session = Depends(get_db),
):
    patient = get_patient(db, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    delete_patient(db, patient)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
