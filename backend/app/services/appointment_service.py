from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate


ACTIVE_STATUSES = ("scheduled", "confirmed")


def _check_patient_and_doctor(
    db: Session,
    patient_id: int,
    doctor_id: int,
) -> None:
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="Patient not found.")

    if db.get(Doctor, doctor_id) is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")


def _check_appointment_conflict(
    db: Session,
    doctor_id: int,
    appointment_date,
    appointment_time,
    exclude_appointment_id: int | None = None,
) -> None:
    statement = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.appointment_time == appointment_time,
        Appointment.status.in_(ACTIVE_STATUSES),
    )

    if exclude_appointment_id is not None:
        statement = statement.where(
            Appointment.appointment_id != exclude_appointment_id
        )

    existing_appointment = db.scalars(statement).first()

    if existing_appointment is not None:
        raise HTTPException(
            status_code=409,
            detail="The doctor already has an active appointment at that date and time.",
        )


def create_appointment(
    db: Session,
    data: AppointmentCreate,
) -> Appointment:
    _check_patient_and_doctor(
        db,
        data.patient_id,
        data.doctor_id,
    )

    if data.status in ACTIVE_STATUSES:
        _check_appointment_conflict(
            db,
            data.doctor_id,
            data.appointment_date,
            data.appointment_time,
        )

    appointment = Appointment(
        **data.model_dump(),
        created_at=datetime.now(),
    )

    db.add(appointment)

    try:
        db.commit()
        db.refresh(appointment)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Appointment conflicts with a database constraint.",
        ) from exc

    return appointment


def get_appointments(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    patient_id: int | None = None,
    doctor_id: int | None = None,
    appointment_status: str | None = None,
) -> list[Appointment]:
    statement = select(Appointment).order_by(
        Appointment.appointment_date,
        Appointment.appointment_time,
        Appointment.appointment_id,
    )

    if patient_id is not None:
        statement = statement.where(
            Appointment.patient_id == patient_id
        )

    if doctor_id is not None:
        statement = statement.where(
            Appointment.doctor_id == doctor_id
        )

    if appointment_status is not None:
        statement = statement.where(
            Appointment.status == appointment_status
        )

    statement = statement.offset(skip).limit(limit)

    return list(db.scalars(statement).all())


def get_appointment(
    db: Session,
    appointment_id: int,
) -> Appointment | None:
    return db.get(Appointment, appointment_id)


def update_appointment(
    db: Session,
    appointment: Appointment,
    data: AppointmentUpdate,
) -> Appointment:
    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one field to update.",
        )

    required_fields = (
        "patient_id",
        "doctor_id",
        "appointment_date",
        "appointment_time",
        "status",
    )

    for field in required_fields:
        if field in changes and changes[field] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null.",
            )

    new_patient_id = changes.get(
        "patient_id", appointment.patient_id
    )
    new_doctor_id = changes.get(
        "doctor_id", appointment.doctor_id
    )
    new_date = changes.get(
        "appointment_date", appointment.appointment_date
    )
    new_time = changes.get(
        "appointment_time", appointment.appointment_time
    )
    new_status = changes.get("status", appointment.status)

    _check_patient_and_doctor(
        db,
        new_patient_id,
        new_doctor_id,
    )

    if new_status in ACTIVE_STATUSES:
        _check_appointment_conflict(
            db,
            new_doctor_id,
            new_date,
            new_time,
            exclude_appointment_id=appointment.appointment_id,
        )

    for field, value in changes.items():
        setattr(appointment, field, value)

    try:
        db.commit()
        db.refresh(appointment)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Appointment update conflicts with a database constraint.",
        ) from exc

    return appointment


def delete_appointment(
    db: Session,
    appointment: Appointment,
) -> None:
    if (
        appointment.medical_record is not None
        or appointment.bill is not None
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete an appointment linked to a medical record "
                "or bill."
            ),
        )

    db.delete(appointment)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete this appointment because related records exist.",
        ) from exc