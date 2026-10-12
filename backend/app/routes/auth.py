"""
Auth / user-profile routes.

Public:
    POST /auth/register  — creates a UserProfile (role=user) on first sign-in.
                           Idempotent. Updates display_name/email if changed.
                           Never changes an existing role.

Authenticated (any role):
    GET  /auth/me                       — current user's profile.
    POST /auth/me/refresh               — re-sync display_name/email from token.
    PATCH /auth/me                      — update own display_name only.

Admin only:
    GET  /auth/users                    — list all profiles.
    PATCH /auth/users/{uid}/role        — set a user's role.
    PATCH /auth/users/{uid}/link-patient— link a Firebase account to a patient row.
"""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.database.dependencies import get_db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.user_profile import UserProfile, VALID_ROLES

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    firebase_uid: str
    role: str
    display_name: str | None
    email: str | None
    patient_id: int | None

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    firebase_uid: str = Field(min_length=1, max_length=128)
    display_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)


class RoleUpdateRequest(BaseModel):
    role: str = Field(min_length=1, max_length=20)


class LinkPatientRequest(BaseModel):
    patient_id: int | None = Field(default=None, gt=0)


class DisplayNameUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=200)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or return the UserProfile for a Firebase user",
)
def register(
    body: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Called by the frontend after Firebase sign-in.
    Idempotent — returns existing profile if uid already exists,
    updating display_name/email but NEVER changing role or patient_id.
    New profiles always get role='user'. Admin promotes from there.
    """
    existing = db.get(UserProfile, body.firebase_uid)
    if existing:
        changed = False
        if body.display_name and existing.display_name != body.display_name:
            existing.display_name = body.display_name
            changed = True
        if body.email and existing.email != body.email:
            existing.email = body.email
            changed = True
        if changed:
            db.commit()
            db.refresh(existing)
        return existing

    profile = UserProfile(
        firebase_uid=body.firebase_uid,
        role="user",           # always 'user' for new registrations
        display_name=body.display_name,
        email=body.email,
        created_at=datetime.now(),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/me", response_model=UserProfileResponse)
def get_me(current_user: Annotated[UserProfile, Depends(get_current_user)]):
    return current_user


@router.post("/me/refresh", response_model=UserProfileResponse)
def refresh_me(current_user: Annotated[UserProfile, Depends(get_current_user)]):
    """get_current_user already syncs name/email. This is a convenience endpoint."""
    return current_user


@router.patch("/me", response_model=UserProfileResponse)
def update_me(
    body: DisplayNameUpdateRequest,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    current_user.display_name = body.display_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users", response_model=list[UserProfileResponse])
def list_users(
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    return db.query(UserProfile).order_by(UserProfile.created_at).all()


@router.patch(
    "/users/{uid}/role",
    response_model=UserProfileResponse,
    summary="Admin: assign a role to a user",
)
def set_user_role(
    uid: str,
    body: RoleUpdateRequest,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{body.role}'. Valid roles: {sorted(VALID_ROLES)}",
        )

    profile = db.get(UserProfile, uid)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    old_role = profile.role
    profile.role = body.role

    # When downgrading from patient → user, clear the patient_id link
    # (preserves the patient record and all history — just removes the link)
    if old_role == "patient" and body.role == "user":
        profile.patient_id = None

    db.commit()
    db.refresh(profile)
    return profile


@router.patch(
    "/users/{uid}/link-patient",
    response_model=UserProfileResponse,
    summary="Admin: link (or unlink) a Firebase account to a patient record",
)
def link_patient(
    uid: str,
    body: LinkPatientRequest,
    _: Annotated[UserProfile, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
):
    """
    Trusted admin-only endpoint. Sets user_profiles.patient_id.
    Users cannot call this — only admins.

    When linking, also associates any pending appointments that were booked
    by the same firebase_uid (unlinked bookings) with the correct patient_id.
    """
    profile = db.get(UserProfile, uid)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    if body.patient_id is not None:
        patient = db.get(Patient, body.patient_id)
        if patient is None:
            raise HTTPException(
                status_code=404,
                detail=f"Patient #{body.patient_id} not found.",
            )
        # Prevent two accounts from being linked to the same patient
        existing_link = (
            db.query(UserProfile)
            .filter(
                UserProfile.patient_id == body.patient_id,
                UserProfile.firebase_uid != uid,
            )
            .first()
        )
        if existing_link:
            raise HTTPException(
                status_code=409,
                detail=f"Patient #{body.patient_id} is already linked to another account.",
            )

    profile.patient_id = body.patient_id

    # Associate pending appointments booked while unlinked (firebase_uid match)
    if body.patient_id is not None:
        pending = (
            db.query(Appointment)
            .filter(
                Appointment.firebase_uid == uid,
                Appointment.patient_id != body.patient_id,  # not yet associated
            )
            .all()
        )
        for appt in pending:
            appt.patient_id = body.patient_id

    db.commit()
    db.refresh(profile)
    return profile
