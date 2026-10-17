from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth.ownership import owned_appointment_clause
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.medicine import Medicine
from app.models.prescription import Prescription
from app.models.prescription_item import PrescriptionItem
from app.models.user_profile import UserProfile
from app.schemas.prescription_item import (
    PrescriptionItemCreate,
    PrescriptionItemUpdate,
)


def create_prescription_item(
    db: Session, data: PrescriptionItemCreate
) -> PrescriptionItem:
    if db.get(Prescription, data.prescription_id) is None:
        raise HTTPException(status_code=404, detail="Prescription not found.")

    if db.get(Medicine, data.medicine_id) is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    duplicate = db.scalars(
        select(PrescriptionItem).where(
            PrescriptionItem.prescription_id == data.prescription_id,
            PrescriptionItem.medicine_id == data.medicine_id,
        )
    ).first()

    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail="This medicine is already included in the prescription.",
        )

    item = PrescriptionItem(**data.model_dump())
    db.add(item)

    try:
        db.commit()
        db.refresh(item)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Prescription item conflicts with a database constraint.",
        ) from exc

    return item


def get_prescription_items(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    prescription_id: int | None = None,
    owner: UserProfile | None = None,
) -> list[PrescriptionItem]:
    """List items. When `owner` is given, only that patient's are returned."""
    statement = (
        select(PrescriptionItem)
        .options(selectinload(PrescriptionItem.medicine))
        .order_by(PrescriptionItem.prescription_item_id)
    )

    if owner is not None:
        statement = (
            statement.join(Prescription, PrescriptionItem.prescription_id == Prescription.prescription_id)
            .join(MedicalRecord, Prescription.record_id == MedicalRecord.record_id)
            .join(Appointment, MedicalRecord.appointment_id == Appointment.appointment_id)
            .where(owned_appointment_clause(owner))
        )

    if prescription_id is not None:
        statement = statement.where(
            PrescriptionItem.prescription_id == prescription_id
        )

    return list(db.scalars(statement.offset(skip).limit(limit)).all())


def get_prescription_item(
    db: Session, item_id: int
) -> PrescriptionItem | None:
    return db.get(PrescriptionItem, item_id)


def update_prescription_item(
    db: Session,
    item: PrescriptionItem,
    data: PrescriptionItemUpdate,
) -> PrescriptionItem:
    changes = data.changes()


    for field, value in changes.items():
        setattr(item, field, value)

    try:
        db.commit()
        db.refresh(item)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Prescription item update violated a database constraint.",
        ) from exc

    return item


def delete_prescription_item(
    db: Session, item: PrescriptionItem
) -> None:
    db.delete(item)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete this prescription item because related records exist.",
        ) from exc