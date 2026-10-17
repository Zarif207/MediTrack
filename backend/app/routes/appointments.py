"""
Appointments router.

  POST   /appointments/book          patient          self-booking (owner = verified UID)
  POST   /appointments/{id}/cancel   patient          cancel own upcoming appointment
  POST   /appointments/              appointments:write   staff scheduling for a patient record
  GET    /appointments/              patient (own) | appointments:read
  GET    /appointments/{id}          patient (own) | appointments:read
  PATCH  /appointments/{id}          appointments:write
  DELETE /appointments/{id}          appointments:delete

A patient-role account can book without a clinical patient record. The booking
is stored against the Firebase UID taken from the verified ID token; the body
cannot choose the owner. Staff can later associate the booking with a patient
record (PATCH patient_id, or by linking the account in user management).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import allow_patient_or, require_patient, require_permission
from app.auth.ownership import is_patient, not_found, owns_appointment
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile
from app.routes.params import IdPath, IdQuery, Limit, Skip
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatus,
    AppointmentUpdate,
    PatientBookingRequest,
)
from app.services.appointment_service import (
    book_appointment,
    cancel_by_patient,
    create_appointment,
    delete_appointment,
    get_appointment,
    get_appointments,
    update_appointment,
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post(
    "/book",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Patient self-booking — the owner is the verified Firebase account",
)
def book_appointment_endpoint(
    data: PatientBookingRequest,
    current_user: Annotated[UserProfile, Depends(require_patient())],
    db: Session = Depends(get_db),
):
    return book_appointment(db, current_user, data)


@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment_endpoint(
    data: AppointmentCreate,
    _: Annotated[UserProfile, Depends(require_permission("appointments:write"))],
    db: Session = Depends(get_db),
):
    return create_appointment(db, data)


@router.get("/", response_model=list[AppointmentResponse])
def list_appointments(
    current_user: Annotated[UserProfile, Depends(allow_patient_or("appointments:read"))],
    skip: Skip = 0,
    limit: Limit = 20,
    patient_id: IdQuery | None = None,
    doctor_id: IdQuery | None = None,
    appointment_status: AppointmentStatus | None = None,
    db: Session = Depends(get_db),
):
    if is_patient(current_user):
        # patient_id from the query string is ignored for patients.
        return get_appointments(
            db, skip=skip, limit=limit,
            doctor_id=doctor_id,
            appointment_status=appointment_status,
            owner=current_user,
        )
    return get_appointments(
        db, skip=skip, limit=limit,
        patient_id=patient_id,
        doctor_id=doctor_id,
        appointment_status=appointment_status,
    )


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def retrieve_appointment(
    appointment_id: IdPath,
    current_user: Annotated[UserProfile, Depends(allow_patient_or("appointments:read"))],
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if is_patient(current_user) and not owns_appointment(current_user, appointment):
        raise not_found("Appointment")
    return appointment


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_own_appointment(
    appointment_id: IdPath,
    current_user: Annotated[UserProfile, Depends(require_patient())],
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if not owns_appointment(current_user, appointment):
        raise not_found("Appointment")
    return cancel_by_patient(db, appointment)


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
def edit_appointment(
    appointment_id: IdPath,
    data: AppointmentUpdate,
    _: Annotated[UserProfile, Depends(require_permission("appointments:write"))],
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return update_appointment(db, appointment, data)


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_appointment(
    appointment_id: IdPath,
    _: Annotated[UserProfile, Depends(require_permission("appointments:delete"))],
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    delete_appointment(db, appointment)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
