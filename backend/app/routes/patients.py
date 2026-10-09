from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.services.patient_service import (
    create_patient,
    delete_patient,
    get_patient,
    get_patients,
    update_patient,
)


router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post(
    "/",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_patient_endpoint(
    data: PatientCreate,
    db: Session = Depends(get_db),
):
    return create_patient(db, data)


@router.get("/", response_model=list[PatientResponse])
def list_patients(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return get_patients(db, skip=skip, limit=limit)


@router.get("/{patient_id}", response_model=PatientResponse)
def retrieve_patient(
    patient_id: int,
    db: Session = Depends(get_db),
):
    patient = get_patient(db, patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    return patient


@router.patch("/{patient_id}", response_model=PatientResponse)
def edit_patient(
    patient_id: int,
    data: PatientUpdate,
    db: Session = Depends(get_db),
):
    patient = get_patient(db, patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    return update_patient(db, patient, data)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_patient(
    patient_id: int,
    db: Session = Depends(get_db),
):
    patient = get_patient(db, patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found.",
        )

    delete_patient(db, patient)
    return Response(status_code=status.HTTP_204_NO_CONTENT)