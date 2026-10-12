"""
Auth / user-profile routes.

Public:
    POST /auth/register  — creates a UserProfile (role=patient) on first sign-in.

Authenticated (any role):
    GET  /auth/me                   — current user's profile.
    PATCH /auth/me                  — update own display_name only.

Admin only:
    GET  /auth/users                — list all profiles.
    PATCH /auth/users/{uid}/role    — set a user's role.
    PATCH /auth/users/{uid}/link-patient — link a Firebase account to a patient row.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.database.dependencies import get_db
from app.models.patient import Patient
from app.models.user_profile import UserProfile, VALID_ROLES

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    firebase_uid: str
    role: str
    display_name: str | None
    email: str | None
    patient_id: int | None  # None for staff accounts

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    firebase_uid: str = Field(min_length=1, max_length=128)
    display_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)


class RoleUpdateRequest(BaseModel):
    role: str = Field(min_length=1, max_length=20)


class LinkPatientRequest(BaseModel):
    """Admin-only: link a Firebase account to a patient record."""
    patient_id: int | None = Field(
        default=None,
        gt=0,
        description=(
            "The patients.patient_id to link. "
            "Send null to unlink the account from a patient record."
        ),
    )


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
    Safe to call multiple times — returns existing profile if uid exists.
    Default role: 'patient'. Admins promote and link patient records separately.
    """
    existing = db.get(UserProfile, body.firebase_uid)
    if existing:
        return existing

    profile = UserProfile(
        firebase_uid=body.firebase_uid,
        role="patient",
        display_name=body.display_name,
        email=body.email,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Return the authenticated user's own profile (includes patient_id if linked)",
)
def get_me(
    current_user: Annotated[UserProfile, Depends(get_current_user)],
):
    return current_user


@router.patch(
    "/me",
    response_model=UserProfileResponse,
    summary="Update authenticated user's own display name",
)
def update_me(
    body: DisplayNameUpdateRequest,
    current_user: Annotated[UserProfile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    current_user.display_name = body.display_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get(
    "/users",
    response_model=list[UserProfileResponse],
    summary="Admin: list all user profiles",
)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")

    profile.role = body.role
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
    Associates a UserProfile with a patients row via the trusted patient_id column.
    Only admins can call this — users cannot link themselves.

    Pass patient_id: null to unlink.
    """
    profile = db.get(UserProfile, uid)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")

    if body.patient_id is not None:
        patient = db.get(Patient, body.patient_id)
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Patient #{body.patient_id} not found.",
            )
        # Guard: prevent a patient_id from being linked to two different accounts
        existing = (
            db.query(UserProfile)
            .filter(
                UserProfile.patient_id == body.patient_id,
                UserProfile.firebase_uid != uid,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Patient #{body.patient_id} is already linked to another account.",
            )

    profile.patient_id = body.patient_id
    db.commit()
    db.refresh(profile)
    return profile
