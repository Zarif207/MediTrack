"""
Appointment business rules.

Scheduling policy (the schema has no per-doctor availability tables, so a
single clinic-wide policy applies):
  - Patient self-booking uses fixed slots of SLOT_MINUTES between OPENS_AT and
    CLOSES_AT, from now up to MAX_DAYS_AHEAD days ahead. Staff may schedule any
    time, including past dates for record-keeping.
  - A doctor cannot hold two active (scheduled/confirmed) appointments at the
    same date and time. This is checked in code and enforced by the partial
    unique index uq_appointments_doctor_active_slot.
  - A patient account cannot hold two active appointments at the same date and
    time, or two active appointments with the same doctor on the same day.
  - Bookings for the same doctor, and by the same patient account, are
    serialised with transaction-scoped PostgreSQL advisory locks so concurrent
    requests see each other's rows.

Status transitions:
  scheduled → confirmed | completed | cancelled | no_show
  confirmed → scheduled | completed | cancelled | no_show
  completed, cancelled, no_show are final; their doctor/date/time are frozen.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth.ownership import owned_appointment_clause
from app.models.appointment import ACTIVE_STATUSES, Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user_profile import UserProfile
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    PatientBookingRequest,
)

SLOT_MINUTES = 30
OPENS_AT = time(9, 0)
CLOSES_AT = time(17, 0)
MAX_DAYS_AHEAD = 180

FINAL_STATUSES = ("completed", "cancelled", "no_show")
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "scheduled": frozenset({"confirmed", "completed", "cancelled", "no_show"}),
    "confirmed": frozenset({"scheduled", "completed", "cancelled", "no_show"}),
    "completed": frozenset(),
    "cancelled": frozenset(),
    "no_show": frozenset(),
}

_SLOT_TAKEN = "The doctor already has an active appointment at that date and time."


# ── Helpers ───────────────────────────────────────────────────────────────────

def _with_relations(stmt):
    return stmt.options(
        selectinload(Appointment.patient),
        selectinload(Appointment.booker),
    )


def _lock_doctor_schedule(db: Session, doctor_id: int) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(7301, :key)"),
        {"key": doctor_id % 2_147_483_647},
    )


def _lock_owner_schedule(db: Session, firebase_uid: str) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(7302, hashtext(:uid))"),
        {"uid": firebase_uid},
    )


def _require_doctor(db: Session, doctor_id: int) -> Doctor:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    return doctor


def _require_patient(db: Session, patient_id: int) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return patient


def _check_slot_free(
    db: Session,
    doctor_id: int,
    appointment_date: date,
    appointment_time: time,
    exclude_appointment_id: int | None = None,
) -> None:
    stmt = select(Appointment.appointment_id).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.appointment_time == appointment_time,
        Appointment.status.in_(ACTIVE_STATUSES),
    )
    if exclude_appointment_id is not None:
        stmt = stmt.where(Appointment.appointment_id != exclude_appointment_id)
    if db.scalars(stmt.limit(1)).first() is not None:
        raise HTTPException(status_code=409, detail=_SLOT_TAKEN)


def _commit(db: Session, appointment: Appointment | None = None) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "uq_appointments_doctor_active_slot" in str(exc.orig):
            raise HTTPException(status_code=409, detail=_SLOT_TAKEN) from exc
        raise HTTPException(
            status_code=409,
            detail="The appointment conflicts with existing data.",
        ) from exc
    if appointment is not None:
        db.refresh(appointment)


def booking_slots() -> list[time]:
    slots = []
    current = datetime.combine(date.today(), OPENS_AT)
    end = datetime.combine(date.today(), CLOSES_AT)
    while current < end:
        slots.append(current.time())
        current += timedelta(minutes=SLOT_MINUTES)
    return slots


def _validate_patient_slot(appointment_date: date, appointment_time: time) -> None:
    now = datetime.now()
    if appointment_time.second or appointment_time.microsecond or appointment_time not in booking_slots():
        raise HTTPException(
            status_code=422,
            detail=(
                f"Choose a {SLOT_MINUTES}-minute slot between "
                f"{OPENS_AT:%H:%M} and {CLOSES_AT:%H:%M}."
            ),
        )
    if datetime.combine(appointment_date, appointment_time) <= now:
        raise HTTPException(status_code=422, detail="Appointments must be booked for a future time.")
    if appointment_date > now.date() + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(
            status_code=422,
            detail=f"Appointments can be booked up to {MAX_DAYS_AHEAD} days ahead.",
        )


# ── Queries ───────────────────────────────────────────────────────────────────

def get_appointment(db: Session, appointment_id: int) -> Appointment | None:
    return db.get(Appointment, appointment_id)


def get_appointments(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    patient_id: int | None = None,
    doctor_id: int | None = None,
    appointment_status: str | None = None,
    owner: UserProfile | None = None,
) -> list[Appointment]:
    """List appointments. When `owner` is given, only rows in their scope are returned."""
    stmt = _with_relations(select(Appointment)).order_by(
        Appointment.appointment_date,
        Appointment.appointment_time,
        Appointment.appointment_id,
    )
    if owner is not None:
        stmt = stmt.where(owned_appointment_clause(owner))
    if patient_id is not None:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if doctor_id is not None:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if appointment_status is not None:
        stmt = stmt.where(Appointment.status == appointment_status)
    return list(db.scalars(stmt.offset(skip).limit(limit)).all())


def get_availability(db: Session, doctor_id: int, on_date: date) -> dict:
    """Open self-booking slots for a doctor on a date. Reveals times only."""
    _require_doctor(db, doctor_id)
    taken = set(
        db.scalars(
            select(Appointment.appointment_time).where(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date == on_date,
                Appointment.status.in_(ACTIVE_STATUSES),
            )
        ).all()
    )
    now = datetime.now()
    available, unavailable = [], []
    for slot in booking_slots():
        too_late = datetime.combine(on_date, slot) <= now
        too_far = on_date > now.date() + timedelta(days=MAX_DAYS_AHEAD)
        (unavailable if slot in taken or too_late or too_far else available).append(slot)
    return {
        "doctor_id": doctor_id,
        "date": on_date,
        "slot_minutes": SLOT_MINUTES,
        "opens_at": OPENS_AT,
        "closes_at": CLOSES_AT,
        "available": available,
        "unavailable": unavailable,
    }


# ── Commands ──────────────────────────────────────────────────────────────────

def create_appointment(db: Session, data: AppointmentCreate) -> Appointment:
    """Staff scheduling for an existing clinical patient record."""
    _require_patient(db, data.patient_id)
    _require_doctor(db, data.doctor_id)

    _lock_doctor_schedule(db, data.doctor_id)
    if data.status in ACTIVE_STATUSES:
        _check_slot_free(db, data.doctor_id, data.appointment_date, data.appointment_time)

    appointment = Appointment(**data.model_dump(), created_at=datetime.now())
    db.add(appointment)
    _commit(db, appointment)
    return appointment


def book_appointment(
    db: Session,
    user: UserProfile,
    data: PatientBookingRequest,
) -> Appointment:
    """
    Self-booking by a patient-role account. The booking is owned by the
    verified UID; a linked clinical record is attached when one exists. No
    patient record is created.
    """
    _validate_patient_slot(data.appointment_date, data.appointment_time)
    _require_doctor(db, data.doctor_id)

    # Lock order: owner, then doctor (staff paths only take the doctor lock).
    _lock_owner_schedule(db, user.firebase_uid)
    _lock_doctor_schedule(db, data.doctor_id)
    _check_slot_free(db, data.doctor_id, data.appointment_date, data.appointment_time)

    own_active = select(Appointment).where(
        owned_appointment_clause(user),
        Appointment.appointment_date == data.appointment_date,
        Appointment.status.in_(ACTIVE_STATUSES),
    )
    for existing in db.scalars(own_active).all():
        if existing.appointment_time == data.appointment_time:
            raise HTTPException(
                status_code=409,
                detail="You already have an appointment at that time.",
            )
        if existing.doctor_id == data.doctor_id:
            raise HTTPException(
                status_code=409,
                detail="You already have an appointment with this doctor on that day.",
            )

    appointment = Appointment(
        patient_id=user.patient_id,
        doctor_id=data.doctor_id,
        appointment_date=data.appointment_date,
        appointment_time=data.appointment_time,
        status="scheduled",
        reason=data.reason or None,
        firebase_uid=user.firebase_uid,
        created_at=datetime.now(),
    )
    db.add(appointment)
    _commit(db, appointment)
    return appointment


def cancel_by_patient(db: Session, appointment: Appointment) -> Appointment:
    """Patients may cancel their own active appointments that have not started."""
    if appointment.status not in ACTIVE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"A {appointment.status.replace('_', ' ')} appointment cannot be cancelled.",
        )
    if datetime.combine(appointment.appointment_date, appointment.appointment_time) <= datetime.now():
        raise HTTPException(
            status_code=409,
            detail="Past appointments cannot be cancelled online. Please contact reception.",
        )
    appointment.status = "cancelled"
    _commit(db, appointment)
    return appointment


def update_appointment(
    db: Session,
    appointment: Appointment,
    data: AppointmentUpdate,
) -> Appointment:
    changes = data.changes()

    new_status = changes.get("status", appointment.status)
    if new_status != appointment.status and new_status not in ALLOWED_TRANSITIONS[appointment.status]:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot change status from {appointment.status.replace('_', ' ')} "
                f"to {new_status.replace('_', ' ')}."
            ),
        )

    schedule_fields = {"doctor_id", "appointment_date", "appointment_time"}
    rescheduling = any(
        f in changes and changes[f] != getattr(appointment, f) for f in schedule_fields
    )
    if rescheduling and appointment.status in FINAL_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="A completed, cancelled or no-show appointment cannot be rescheduled.",
        )

    if "patient_id" in changes and changes["patient_id"] != appointment.patient_id:
        _check_patient_reassignment(db, appointment, changes["patient_id"])

    new_doctor_id = changes.get("doctor_id", appointment.doctor_id)
    if "doctor_id" in changes:
        _require_doctor(db, new_doctor_id)

    _lock_doctor_schedule(db, new_doctor_id)
    if new_status in ACTIVE_STATUSES:
        _check_slot_free(
            db,
            new_doctor_id,
            changes.get("appointment_date", appointment.appointment_date),
            changes.get("appointment_time", appointment.appointment_time),
            exclude_appointment_id=appointment.appointment_id,
        )

    for field, value in changes.items():
        setattr(appointment, field, value)
    _commit(db, appointment)
    return appointment


def _check_patient_reassignment(
    db: Session, appointment: Appointment, new_patient_id: int | None
) -> None:
    if new_patient_id is None:
        if appointment.firebase_uid is None:
            raise HTTPException(
                status_code=422,
                detail="Staff-created appointments must keep a patient record.",
            )
    else:
        _require_patient(db, new_patient_id)

    if appointment.medical_record is not None or appointment.bill is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "The patient cannot be changed on an appointment that already "
                "has a medical record or bill."
            ),
        )

    # A booking made by a patient account that is linked to a clinical record
    # cannot be moved to a different patient: that would expose the other
    # patient's clinical data to the booking account.
    if appointment.firebase_uid is not None and new_patient_id is not None:
        booker = db.get(UserProfile, appointment.firebase_uid)
        if booker is not None and booker.patient_id not in (None, new_patient_id):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This appointment was booked by an account linked to a "
                    "different patient record."
                ),
            )


def delete_appointment(db: Session, appointment: Appointment) -> None:
    if appointment.medical_record is not None or appointment.bill is not None:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete an appointment linked to a medical record or bill.",
        )
    db.delete(appointment)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete this appointment because related records exist.",
        ) from exc
