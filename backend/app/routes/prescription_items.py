from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import allow_patient_or, require_permission
from app.auth.ownership import can_access, is_scoped, not_found
from app.models.prescription import Prescription
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, IdQuery, Limit, Skip
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

router = APIRouter(prefix="/prescription-items", tags=["Prescription Items"])


def _owned_prescription(user: UserProfile, prescription) -> bool:
    record = prescription.medical_record if prescription else None
    return record is not None and can_access(user, record.appointment)


def _owned(user: UserProfile, item) -> bool:
    return _owned_prescription(user, item.prescription)


@router.post("/", response_model=PrescriptionItemResponse, status_code=status.HTTP_201_CREATED)
def create_prescription_item_endpoint(
    data: PrescriptionItemCreate,
    current_user: Annotated[UserProfile, Depends(require_permission("prescription_items:write"))],
    db: Session = Depends(get_db),
):
    prescription = db.get(Prescription, data.prescription_id)
    if prescription is not None and not _owned_prescription(current_user, prescription):
        raise not_found("Prescription")
    return create_prescription_item(db, data)


@router.get("/", response_model=list[PrescriptionItemResponse])
def list_prescription_items(
    current_user: Annotated[UserProfile, Depends(allow_patient_or("prescription_items:read"))],
    skip: Skip = 0,
    limit: Limit = 20,
    prescription_id: IdQuery | None = None,
    db: Session = Depends(get_db),
):
    return get_prescription_items(
        db, skip=skip, limit=limit,
        prescription_id=prescription_id,
        owner=current_user if is_scoped(current_user) else None,
    )


@router.get("/{item_id}", response_model=PrescriptionItemResponse)
def retrieve_prescription_item(
    item_id: IdPath,
    current_user: Annotated[UserProfile, Depends(allow_patient_or("prescription_items:read"))],
    db: Session = Depends(get_db),
):
    item = get_prescription_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Prescription item not found.")
    if not _owned(current_user, item):
        raise not_found("Prescription item")
    return item


@router.patch("/{item_id}", response_model=PrescriptionItemResponse)
def edit_prescription_item(
    item_id: IdPath,
    data: PrescriptionItemUpdate,
    current_user: Annotated[UserProfile, Depends(require_permission("prescription_items:write"))],
    db: Session = Depends(get_db),
):
    item = get_prescription_item(db, item_id)
    if item is None or not _owned(current_user, item):
        raise HTTPException(status_code=404, detail="Prescription item not found.")
    return update_prescription_item(db, item, data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_prescription_item(
    item_id: IdPath,
    current_user: Annotated[UserProfile, Depends(require_permission("prescription_items:delete"))],
    db: Session = Depends(get_db),
):
    item = get_prescription_item(db, item_id)
    if item is None or not _owned(current_user, item):
        raise HTTPException(status_code=404, detail="Prescription item not found.")
    delete_prescription_item(db, item)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
