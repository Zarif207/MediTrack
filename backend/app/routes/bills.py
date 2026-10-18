from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import allow_patient_or, require_patient, require_permission
from app.auth.ownership import is_patient, not_found, owned_appointment_clause, owns_appointment
from app.database.dependencies import get_db
from app.models.appointment import Appointment
from app.models.bill import Bill
from app.models.payment import BillPayment
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, IdQuery, Limit, Skip
from app.schemas.bill import (
    BillCreate, BillResponse, BillSummary, BillUpdate, CheckoutResponse, PaymentStatus,
)
from app.services import payment_service
from app.services.bill_service import (
    create_bill,
    delete_bill,
    get_bill,
    get_bills,
    update_bill,
)

router = APIRouter(prefix="/bills", tags=["Bills"])


@router.post("/", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def create_bill_endpoint(
    data: BillCreate,
    _: Annotated[UserProfile, Depends(require_permission("bills:write"))],
    db: Session = Depends(get_db),
):
    return create_bill(db, data)


@router.get("/", response_model=list[BillResponse])
def list_bills_endpoint(
    current_user: Annotated[UserProfile, Depends(allow_patient_or("bills:read"))],
    skip: Skip = 0,
    limit: Limit = 100,
    patient_id: IdQuery | None = None,
    appointment_id: IdQuery | None = None,
    payment_status: PaymentStatus | None = None,
    db: Session = Depends(get_db),
):
    if is_patient(current_user):
        # patient_id from the query string is ignored for patients.
        return get_bills(
            db, skip=skip, limit=limit,
            appointment_id=appointment_id,
            payment_status=payment_status,
            owner=current_user,
        )
    return get_bills(
        db, skip=skip, limit=limit,
        patient_id=patient_id,
        appointment_id=appointment_id,
        payment_status=payment_status,
    )


@router.get("/summary", response_model=BillSummary)
def bill_summary(
    current_user: Annotated[UserProfile, Depends(allow_patient_or("bills:read"))],
    db: Session = Depends(get_db),
):
    """Pending bills and patients whose bills are all paid. Patients see only their own."""
    stmt = select(Bill).options(selectinload(Bill.patient))
    if is_patient(current_user):
        stmt = stmt.join(Appointment, Bill.appointment_id == Appointment.appointment_id).where(
            owned_appointment_clause(current_user))
    bills = list(db.scalars(stmt).all())
    open_ids = set(db.scalars(
        select(BillPayment.bill_id).where(
            BillPayment.status == "open", BillPayment.expires_at > datetime.now(),
            BillPayment.bill_id.in_([b.bill_id for b in bills]),
        )
    ).all()) if bills else set()
    return payment_service.summarise(bills, open_ids)


@router.post("/{bill_id}/checkout", response_model=CheckoutResponse)
def start_checkout(
    bill_id: IdPath,
    current_user: Annotated[UserProfile, Depends(require_patient())],
    db: Session = Depends(get_db),
):
    """
    Start (or resume) Stripe Checkout for a pending bill. Only patients may pay,
    and only their own bills; every staff role is refused (403) before the bill
    is looked up. The amount always comes from the bill on the server.
    """
    bill = get_bill(db, bill_id)
    if not owns_appointment(current_user, bill.appointment):
        raise not_found("Bill")
    payment = payment_service.start_checkout(db, bill_id, current_user)
    return {"checkout_url": payment.checkout_url, "session_id": payment.stripe_session_id,
            "expires_at": payment.expires_at}


@router.get("/{bill_id}", response_model=BillResponse)
def get_bill_endpoint(
    bill_id: IdPath,
    current_user: Annotated[UserProfile, Depends(allow_patient_or("bills:read"))],
    db: Session = Depends(get_db),
):
    bill = get_bill(db, bill_id)
    if is_patient(current_user) and not owns_appointment(current_user, bill.appointment):
        raise not_found("Bill")
    return bill


@router.patch("/{bill_id}", response_model=BillResponse)
def update_bill_endpoint(
    bill_id: IdPath,
    data: BillUpdate,
    _: Annotated[UserProfile, Depends(require_permission("bills:write"))],
    db: Session = Depends(get_db),
):
    # Locked so a Stripe confirmation for this bill cannot interleave with the edit.
    before = payment_service.lock_bill(db, bill_id)
    old_amount, old_status = before.amount, before.payment_status
    changes = {k: v for k, v in data.changes().items() if getattr(before, k) != v}
    if changes and changes != {"payment_status": "cancelled"} and payment_service.settled_online(db, bill_id):
        # Reverting or re-pricing a bill Stripe has settled would let it be paid
        # again and leave the records disagreeing with Stripe.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This bill was paid online. Refund it in the Stripe Dashboard first; "
                   "after that it can only be marked cancelled.",
        )
    bill = update_bill(db, bill_id, data)
    # A changed amount or a bill that is no longer pending must not stay payable
    # through a Checkout Session created earlier.
    if bill.amount != old_amount or (old_status == "pending" and bill.payment_status != "pending"):
        payment_service.expire_open_sessions(db, bill_id, "Bill changed by staff; checkout closed.")
        db.commit()
        db.refresh(bill)
    return bill


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill_endpoint(
    bill_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("bills:delete"))],
    db: Session = Depends(get_db),
):
    delete_bill(db, bill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
