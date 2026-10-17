"""
Auth / user-profile routes.

Authenticated (any role):
    POST  /auth/register                 — create or return the caller's profile.
                                           The UID and email come from the verified
                                           ID token; new profiles get role 'user'.
    GET   /auth/me                       — the caller's profile and permissions.
    POST  /auth/me/refresh               — same as GET /auth/me (kept for clients).
    PATCH /auth/me                       — change the caller's display name only.

Admin only (users:manage):
    GET   /auth/users                    — list all profiles.
    PATCH /auth/users/{uid}/role         — set a user's role.
    PATCH /auth/users/{uid}/link-patient — link/unlink an account and a patient record.
"""
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_user,
    require_permission,
    verify_firebase_token,
)
from app.auth.permissions import permissions_for
from app.database.dependencies import get_db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.user_profile import UserProfile

router = APIRouter(prefix="/auth", tags=["Auth"])

Role = Literal["user", "patient", "doctor", "pharmacist", "receptionist", "accountant", "admin"]
Uid = Annotated[str, Path(min_length=1, max_length=128)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    firebase_uid: str
    role: str
    display_name: str | None
    email: str | None
    patient_id: int | None
    created_at: datetime | None = None


class MeResponse(UserProfileResponse):
    permissions: list[str]


class RegisterRequest(BaseModel):
    """Optional body. Any firebase_uid / role / patient_id sent here is ignored."""

    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: str | None = Field(default=None, max_length=200)


class RoleUpdateRequest(BaseModel):
    role: Role


class LinkPatientRequest(BaseModel):
    patient_id: int | None = Field(default=None, gt=0, le=2**63 - 1)


class DisplayNameUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: str | None = Field(default=None, max_length=200)


def _me(profile: UserProfile) -> MeResponse:
    return MeResponse(
        **UserProfileResponse.model_validate(profile).model_dump(),
        permissions=permissions_for(profile.role),
    )


# ── Self-service ──────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=MeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or return the caller's profile",
)
def register(
    response: Response,
    claims: Annotated[dict, Depends(verify_firebase_token)],
    body: RegisterRequest | None = None,
    db: Session = Depends(get_db),
):
    """
    Called by the frontend after Firebase sign-up / sign-in. Idempotent.
    Never changes an existing role or patient link.
    """
    uid = claims["uid"]
    profile = db.get(UserProfile, uid)
    requested_name = (body.display_name if body else None) or claims.get("name")

    if profile is None:
        profile = UserProfile(
            firebase_uid=uid,
            role="user",
            display_name=requested_name or None,
            email=claims.get("email"),
            created_at=datetime.now(),
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return _me(profile)

    response.status_code = status.HTTP_200_OK
    changed = False
    if claims.get("email") and profile.email != claims["email"]:
        profile.email = claims["email"]
        changed = True
    if requested_name and not profile.display_name:
        profile.display_name = requested_name
        changed = True
    if changed:
        db.commit()
        db.refresh(profile)
    return _me(profile)


@router.get("/me", response_model=MeResponse)
def get_me(current_user: Annotated[UserProfile, Depends(get_current_user)]):
    return _me(current_user)


@router.post("/me/refresh", response_model=MeResponse)
def refresh_me(current_user: Annotated[UserProfile, Depends(get_current_user)]):
    return _me(current_user)


@router.patch("/me", response_model=MeResponse)
def update_me(
    body: DisplayNameUpdateRequest,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    current_user.display_name = body.display_name or None
    db.commit()
    db.refresh(current_user)
    return _me(current_user)


# ── Administration ────────────────────────────────────────────────────────────

AdminUser = Annotated[UserProfile, Depends(require_permission("users:manage"))]


@router.get("/users", response_model=list[UserProfileResponse])
def list_users(_: AdminUser, db: Session = Depends(get_db)):
    return db.scalars(
        select(UserProfile).order_by(UserProfile.created_at, UserProfile.firebase_uid)
    ).all()


@router.patch(
    "/users/{uid}/role",
    response_model=UserProfileResponse,
    summary="Admin: assign a role to a user",
)
def set_user_role(
    uid: Uid,
    body: RoleUpdateRequest,
    admin: AdminUser,
    db: Session = Depends(get_db),
):
    profile = db.get(UserProfile, uid)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    if profile.role == "admin" and body.role != "admin":
        if profile.firebase_uid == admin.firebase_uid:
            raise HTTPException(
                status_code=409,
                detail="You cannot remove your own administrator role.",
            )
        admins = db.scalar(
            select(func.count()).select_from(UserProfile).where(UserProfile.role == "admin")
        )
        if admins <= 1:
            raise HTTPException(
                status_code=409,
                detail="At least one administrator must remain.",
            )

    old_role = profile.role
    profile.role = body.role

    # Returning an account to the default role removes its clinical-record link.
    # The patient record and all history are preserved.
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
    uid: Uid,
    body: LinkPatientRequest,
    _: AdminUser,
    db: Session = Depends(get_db),
):
    """
    Sets user_profiles.patient_id. This is the only way an account gains access
    to an existing clinical record; nothing is linked automatically by name or
    email.

    Bookings this account made (appointments.firebase_uid = uid) follow the
    link: unlinked bookings are attached to the new record, and changing or
    removing a link moves bookings off the previous record — except bookings
    that already have a medical record or bill, which staff must resolve.
    Appointments created by staff for other patients are never touched.
    """
    profile = db.get(UserProfile, uid)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    if body.patient_id is not None:
        if db.get(Patient, body.patient_id) is None:
            raise HTTPException(status_code=404, detail="Patient not found.")
        other = db.scalars(
            select(UserProfile).where(
                UserProfile.patient_id == body.patient_id,
                UserProfile.firebase_uid != uid,
            )
        ).first()
        if other is not None:
            raise HTTPException(
                status_code=409,
                detail="This patient record is already linked to another account.",
            )

    previous_patient_id = profile.patient_id
    profile.patient_id = body.patient_id

    # Bookings this account made: move the ones without clinical data from the
    # previous link (if any) or from "unlinked" to the new record. Bookings that
    # already carry a medical record or bill stay where they are.
    if previous_patient_id != body.patient_id:
        own_bookings = db.scalars(
            select(Appointment).where(
                Appointment.firebase_uid == uid,
                Appointment.patient_id.is_(None)
                if previous_patient_id is None
                else Appointment.patient_id == previous_patient_id,
            )
        ).all()
        for appointment in own_bookings:
            if appointment.medical_record is None and appointment.bill is None:
                appointment.patient_id = body.patient_id

    db.commit()
    db.refresh(profile)
    return profile
