"""
FastAPI auth dependencies.

Usage:
    from app.auth.dependencies import require_roles, get_patient_id_for_user

    # Role gate (raises 403 if wrong role)
    @router.get("/...")
    def endpoint(user = Depends(require_roles("admin", "receptionist"))):
        ...

    # Patient ownership helper — raises 403 if the user is a patient without
    # a linked patient_id, or returns None for non-patient staff roles.
    @router.get("/my-data")
    def endpoint(pid = Depends(get_patient_id_for_user)):
        if pid is not None:
            # filter by pid
        ...

Flow:
    1. Client sends  Authorization: Bearer <firebase-id-token>
    2. verify_firebase_token()  →  Firebase Admin SDK  →  decoded claims dict
    3. get_current_user()       →  looks up UserProfile row in PostgreSQL
    4. require_roles(...)       →  checks role column, raises 403 if not allowed
    5. get_patient_id_for_user()→  returns trusted patient_id or None
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

# ── HTTP Bearer scheme ────────────────────────────────────────────────────────
_bearer = HTTPBearer(auto_error=True)


def _is_firebase_configured() -> bool:
    return bool(firebase_admin._apps)


async def verify_firebase_token(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    Verify a Firebase ID token and return the decoded claims dict.
    Raises 401 for missing/expired/invalid tokens.
    Raises 503 if the Firebase Admin SDK is not configured.
    """
    if not _is_firebase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Firebase is not configured on this server. "
                "Set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env "
                "and restart the server."
            ),
        )

    try:
        decoded = firebase_auth.verify_id_token(
            credentials.credentials,
            check_revoked=True,
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
    Auto-provisions a 'patient'-role profile on first sign-in.
    """
    uid = claims["uid"]
    profile = db.get(UserProfile, uid)

    if profile is None:
        profile = UserProfile(
            firebase_uid=uid,
            role="patient",
            display_name=claims.get("name"),
            email=claims.get("email"),
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


def require_roles(*roles: str):
    """
    Return a FastAPI dependency that enforces role membership.
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

    For patient-role users: returns user.patient_id if it is set.
    If a patient-role user has NO linked patient_id (unlinked account),
    raises 403 rather than returning all records.

    For all staff roles (admin, receptionist, doctor, pharmacist, accountant):
    returns None, meaning "no ownership filter — see everything".

    This value is derived entirely from the server-side UserProfile row.
    It is never taken from a request parameter.
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
    # Staff roles: no filter
    return None
