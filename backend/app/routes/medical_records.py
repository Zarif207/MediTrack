from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
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

# Medical records: doctor and admin can write; no patient self-access in this MVP
_ALL_STAFF = require_roles("admin", "doctor", "receptionist")
_WRITE_ROLES = require_roles("admin", "doctor")

router = APIRouter(prefix="/medical-records", tags=["Medical Records"])


@router.post(
    "/",
    response_model=MedicalRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_medical_record_endpoint(
    data: MedicalRecordCreate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    return create_medical_record(db, data)


@router.get("/", response_model=list[MedicalRecordResponse])
def list_medical_records(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    appointment_id: int | None = Query(default=None, gt=0),
    _: Annotated[UserProfile, Depends(_ALL_STAFF)] = None,
    db: Session = Depends(get_db),
):
    return get_medical_records(db, skip=skip, limit=limit, appointment_id=appointment_id)


@router.get("/{record_id}", response_model=MedicalRecordResponse)
def retrieve_medical_record(
    record_id: int,
    _: Annotated[UserProfile, Depends(_ALL_STAFF)] = None,
    db: Session = Depends(get_db),
):
    record = get_medical_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    return record


@router.patch("/{record_id}", response_model=MedicalRecordResponse)
def edit_medical_record(
    record_id: int,
    data: MedicalRecordUpdate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    record = get_medical_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    return update_medical_record(db, record, data)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_medical_record(
    record_id: int,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    record = get_medical_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Medical record not found.")
    delete_medical_record(db, record)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
