from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import allow_patient_or, require_permission
from app.auth.ownership import can_access, is_scoped, not_found
from app.models.appointment import Appointment
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, IdQuery, Limit, Skip
from app.schemas.medical_record import (
    MedicalRecordCreate,
    MedicalRecordResponse,
    MedicalRecordUpdate,
)
from app.services.medical_record_service import (
    create_medical_record,
    delete_medical_record,
    get_medical_record,
    get_medical_records,
    update_medical_record,
)

router = APIRouter(prefix="/medical-records", tags=["Medical Records"])


@router.post("/", response_model=MedicalRecordResponse, status_code=status.HTTP_201_CREATED)
def create_medical_record_endpoint(
    data: MedicalRecordCreate,
    current_user: Annotated[UserProfile, Depends(require_permission("medical_records:write"))],
    db: Session = Depends(get_db),
):
    # Doctors may only write records for their own appointments.
    if not can_access(current_user, db.get(Appointment, data.appointment_id)):
        raise not_found("Appointment")
    return create_medical_record(db, data)


@router.get("/", response_model=list[MedicalRecordResponse])
def list_medical_records(
    current_user: Annotated[UserProfile, Depends(allow_patient_or("medical_records:read"))],
    skip: Skip = 0,
    limit: Limit = 20,
    appointment_id: IdQuery | None = None,
    db: Session = Depends(get_db),
):
    return get_medical_records(
        db, skip=skip, limit=limit,
        appointment_id=appointment_id,
        owner=current_user if is_scoped(current_user) else None,
    )


@router.get("/{record_id}", response_model=MedicalRecordResponse)
def retrieve_medical_record(
    record_id: IdPath,
    current_user: Annotated[UserProfile, Depends(allow_patient_or("medical_records:read"))],
    db: Session = Depends(get_db),
):
    record = get_medical_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    if not can_access(current_user, record.appointment):
        raise not_found("Medical record")
    return record


@router.patch("/{record_id}", response_model=MedicalRecordResponse)
def edit_medical_record(
    record_id: IdPath,
    data: MedicalRecordUpdate,
    current_user: Annotated[UserProfile, Depends(require_permission("medical_records:write"))],
    db: Session = Depends(get_db),
):
    record = get_medical_record(db, record_id)
    if record is None or not can_access(current_user, record.appointment):
        raise HTTPException(status_code=404, detail="Medical record not found.")
    return update_medical_record(db, record, data)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_medical_record(
    record_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("medical_records:delete"))],
    db: Session = Depends(get_db),
):
    record = get_medical_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    delete_medical_record(db, record)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
