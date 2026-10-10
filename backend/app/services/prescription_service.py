from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.medical_record import MedicalRecord
from app.models.prescription import Prescription
from app.models.prescription_item import PrescriptionItem
from app.schemas.prescription import PrescriptionCreate, PrescriptionUpdate


def create_prescription(
    db: Session, data: PrescriptionCreate
) -> Prescription:
    if db.get(MedicalRecord, data.record_id) is None:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    prescription = Prescription(
        **data.model_dump(),
        prescription_date=datetime.now(),
    )
    db.add(prescription)

    try:
        db.commit()
        db.refresh(prescription)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Prescription could not be created because of a database constraint.",
        ) from exc

    return prescription


def get_prescriptions(
    db: Session, skip: int = 0, limit: int = 20, record_id: int | None = None
) -> list[Prescription]:
    statement = select(Prescription).order_by(Prescription.prescription_id)

    if record_id is not None:
        statement = statement.where(Prescription.record_id == record_id)

    return list(db.scalars(statement.offset(skip).limit(limit)).all())


def get_prescription(
    db: Session, prescription_id: int
) -> Prescription | None:
    return db.get(Prescription, prescription_id)


def update_prescription(
    db: Session, prescription: Prescription, data: PrescriptionUpdate
) -> Prescription:
    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one field to update.",
        )

    for field, value in changes.items():
        setattr(prescription, field, value)

    try:
        db.commit()
        db.refresh(prescription)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Prescription update violated a database constraint.",
        ) from exc

    return prescription


def delete_prescription(db: Session, prescription: Prescription) -> None:
    has_items = db.scalars(
        select(PrescriptionItem.prescription_item_id)
        .where(PrescriptionItem.prescription_id == prescription.prescription_id)
        .limit(1)
    ).first()

    if has_items is not None:
        raise HTTPException(
            status_code=409,
            detail="Remove the prescription items before deleting the prescription.",
        )

    db.delete(prescription)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete this prescription because related records exist.",
        ) from exc