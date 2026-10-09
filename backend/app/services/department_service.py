from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentUpdate


def create_department(db: Session, data: DepartmentCreate) -> Department:
    department = Department(**data.model_dump())
    db.add(department)

    try:
        db.commit()
        db.refresh(department)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Department name already exists or violates a database constraint.",
        ) from exc

    return department


def get_departments(
    db: Session,
    skip: int = 0,
    limit: int = 20,
) -> list[Department]:
    statement = (
        select(Department)
        .order_by(Department.department_id)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_department(db: Session, department_id: int) -> Department | None:
    return db.get(Department, department_id)


def update_department(
    db: Session,
    department: Department,
    data: DepartmentUpdate,
) -> Department:
    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one field to update.",
        )

    for field, value in changes.items():
        setattr(department, field, value)

    try:
        db.commit()
        db.refresh(department)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Department update conflicts with a database constraint.",
        ) from exc

    return department


def delete_department(db: Session, department: Department) -> None:
    db.delete(department)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a department that has doctors assigned to it.",
        ) from exc