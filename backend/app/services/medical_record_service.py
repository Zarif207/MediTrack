from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth.ownership import owned_appointment_clause
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.user_profile import UserProfile
from app.schemas.medical_record import (
    MedicalRecordCreate,
    MedicalRecordUpdate,
)

_APPOINTMENT_DETAILS = (
    selectinload(MedicalRecord.appointment).selectinload(Appointment.patient),
    selectinload(MedicalRecord.appointment).selectinload(Appointment.booker),
)


def create_medical_record(
    db: Session,
    data: MedicalRecordCreate,
) -> MedicalRecord:
    appointment = db.get(Appointment, data.appointment_id)

    if appointment is None:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found.",
        )

    if appointment.patient_id is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Associate this appointment with a patient record before "
                "adding a medical record."
            ),
        )

    if appointment.status in ("cancelled", "no_show"):
        raise HTTPException(
            status_code=409,
            detail="Medical records cannot be added to cancelled or no-show appointments.",
        )

    if appointment.medical_record is not None:
        raise HTTPException(
            status_code=409,
            detail="This appointment already has a medical record.",
        )

    record = MedicalRecord(
        **data.model_dump(),
        record_date=datetime.now(),
    )

    db.add(record)

    try:
        db.commit()
        db.refresh(record)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "A medical record already exists for this appointment "
                "or a database constraint was violated."
            ),
        ) from exc

    return record


def get_medical_records(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    appointment_id: int | None = None,
    owner: UserProfile | None = None,
) -> list[MedicalRecord]:
    """List records. When `owner` is given, only that patient's are returned."""
    statement = (
        select(MedicalRecord)
        .options(*_APPOINTMENT_DETAILS)
        .order_by(MedicalRecord.record_id)
    )

    if owner is not None:
        statement = statement.join(
            Appointment, MedicalRecord.appointment_id == Appointment.appointment_id
        ).where(owned_appointment_clause(owner))

    if appointment_id is not None:
        statement = statement.where(
            MedicalRecord.appointment_id == appointment_id
        )

    statement = statement.offset(skip).limit(limit)

    return list(db.scalars(statement).all())


def get_medical_record(
    db: Session,
    record_id: int,
) -> MedicalRecord | None:
    return db.get(MedicalRecord, record_id)


def update_medical_record(
    db: Session,
    record: MedicalRecord,
    data: MedicalRecordUpdate,
) -> MedicalRecord:
    changes = data.changes()

    for field, value in changes.items():
        setattr(record, field, value)

    try:
        db.commit()
        db.refresh(record)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Medical record update violated a database constraint.",
        ) from exc

    return record


def delete_medical_record(
    db: Session,
    record: MedicalRecord,
) -> None:
    if record.prescriptions:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete a medical record that has linked prescriptions."
            ),
        )

    db.delete(record)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete this medical record because related records exist.",
        ) from exc