from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.bill import BillCreate, BillResponse, BillUpdate
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
    db: Session = Depends(get_db),
) -> list[BillResponse]:
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
    db: Session = Depends(get_db),
) -> BillResponse:
    return get_bill(db, bill_id)


@router.patch("/{bill_id}", response_model=BillResponse)
def update_bill_endpoint(
    bill_id: int,
    data: BillUpdate,
    db: Session = Depends(get_db),
) -> BillResponse:
    return update_bill(db, bill_id, data)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill_endpoint(
    bill_id: int,
    db: Session = Depends(get_db),
) -> Response:
    delete_bill(db, bill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
