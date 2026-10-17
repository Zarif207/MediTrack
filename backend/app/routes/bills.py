from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import allow_patient_or, require_permission
from app.auth.ownership import is_patient, not_found, owns_appointment
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, IdQuery, Limit, Skip
from app.schemas.bill import BillCreate, BillResponse, BillUpdate, PaymentStatus
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
    return update_bill(db, bill_id, data)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill_endpoint(
    bill_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("bills:delete"))],
    db: Session = Depends(get_db),
):
    delete_bill(db, bill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
