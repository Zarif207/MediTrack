from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.bill import Bill
from app.models.patient import Patient
from app.schemas.bill import BillCreate, BillUpdate


def create_bill(db: Session, data: BillCreate) -> Bill:
    patient = db.get(Patient, data.patient_id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    appointment = db.get(Appointment, data.appointment_id)
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.patient_id != data.patient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The appointment does not belong to this patient",
        )

    existing_bill = db.scalar(
        select(Bill).where(Bill.appointment_id == data.appointment_id)
    )
    if existing_bill is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A bill already exists for this appointment",
        )

    bill = Bill(
        patient_id=data.patient_id,
        appointment_id=data.appointment_id,
        amount=data.amount,
        payment_status=data.payment_status,
        payment_method=data.payment_method,
        issued_at=datetime.now(),
        paid_at=(
            datetime.now()
            if data.payment_status == "paid"
            else None
        ),
    )

    try:
        db.add(bill)
        db.commit()
        db.refresh(bill)
        return bill
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create bill because of a database constraint",
        ) from exc


def get_bills(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    patient_id: int | None = None,
    appointment_id: int | None = None,
    payment_status: str | None = None,
) -> list[Bill]:
    query = select(Bill)

    if patient_id is not None:
        query = query.where(Bill.patient_id == patient_id)

    if appointment_id is not None:
        query = query.where(Bill.appointment_id == appointment_id)

    if payment_status is not None:
        query = query.where(Bill.payment_status == payment_status)

    query = query.order_by(Bill.bill_id).offset(skip).limit(limit)
    return list(db.scalars(query).all())


def get_bill(db: Session, bill_id: int) -> Bill:
    bill = db.get(Bill, bill_id)

    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bill not found",
        )

    return bill


def update_bill(db: Session, bill_id: int, data: BillUpdate) -> Bill:
    bill = get_bill(db, bill_id)
    updates = data.model_dump(exclude_unset=True)

    if "amount" in updates and updates["amount"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Amount cannot be null",
        )

    if "payment_status" in updates and updates["payment_status"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Payment status cannot be null",
        )

    if updates.get("payment_status") == "paid":
        if bill.payment_status != "paid":
            bill.paid_at = datetime.now()

    elif updates.get("payment_status") in {"pending", "cancelled"}:
        bill.paid_at = None

    for field, value in updates.items():
        setattr(bill, field, value)

    try:
        db.commit()
        db.refresh(bill)
        return bill
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update bill because of a database constraint",
        ) from exc


def delete_bill(db: Session, bill_id: int) -> None:
    bill = get_bill(db, bill_id)
    db.delete(bill)
    db.commit()
