from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.ownership import owned_appointment_clause
from app.models.appointment import Appointment
from app.models.bill import Bill
from app.models.patient import Patient
from app.models.user_profile import UserProfile
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

    if appointment.patient_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Associate this appointment with a patient record before "
                "issuing a bill."
            ),
        )

    if appointment.status in ("cancelled", "no_show"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bills cannot be issued for cancelled or no-show appointments.",
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
    owner: UserProfile | None = None,
) -> list[Bill]:
    """List bills. When `owner` is given, only that patient's are returned."""
    query = select(Bill)

    if owner is not None:
        query = query.join(
            Appointment, Bill.appointment_id == Appointment.appointment_id
        ).where(owned_appointment_clause(owner))

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
    updates = data.changes()

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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete this bill because related records exist.",
        ) from exc
