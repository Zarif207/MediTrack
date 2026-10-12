from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_patient_id_for_user, require_roles
from app.database.dependencies import get_db
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
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

_STAFF_READ  = require_roles("admin", "doctor", "receptionist")
_WRITE_ROLES = require_roles("admin", "doctor")
# Combined dependency: staff OR patient (ownership enforced below)
_ANY_ALLOWED = require_roles("admin", "doctor", "receptionist", "patient")

router = APIRouter(prefix="/medical-records", tags=["Medical Records"])


def _assert_patient_owns_record(
    record: MedicalRecord,
    scoped_patient_id: int,
    db: Session,
) -> None:
    """
    Verify that the medical record's parent appointment belongs to the patient.
    Raises 403 if the ownership check fails.
    """
    appt = db.get(Appointment, record.appointment_id)
    if appt is None or appt.patient_id != scoped_patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own medical records.",
        )


@router.post("/", response_model=MedicalRecordResponse, status_code=status.HTTP_201_CREATED)
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
    _: Annotated[UserProfile, Depends(_ANY_ALLOWED)] = None,
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
):
    if scoped_patient_id is not None:
        # Patient: join through appointments to filter by patient_id
        # Never trust appointment_id from the query string for patient-role
        stmt = (
            select(MedicalRecord)
            .join(Appointment, MedicalRecord.appointment_id == Appointment.appointment_id)
            .where(Appointment.patient_id == scoped_patient_id)
            .order_by(MedicalRecord.record_id)
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    # Staff: use service as before (optionally filtered by appointment_id)
    return get_medical_records(db, skip=skip, limit=limit, appointment_id=appointment_id)


@router.get("/{record_id}", response_model=MedicalRecordResponse)
def retrieve_medical_record(
    record_id: int,
    _: Annotated[UserProfile, Depends(_ANY_ALLOWED)] = None,
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
):
    record = get_medical_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    if scoped_patient_id is not None:
        _assert_patient_owns_record(record, scoped_patient_id, db)

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
