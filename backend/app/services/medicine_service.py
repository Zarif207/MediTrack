from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.medicine import Medicine
from app.models.prescription_item import PrescriptionItem
from app.schemas.medicine import MedicineCreate, MedicineUpdate


def create_medicine(db: Session, data: MedicineCreate) -> Medicine:
    medicine = Medicine(**data.model_dump())
    db.add(medicine)

    try:
        db.commit()
        db.refresh(medicine)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Medicine could not be created because of a database constraint.",
        ) from exc

    return medicine


def get_medicines(
    db: Session, skip: int = 0, limit: int = 20
) -> list[Medicine]:
    statement = (
        select(Medicine)
        .order_by(Medicine.medicine_id)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_medicine(db: Session, medicine_id: int) -> Medicine | None:
    return db.get(Medicine, medicine_id)


def update_medicine(
    db: Session, medicine: Medicine, data: MedicineUpdate
) -> Medicine:
    changes = data.changes()


    for field, value in changes.items():
        setattr(medicine, field, value)

    try:
        db.commit()
        db.refresh(medicine)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Medicine update violated a database constraint.",
        ) from exc

    return medicine


def delete_medicine(db: Session, medicine: Medicine) -> None:
    existing_item = db.scalars(
        select(PrescriptionItem).where(
            PrescriptionItem.medicine_id == medicine.medicine_id
        ).limit(1)
    ).first()

    if existing_item is not None:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a medicine referenced by a prescription.",
        )

    db.delete(medicine)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete this medicine because related records exist.",
        ) from exc