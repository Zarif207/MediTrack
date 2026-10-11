"""
FastAPI auth dependencies.

Usage in a route:
    from app.auth.dependencies import require_roles

    @router.get("/...")
    def endpoint(current_user = Depends(require_roles("admin", "receptionist"))):
        ...

Flow:
    1. Client sends  Authorization: Bearer <firebase-id-token>
    2. verify_firebase_token()  calls Firebase Admin SDK  →  decoded claims dict
    3. get_current_user()       looks up UserProfile row in PostgreSQL
    4. require_roles(...)       checks the role column and raises 403 if not allowed
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Annotated

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.user_profile import UserProfile, VALID_ROLES

# ── HTTP Bearer scheme (auto-requires Authorization header) ──────────────────
_bearer = HTTPBearer(auto_error=True)


def _is_firebase_configured() -> bool:
    """Return True if the Firebase app has been successfully initialised."""
    return bool(firebase_admin._apps)


async def verify_firebase_token(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    Verify a Firebase ID token and return the decoded claims dict.
    Raises 401 if the token is missing, expired, or invalid.
    Raises 503 if Firebase Admin SDK is not configured.
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
    Auto-provisions a 'patient'-role profile on first sign-in so users
    can log in without an admin pre-creating their record.
    """
    uid = claims["uid"]
    profile = db.get(UserProfile, uid)

    if profile is None:
        # First-time sign-in: create a profile with the lowest privilege role.
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
    Factory that returns a FastAPI dependency which enforces role membership.

    Example:
        Depends(require_roles("admin", "receptionist"))
    """
    role_set = frozenset(roles)

    # Validate at import time that only known roles are used.
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
