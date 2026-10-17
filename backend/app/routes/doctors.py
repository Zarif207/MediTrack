from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    allow_patient_or,
    get_optional_user,
    require_permission,
)
from app.auth.permissions import is_staff
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, Limit, Skip
from app.schemas.appointment import AvailabilityResponse
from app.schemas.doctor import (
    DoctorCreate,
    DoctorPublicResponse,
    DoctorResponse,
    DoctorUpdate,
)
from app.services.appointment_service import get_availability
from app.services.doctor_service import (
    create_doctor,
    delete_doctor,
    get_doctor,
    get_doctors,
    update_doctor,
)

# The doctor directory is public. Contact and licensing details are returned
# only to signed-in staff; everyone else receives the public view.
router = APIRouter(prefix="/doctors", tags=["Doctors"])


def _present(doctor, viewer: UserProfile | None):
    if viewer is not None and is_staff(viewer.role):
        return DoctorResponse.model_validate(doctor)
    return DoctorPublicResponse.model_validate(doctor)


@router.post(
    "/",
    response_model=DoctorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_doctor_endpoint(
    data: DoctorCreate,
    _: Annotated[UserProfile, Depends(require_permission("doctors:write"))],
    db: Session = Depends(get_db),
):
    return create_doctor(db, data)


@router.get("/", response_model=list[DoctorResponse | DoctorPublicResponse])
def list_doctors(
    viewer: Annotated[UserProfile | None, Depends(get_optional_user)],
    skip: Skip = 0,
    limit: Limit = 20,
    db: Session = Depends(get_db),
):
    return [_present(d, viewer) for d in get_doctors(db, skip=skip, limit=limit)]


@router.get("/{doctor_id}", response_model=DoctorResponse | DoctorPublicResponse)
def retrieve_doctor(
    doctor_id: IdPath,
    viewer: Annotated[UserProfile | None, Depends(get_optional_user)],
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    return _present(doctor, viewer)


@router.get("/{doctor_id}/availability", response_model=AvailabilityResponse)
def doctor_availability(
    doctor_id: IdPath,
    on: date,
    _: Annotated[UserProfile, Depends(allow_patient_or("appointments:read"))],
    db: Session = Depends(get_db),
):
    """Bookable slots for a date. Returns times only — never who holds them."""
    return get_availability(db, doctor_id, on)


@router.patch("/{doctor_id}", response_model=DoctorResponse)
def edit_doctor(
    doctor_id: IdPath,
    data: DoctorUpdate,
    _: Annotated[UserProfile, Depends(require_permission("doctors:write"))],
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    return update_doctor(db, doctor, data)


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_doctor(
    doctor_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("doctors:delete"))],
    db: Session = Depends(get_db),
):
    doctor = get_doctor(db, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    delete_doctor(db, doctor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
