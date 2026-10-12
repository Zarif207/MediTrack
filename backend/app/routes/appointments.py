"""
Appointments router.

Booking matrix:
  POST /appointments/              admin | receptionist  (staff-created, requires patient_id)
  POST /appointments/book          patient role only     (self-booking)
  GET  /appointments/              scoped by role
  GET  /appointments/{id}          ownership enforced
  PATCH /appointments/{id}         admin | receptionist
  DELETE /appointments/{id}        admin

Patient self-booking (POST /appointments/book):
  ─ Linked patient (patient_id set):
      patient_id comes from UserProfile — never from request body.
      firebase_uid is also stored for tracking.
  ─ Unlinked patient (patient_id IS NULL):
      Requires a "guest patient" row to exist OR uses a placeholder patient.
      NOTE: appointments.patient_id is NOT NULL in the DB schema, so unlinked
      patients must have a dummy/placeholder record or we create a minimal one.
      DESIGN DECISION: We create a minimal "pending patient" record from the
      Firebase profile (email as key) and link the account, so the DB constraint
      is satisfied. The admin can later update the patient record with full info.
      If a patient record already exists with the same email, we reuse it.

Unlinked patient list:
  Patients with a linked patient_id see appointments via patient_id.
  Pending/unlinked appointments are also visible via firebase_uid filter.
"""
from datetime import date as date_type, datetime, time as time_type
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_user,
    get_optional_patient_id,
    get_patient_id_for_user,
    require_roles,
)
from app.database.dependencies import get_db
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user_profile import UserProfile
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatus,
    AppointmentUpdate,
)
from app.services.appointment_service import (
    _check_appointment_conflict,
    create_appointment,
    delete_appointment,
    get_appointment,
    get_appointments,
    update_appointment,
)

_WRITE_ROLES = require_roles("admin", "receptionist")

router = APIRouter(prefix="/appointments", tags=["Appointments"])


class PatientBookingRequest(BaseModel):
    """
    Appointment booking from an authenticated patient.
    patient_id is NEVER sent — derived from UserProfile.
    """
    doctor_id: int = Field(gt=0)
    appointment_date: str   # YYYY-MM-DD
    appointment_time: str   # HH:MM or HH:MM:SS
    reason: str | None = None


def _parse_date(s: str) -> date_type:
    try:
        return date_type.fromisoformat(s)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="appointment_date must be YYYY-MM-DD format.",
        )


def _parse_time(s: str) -> time_type:
    try:
        parts = s.split(":")
        return time_type(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
    except (ValueError, IndexError):
        raise HTTPException(
            status_code=422,
            detail="appointment_time must be HH:MM or HH:MM:SS format.",
        )


def _get_or_create_patient_for_unlinked(
    db: Session,
    firebase_uid: str,
    user_email: str | None,
    user_display_name: str | None,
) -> Patient:
    """
    For unlinked patient bookings: find or create a minimal Patient row,
    and update the UserProfile.patient_id in the same session.

    Accepts plain values instead of an ORM object to avoid cross-session
    SQLAlchemy state issues when the caller's UserProfile lives in a different
    session (common in testing with dependency overrides).
    """
    if user_email:
        existing = db.scalars(
            select(Patient).where(Patient.email == user_email)
        ).first()
        if existing:
            # Link the account — load the profile fresh from this session
            profile = db.get(UserProfile, firebase_uid)
            if profile is not None and profile.patient_id != existing.patient_id:
                profile.patient_id = existing.patient_id
                db.commit()
            return existing

    # Create a minimal patient row
    name_parts = (user_display_name or "Unknown User").split(" ", 1)
    first = name_parts[0]
    last = name_parts[1] if len(name_parts) > 1 else "—"

    from datetime import date as d
    patient = Patient(
        first_name=first,
        last_name=last,
        date_of_birth=d(1900, 1, 1),  # placeholder — staff must update
        gender="Unknown",
        phone="0000000000",           # placeholder
        email=user_email,
        registered_at=datetime.now(),
    )
    db.add(patient)
    db.flush()

    # Link the profile — load it fresh from this session to avoid cross-session issues
    profile = db.get(UserProfile, firebase_uid)
    if profile is not None:
        profile.patient_id = patient.patient_id
    db.commit()
    db.refresh(patient)
    return patient


@router.post(
    "/book",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Patient self-booking — derives patient_id from verified Firebase identity",
)
def book_appointment(
    data: PatientBookingRequest,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    """
    Any authenticated user with role 'patient' can book an appointment.
    - Linked patients: patient_id from UserProfile.
    - Unlinked patients: a minimal patient record is auto-created and linked.
    - user role: blocked (403).
    - Staff roles: blocked (use POST /appointments/ instead).
    """
    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is for patients only. Staff use POST /appointments/.",
        )

    appt_date = _parse_date(data.appointment_date)
    appt_time = _parse_time(data.appointment_time)

    # Resolve patient_id — linked or auto-create
    if current_user.patient_id is not None:
        patient_id = current_user.patient_id
    else:
        # Auto-create a minimal patient record for this unlinked account
        patient = _get_or_create_patient_for_unlinked(
            db,
            firebase_uid=current_user.firebase_uid,
            user_email=current_user.email,
            user_display_name=current_user.display_name,
        )
        patient_id = patient.patient_id

    # Validate doctor exists
    if db.get(Doctor, data.doctor_id) is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    # Check for scheduling conflict
    _check_appointment_conflict(db, data.doctor_id, appt_date, appt_time)

    appointment = Appointment(
        patient_id=patient_id,
        doctor_id=data.doctor_id,
        appointment_date=appt_date,
        appointment_time=appt_time,
        status="scheduled",
        reason=data.reason,
        firebase_uid=current_user.firebase_uid,  # track who booked
        created_at=datetime.now(),
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


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
    db: Session = Depends(get_db),
):
    if current_user.role == "patient":
        # Build filter: own by patient_id AND/OR firebase_uid
        stmt = select(Appointment).order_by(
            Appointment.appointment_date,
            Appointment.appointment_time,
            Appointment.appointment_id,
        )
        if current_user.patient_id is not None:
            # Linked: see appointments by patient_id OR by firebase_uid
            stmt = stmt.where(
                or_(
                    Appointment.patient_id == current_user.patient_id,
                    Appointment.firebase_uid == current_user.firebase_uid,
                )
            )
        else:
            # Unlinked: see only appointments booked with this firebase_uid
            stmt = stmt.where(
                Appointment.firebase_uid == current_user.firebase_uid
            )
        if doctor_id is not None:
            stmt = stmt.where(Appointment.doctor_id == doctor_id)
        if appointment_status is not None:
            stmt = stmt.where(Appointment.status == appointment_status)
        return list(db.scalars(stmt.offset(skip).limit(limit)).all())

    if current_user.role == "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has not been assigned a role. Contact an administrator.",
        )

    if current_user.role not in ("admin", "receptionist", "doctor", "pharmacist", "accountant"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return get_appointments(
        db, skip=skip, limit=limit,
        patient_id=patient_id,
        doctor_id=doctor_id,
        appointment_status=appointment_status,
    )


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def retrieve_appointment(
    appointment_id: int,
    current_user: Annotated[UserProfile, Depends(get_current_user)] = None,
    db: Session = Depends(get_db),
):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if current_user.role == "patient":
        # Owned if patient_id matches OR firebase_uid matches (unlinked booking)
        own = (
            (current_user.patient_id is not None and appointment.patient_id == current_user.patient_id)
            or appointment.firebase_uid == current_user.firebase_uid
        )
        if not own:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own appointments.",
            )
    elif current_user.role == "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

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
