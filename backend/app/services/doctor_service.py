from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.doctor import Doctor
from app.schemas.doctor import DoctorCreate, DoctorUpdate


def create_doctor(db: Session, data: DoctorCreate) -> Doctor:
    department = db.get(Department, data.department_id)

    if department is None:
        raise HTTPException(
            status_code=404,
            detail="Department not found.",
        )

    doctor = Doctor(**data.model_dump())
    db.add(doctor)

    try:
        db.commit()
        db.refresh(doctor)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Doctor email or license number already exists, or a database constraint was violated.",
        ) from exc

    return doctor


def get_doctors(
    db: Session,
    skip: int = 0,
    limit: int = 20,
) -> list[Doctor]:
    statement = (
        select(Doctor)
        .order_by(Doctor.doctor_id)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_doctor(db: Session, doctor_id: int) -> Doctor | None:
    return db.get(Doctor, doctor_id)


def update_doctor(
    db: Session,
    doctor: Doctor,
    data: DoctorUpdate,
) -> Doctor:
    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one field to update.",
        )

    if "department_id" in changes and changes["department_id"] is not None:
        department = db.get(Department, changes["department_id"])

        if department is None:
            raise HTTPException(
                status_code=404,
                detail="Department not found.",
            )

    for field, value in changes.items():
        setattr(doctor, field, value)

    try:
        db.commit()
        db.refresh(doctor)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Doctor update conflicts with an existing record or database constraint.",
        ) from exc

    return doctor


def delete_doctor(db: Session, doctor: Doctor) -> None:
    db.delete(doctor)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a doctor who has existing appointments.",
        ) from exc