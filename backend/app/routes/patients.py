from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_patient_id_for_user, require_roles
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.services.patient_service import (
    create_patient,
    delete_patient,
    get_patient,
    get_patients,
    update_patient,
)

_STAFF_READ  = require_roles("admin", "receptionist", "doctor")
_WRITE_ROLES = require_roles("admin", "receptionist")

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient_endpoint(
    data: PatientCreate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    return create_patient(db, data)


@router.get("/", response_model=list[PatientResponse])
def list_patients(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: Annotated[UserProfile, Depends(get_current_user)] = None,
    db: Session = Depends(get_db),
):
    # patient-role: list returns only their own record
    if current_user.role == "patient":
        if current_user.patient_id is None:
            return []  # no patient record yet — empty list, not 403
        record = get_patient(db, current_user.patient_id)
        return [record] if record else []

    # Staff roles that can list all patients
    if current_user.role not in ("admin", "receptionist", "doctor"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return get_patients(db, skip=skip, limit=limit)


@router.get("/{patient_id}", response_model=PatientResponse)
def retrieve_patient(
    patient_id: int,
    current_user: Annotated[UserProfile, Depends(get_current_user)] = None,
    db: Session = Depends(get_db),
):
    # patient-role: only their own record
    if current_user.role == "patient":
        if current_user.patient_id is None:
            raise HTTPException(status_code=404, detail="Patient record not found.")
        if patient_id != current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own patient record.",
            )

    elif current_user.role not in ("admin", "receptionist", "doctor"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    patient = get_patient(db, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return patient


@router.patch("/{patient_id}", response_model=PatientResponse)
def edit_patient(
    patient_id: int,
    data: PatientUpdate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    patient = get_patient(db, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return update_patient(db, patient, data)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_patient(
    patient_id: int,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    patient = get_patient(db, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    delete_patient(db, patient)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
