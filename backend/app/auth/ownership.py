"""
Patient data ownership.

A patient-role user owns an appointment when either
  - they booked it (appointments.firebase_uid == their verified UID), or
  - an administrator linked their account to the clinical patient record the
    appointment belongs to (appointments.patient_id == user_profiles.patient_id).

Medical records, prescriptions, prescription items and bills are owned through
the appointment they hang off. Every patient-scoped query is built from
`owned_appointment_clause`, so there is no code path that returns other
patients' rows when the user has no clinical record yet.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, or_

from app.models.appointment import Appointment
from app.models.user_profile import UserProfile


def is_patient(user: UserProfile) -> bool:
    return user.role == "patient"


def owned_appointment_clause(user: UserProfile) -> ColumnElement[bool]:
    conditions = [Appointment.firebase_uid == user.firebase_uid]
    if user.patient_id is not None:
        conditions.append(Appointment.patient_id == user.patient_id)
    return or_(*conditions)


def owns_appointment(user: UserProfile, appointment: Appointment | None) -> bool:
    if appointment is None:
        return False
    if appointment.firebase_uid == user.firebase_uid:
        return True
    return user.patient_id is not None and appointment.patient_id == user.patient_id


def not_found(resource: str) -> HTTPException:
    """
    Patients receive 404 — not 403 — for records they do not own, so record IDs
    belonging to other patients cannot be probed for existence.
    """
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found.")
