from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatus,
    AppointmentUpdate,
)
from app.services.appointment_service import (
    create_appointment,
    delete_appointment,
    get_appointment,
    get_appointments,
    update_appointment,
)

# Appointments: admin and receptionist can write; doctor can read; patient can read own
_READ_ROLES = require_roles("admin", "receptionist", "doctor", "patient")
_WRITE_ROLES = require_roles("admin", "receptionist")

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post(
    "/",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_appointment_endpoint(
    data: AppointmentCreate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    return create_appointment(db, data)


@router.get("/", response_model=list[AppointmentResponse])
def list_appointments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    patient_id: int | None = Query(default=None, gt=0),
    doctor_id: int | None = Query(default=None, gt=0),
    appointment_status: AppointmentStatus | None = Query(default=None),
    _: Annotated[UserProfile, Depends(_READ_ROLES)] = None,
    db: Session = Depends(get_db),
):
    return get_appointments(
        db,
        skip=skip,
        limit=limit,
        patient_id=patient_id,
        doctor_id=doctor_id,
        appointment_status=appointment_status,
    )


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def retrieve_appointment(
    appointment_id: int,
    _: Annotated[UserProfile, Depends(_READ_ROLES)] = None,
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return appointment


@router.patch(
    "/{appointment_id}",
    response_model=AppointmentResponse,
)
def edit_appointment(
    appointment_id: int,
    data: AppointmentUpdate,
    _: Annotated[UserProfile, Depends(_WRITE_ROLES)],
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return update_appointment(db, appointment, data)


@router.delete(
    "/{appointment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_appointment(
    appointment_id: int,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    delete_appointment(db, appointment)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
