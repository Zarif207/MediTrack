"""
FastAPI auth dependencies.

Role summary:
  user          — new account, no clinical permissions
  patient       — can book appointments + view own health data when linked
  doctor/pharmacist/receptionist/accountant — respective staff permissions
  admin         — full management access

Usage:
    from app.auth.dependencies import require_roles, get_patient_id_for_user

    @router.get("/...")
    def endpoint(user = Depends(require_roles("admin", "receptionist"))):
        ...

Flow:
    1. Client sends  Authorization: Bearer <firebase-id-token>
    2. verify_firebase_token()  →  Firebase Admin SDK  →  decoded claims dict
    3. get_current_user()       →  looks up / creates UserProfile in PostgreSQL
       (also syncs display_name/email from token)
    4. require_roles(...)       →  checks role column, raises 403 if not allowed
    5. get_patient_id_for_user()→  returns trusted patient_id or None (staff),
                                   raises 403 for unlinked patient-role accounts
                                   on health-data endpoints
    6. get_optional_patient_id()→  like above but returns None for unlinked
                                   patients instead of raising 403
"""
from __future__ import annotations

from typing import Annotated

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.user_profile import UserProfile, VALID_ROLES

_bearer = HTTPBearer(auto_error=True)


def _is_firebase_configured() -> bool:
    return bool(firebase_admin._apps)


async def verify_firebase_token(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """Verify a Firebase ID token. Raises 401 or 503 on failure."""
    if not _is_firebase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Firebase is not configured on this server. "
                "Set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env and restart."
            ),
        )

    try:
        decoded = firebase_auth.verify_id_token(
            credentials.credentials, check_revoked=True
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.InvalidIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return decoded


async def get_current_user(
    claims: Annotated[dict, Depends(verify_firebase_token)],
    db: Session = Depends(get_db),
) -> UserProfile:
    """
    Return the UserProfile for the authenticated Firebase user.

    - Auto-provisions a 'user'-role profile on first sign-in.
    - Syncs display_name / email from the Firebase token on every request
      so stale nulls get filled in over time.
    """
    uid = claims["uid"]
    profile = db.get(UserProfile, uid)

    firebase_name  = claims.get("name")
    firebase_email = claims.get("email")

    if profile is None:
        profile = UserProfile(
            firebase_uid=uid,
            role="user",               # NEW DEFAULT — not "patient"
            display_name=firebase_name,
            email=firebase_email,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    else:
        # Sync display_name / email if Firebase has fresher data
        changed = False
        if firebase_name and profile.display_name != firebase_name:
            profile.display_name = firebase_name
            changed = True
        if firebase_email and profile.email != firebase_email:
            profile.email = firebase_email
            changed = True
        if changed:
            db.commit()
            db.refresh(profile)

    return profile


def require_roles(*roles: str):
    """
    FastAPI dependency factory that enforces role membership.
    Raises 403 if the current user's role is not in the given set.
    """
    role_set = frozenset(roles)

    unknown = role_set - VALID_ROLES
    if unknown:
        raise ValueError(f"Unknown roles passed to require_roles: {unknown}")

    async def _check(
        user: Annotated[UserProfile, Depends(get_current_user)],
    ) -> UserProfile:
        if user.role not in role_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role(s): {', '.join(sorted(role_set))}. "
                    f"Your role: {user.role}."
                ),
            )
        return user

    return _check


async def get_patient_id_for_user(
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> int | None:
    """
    Return the trusted patient_id for the current user.

    - Linked patient-role users  → patient_id from UserProfile.
    - Unlinked patient-role users → raises 403 (health-data endpoints).
    - Staff roles                 → returns None (no ownership filter).
    - user role                   → raises 403 (no patient access).
    """
    if user.role == "patient":
        if user.patient_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your account is not yet linked to a patient record. "
                    "Contact an administrator to link your account."
                ),
            )
        return user.patient_id
    if user.role == "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has not been assigned a role. Contact an administrator.",
        )
    return None   # staff roles


async def get_optional_patient_id(
    user: Annotated[UserProfile, Depends(get_current_user)],
) -> int | None:
    """
    Like get_patient_id_for_user but does NOT raise 403 for unlinked patients.
    Returns None for staff, unlinked patients, and user-role accounts.
    Use on endpoints that handle the unlinked state gracefully.
    """
    if user.role in ("patient",):
        return user.patient_id   # may be None
    return None
