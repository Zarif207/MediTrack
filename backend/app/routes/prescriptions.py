from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_patient_id_for_user, require_roles
from app.database.dependencies import get_db
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.prescription import Prescription
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

_STAFF_READ  = require_roles("admin", "doctor", "pharmacist")
_WRITE_ROLES = require_roles("admin", "doctor")
_ANY_ALLOWED = require_roles("admin", "doctor", "pharmacist", "patient")

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])


def _assert_patient_owns_prescription(
    prescription: Prescription,
    scoped_patient_id: int,
    db: Session,
) -> None:
    record = db.get(MedicalRecord, prescription.record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    appt = db.get(Appointment, record.appointment_id)
    if appt is None or appt.patient_id != scoped_patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own prescriptions.",
        )


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
    _: Annotated[UserProfile, Depends(_ANY_ALLOWED)] = None,
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
):
    if scoped_patient_id is not None:
        # Walk: prescriptions → medical_records → appointments (patient_id)
        stmt = (
            select(Prescription)
            .join(MedicalRecord, Prescription.record_id == MedicalRecord.record_id)
            .join(Appointment, MedicalRecord.appointment_id == Appointment.appointment_id)
            .where(Appointment.patient_id == scoped_patient_id)
            .order_by(Prescription.prescription_id)
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    return get_prescriptions(db, skip, limit, record_id)


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
def retrieve_prescription(
    prescription_id: int,
    _: Annotated[UserProfile, Depends(_ANY_ALLOWED)] = None,
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
):
    prescription = get_prescription(db, prescription_id)
    if prescription is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")

    if scoped_patient_id is not None:
        _assert_patient_owns_prescription(prescription, scoped_patient_id, db)

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
