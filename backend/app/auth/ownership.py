"""
Row-level scoping for patients and doctors.

A patient-role user owns an appointment when either
  - they booked it (appointments.firebase_uid == their verified UID), or
  - an administrator linked their account to the clinical patient record the
    appointment belongs to (appointments.patient_id == user_profiles.patient_id).

A doctor-role user may access an appointment only when an administrator has
linked their account to a doctor record (user_profiles.doctor_id) and the
appointment is with that doctor (appointments.doctor_id). A doctor account
with no link can access no appointments — access is denied by default.

Medical records, prescriptions, prescription items and bills are scoped through
the appointment they hang off. Every scoped query is built from
`owned_appointment_clause`, so there is no code path that returns other rows
when the account has no link yet. Other staff roles are not row-scoped; their
access is governed by the permission matrix alone.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, false, or_

from app.models.appointment import Appointment
from app.models.user_profile import UserProfile

SCOPED_ROLES = frozenset({"patient", "doctor"})


def is_patient(user: UserProfile) -> bool:
    return user.role == "patient"


def is_scoped(user: UserProfile) -> bool:
    """True for roles whose access is limited to their own appointments."""
    return user.role in SCOPED_ROLES


def owned_appointment_clause(user: UserProfile) -> ColumnElement[bool]:
    if user.role == "doctor":
        if user.doctor_id is None:
            return false()
        return Appointment.doctor_id == user.doctor_id
    conditions = [Appointment.firebase_uid == user.firebase_uid]
    if user.patient_id is not None:
        conditions.append(Appointment.patient_id == user.patient_id)
    return or_(*conditions)


def owns_appointment(user: UserProfile, appointment: Appointment | None) -> bool:
    if appointment is None:
        return False
    if user.role == "doctor":
        return user.doctor_id is not None and appointment.doctor_id == user.doctor_id
    if appointment.firebase_uid == user.firebase_uid:
        return True
    return user.patient_id is not None and appointment.patient_id == user.patient_id


def can_access(user: UserProfile, appointment: Appointment | None) -> bool:
    """Unscoped staff roles pass; patients and doctors must own the appointment."""
    return not is_scoped(user) or owns_appointment(user, appointment)


def not_found(resource: str) -> HTTPException:
    """
    Scoped users receive 404 — not 403 — for records outside their scope, so
    record IDs belonging to others cannot be probed for existence.
    """
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found.")
