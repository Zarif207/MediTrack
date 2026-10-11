"""
Auth / user-profile routes.

Public routes (no auth required):
    POST /auth/register  — after Firebase sign-up, creates a UserProfile row.
                           Role is always "patient"; admins promote via PATCH.

Protected routes:
    GET  /auth/me        — returns the current user's profile.
    PATCH /auth/me       — update display_name only (not role).
    GET  /auth/users     — admin: list all profiles.
    PATCH /auth/users/{uid}/role  — admin: change a user's role.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile, VALID_ROLES
from app.auth.firebase import initialize_firebase

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    firebase_uid: str
    role: str
    display_name: str | None
    email: str | None

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    """Sent by the frontend right after Firebase sign-up / sign-in."""
    firebase_uid: str = Field(min_length=1, max_length=128)
    display_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)


class RoleUpdateRequest(BaseModel):
    role: str = Field(min_length=1, max_length=20)


class DisplayNameUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=200)


# ── Routes ───────────────────────────────────────────────────────────────────

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
    Called by the frontend after a successful Firebase sign-in.
    Safe to call multiple times — returns existing profile if uid exists.
    Default role: 'patient'.  Admins promote via PATCH /auth/users/{uid}/role.
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
    summary="Return the authenticated user's own profile",
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found.",
        )

    profile.role = body.role
    db.commit()
    db.refresh(profile)
    return profile
