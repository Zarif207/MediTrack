from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientUpdate


def create_patient(db: Session, data: PatientCreate) -> Patient:
    patient = Patient(
        **data.model_dump(),
        registered_at=datetime.now(),
    )

    db.add(patient)

    try:
        db.commit()
        db.refresh(patient)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A patient with this email may already exist.",
        ) from exc

    return patient


def get_patients(db: Session, skip: int = 0, limit: int = 20) -> list[Patient]:
    statement = (
        select(Patient)
        .order_by(Patient.patient_id)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_patient(db: Session, patient_id: int) -> Patient | None:
    return db.get(Patient, patient_id)


def update_patient(
    db: Session,
    patient: Patient,
    data: PatientUpdate,
) -> Patient:
    changes = data.changes()

    for field, value in changes.items():
        setattr(patient, field, value)

    try:
        db.commit()
        db.refresh(patient)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The update conflicts with an existing database record.",
        ) from exc

    return patient


def delete_patient(db: Session, patient: Patient) -> None:
    db.delete(patient)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete this patient because related records exist.",
        ) from exc