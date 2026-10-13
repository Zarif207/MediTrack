from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_patient_id_for_user, require_roles
from app.database.dependencies import get_db
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.prescription import Prescription
from app.models.prescription_item import PrescriptionItem
from app.models.user_profile import UserProfile
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

_STAFF_READ  = require_roles("admin", "doctor", "pharmacist")
_WRITE_ROLES = require_roles("admin", "doctor", "pharmacist")
_ANY_ALLOWED = require_roles("admin", "doctor", "pharmacist", "patient")

router = APIRouter(prefix="/prescription-items", tags=["Prescription Items"])


def _assert_patient_owns_item(
    item: PrescriptionItem,
    scoped_patient_id: int,
    db: Session,
) -> None:
    """Verify the item's parent prescription belongs to the patient via the full chain."""
    pres = db.get(Prescription, item.prescription_id)
    if pres is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    record = db.get(MedicalRecord, pres.record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    appt = db.get(Appointment, record.appointment_id)
    if appt is None or appt.patient_id != scoped_patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own prescription items.",
        )


@router.post("/", response_model=PrescriptionItemResponse, status_code=201)
def create_prescription_item_endpoint(
    data: PrescriptionItemCreate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    return create_prescription_item(db, data)


@router.get("/", response_model=list[PrescriptionItemResponse])
def list_prescription_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    prescription_id: int | None = Query(default=None, gt=0),
    current_user: Annotated[UserProfile, Depends(get_current_user)] = None,
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "patient":
        if scoped_patient_id is None:
            return []  # no patient record yet
        stmt = (
            select(PrescriptionItem)
            .join(Prescription, PrescriptionItem.prescription_id == Prescription.prescription_id)
            .join(MedicalRecord, Prescription.record_id == MedicalRecord.record_id)
            .join(Appointment, MedicalRecord.appointment_id == Appointment.appointment_id)
            .where(Appointment.patient_id == scoped_patient_id)
            .order_by(PrescriptionItem.prescription_item_id)
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    return get_prescription_items(db, skip, limit, prescription_id)


@router.get("/{item_id}", response_model=PrescriptionItemResponse)
def retrieve_prescription_item(
    item_id: int,
    current_user: Annotated[UserProfile, Depends(get_current_user)] = None,
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
):
    item = get_prescription_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Prescription item not found.")

    if current_user.role == "patient":
        if scoped_patient_id is None:
            raise HTTPException(status_code=404, detail="Prescription item not found.")
        _assert_patient_owns_item(item, scoped_patient_id, db)

    return item


@router.patch("/{item_id}", response_model=PrescriptionItemResponse)
def edit_prescription_item(
    item_id: int,
    data: PrescriptionItemUpdate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    item = get_prescription_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Prescription item not found.")
    return update_prescription_item(db, item, data)


@router.delete("/{item_id}", status_code=204)
def remove_prescription_item(
    item_id: int,
    _: Annotated[UserProfile, Depends(require_roles("admin", "doctor"))],
    db: Session = Depends(get_db),
):
    item = get_prescription_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Prescription item not found.")
    delete_prescription_item(db, item)
    return Response(status_code=204)
