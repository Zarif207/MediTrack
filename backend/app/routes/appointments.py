from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_patient_id_for_user, require_roles
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

_WRITE_ROLES = require_roles("admin", "receptionist")

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
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
    current_user: Annotated[UserProfile, Depends(get_current_user)] = None,
    # Resolve ownership — raises 403 for unlinked patient accounts
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
):
    if scoped_patient_id is not None:
        # patient-role: ignore any patient_id query param — always filter to own
        return get_appointments(
            db,
            skip=skip,
            limit=limit,
            patient_id=scoped_patient_id,
            doctor_id=doctor_id,
            appointment_status=appointment_status,
        )

    # Staff: doctor can only filter, not override — accept query param as-is
    if current_user.role not in ("admin", "receptionist", "doctor", "pharmacist", "accountant"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

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
    scoped_patient_id: int | None = Depends(get_patient_id_for_user),
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    # Patient-role: enforce ownership
    if scoped_patient_id is not None and appointment.patient_id != scoped_patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own appointments.",
        )

    return appointment


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
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


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
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
