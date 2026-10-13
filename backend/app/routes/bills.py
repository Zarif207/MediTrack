from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_patient_id_for_user, require_roles
from app.database.dependencies import get_db
from app.models.bill import Bill
from app.models.user_profile import UserProfile
from app.schemas.bill import BillCreate, BillResponse, BillUpdate
from app.services.bill_service import (
    create_bill,
    delete_bill,
    get_bill,
    get_bills,
    update_bill,
)

_WRITE_ROLES = require_roles("admin", "receptionist", "accountant")
_ANY_ALLOWED = require_roles("admin", "receptionist", "accountant", "patient")

router = APIRouter(prefix="/bills", tags=["Bills"])


@router.post("/", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def create_bill_endpoint(
    data: BillCreate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
) -> BillResponse:
    return create_bill(db, data)


@router.get("/", response_model=list[BillResponse])
def list_bills_endpoint(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    patient_id: int | None = Query(default=None, gt=0),
    appointment_id: int | None = Query(default=None, gt=0),
    payment_status: str | None = Query(
        default=None,
        pattern="^(pending|paid|cancelled)$",
    ),
    current_user: Annotated[UserProfile, Depends(get_current_user)] = None,
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
) -> list[BillResponse]:
    if current_user.role == "patient":
        if scoped_patient_id is None:
            return []  # no patient record yet — empty list, not 403
        return get_bills(
            db,
            skip=skip,
            limit=limit,
            patient_id=scoped_patient_id,
            appointment_id=appointment_id,
            payment_status=payment_status,
        )

    return get_bills(
        db,
        skip=skip,
        limit=limit,
        patient_id=patient_id,
        appointment_id=appointment_id,
        payment_status=payment_status,
    )


@router.get("/{bill_id}", response_model=BillResponse)
def get_bill_endpoint(
    bill_id: int,
    current_user: Annotated[UserProfile, Depends(get_current_user)] = None,
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
) -> BillResponse:
    if current_user.role == "patient" and scoped_patient_id is None:
        # No patient record yet — cannot own any bill
        raise HTTPException(status_code=404, detail="Bill not found.")

    bill = get_bill(db, bill_id)

    if current_user.role == "patient" and scoped_patient_id is not None and bill.patient_id != scoped_patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own bills.",
        )

    return bill


@router.patch("/{bill_id}", response_model=BillResponse)
def update_bill_endpoint(
    bill_id: int,
    data: BillUpdate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
) -> BillResponse:
    return update_bill(db, bill_id, data)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill_endpoint(
    bill_id: int,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
) -> Response:
    delete_bill(db, bill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
