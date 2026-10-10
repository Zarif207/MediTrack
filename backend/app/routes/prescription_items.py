from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.prescription_item import (
    PrescriptionItemCreate,
    PrescriptionItemResponse,
    PrescriptionItemUpdate,
)
from app.services.prescription_item_service import (
    create_prescription_item,
    delete_prescription_item,
    get_prescription_item,
    get_prescription_items,
    update_prescription_item,
)

router = APIRouter(
    prefix="/prescription-items",
    tags=["Prescription Items"],
)


@router.post("/", response_model=PrescriptionItemResponse, status_code=201)
def create_prescription_item_endpoint(
    data: PrescriptionItemCreate, db: Session = Depends(get_db)
):
    return create_prescription_item(db, data)


@router.get("/", response_model=list[PrescriptionItemResponse])
def list_prescription_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    prescription_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
):
    return get_prescription_items(db, skip, limit, prescription_id)


@router.get("/{item_id}", response_model=PrescriptionItemResponse)
def retrieve_prescription_item(
    item_id: int, db: Session = Depends(get_db)
):
    item = get_prescription_item(db, item_id)
    if item is None:
        raise HTTPException(
            status_code=404, detail="Prescription item not found."
        )
    return item


@router.patch("/{item_id}", response_model=PrescriptionItemResponse)
def edit_prescription_item(
    item_id: int,
    data: PrescriptionItemUpdate,
    db: Session = Depends(get_db),
):
    item = get_prescription_item(db, item_id)
    if item is None:
        raise HTTPException(
            status_code=404, detail="Prescription item not found."
        )
    return update_prescription_item(db, item, data)


@router.delete("/{item_id}", status_code=204)
def remove_prescription_item(
    item_id: int, db: Session = Depends(get_db)
):
    item = get_prescription_item(db, item_id)
    if item is None:
        raise HTTPException(
            status_code=404, detail="Prescription item not found."
        )
    delete_prescription_item(db, item)
    return Response(status_code=204)