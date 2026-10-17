"""
FastAPI auth dependencies.

Flow:
    1. Client sends  Authorization: Bearer <firebase-id-token>
    2. verify_firebase_token()  → Firebase Admin SDK → decoded claims dict
    3. get_current_user()       → loads / provisions the UserProfile row
    4. require_permission(...)  → staff permission check (app.auth.permissions)
       allow_patient_or(...)    → staff permission OR patient role; the endpoint
                                  then scopes queries to the patient's own data

The browser never supplies a UID, role or patient_id that the server trusts:
the UID comes from the verified token and everything else from PostgreSQL.
"""
from __future__ import annotations

import logging
from typing import Annotated

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from sqlalchemy.orm import Session

from app.auth.permissions import ALL_PERMISSIONS, has_permission
from app.database.dependencies import get_db
from app.models.user_profile import UserProfile, VALID_ROLES

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

_UNAUTHENTICATED = "Authentication required. Please sign in."


def _unauthorized(detail: str = _UNAUTHENTICATED) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _is_firebase_configured() -> bool:
    return bool(firebase_admin._apps)


async def verify_firebase_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    """Verify a Firebase ID token. Raises 401 (bad token) or 503 (not configured)."""
    if credentials is None or not credentials.credentials:
        raise _unauthorized()

    if not _is_firebase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable.",
        )

    try:
        decoded = firebase_auth.verify_id_token(
            credentials.credentials, check_revoked=True
        )
    except firebase_auth.RevokedIdTokenError:
        raise _unauthorized("Your session has been revoked. Please sign in again.")
    except firebase_auth.ExpiredIdTokenError:
        raise _unauthorized("Your session has expired. Please sign in again.")
    except firebase_auth.UserDisabledError:
        raise _unauthorized("This account has been disabled.")
    except firebase_auth.CertificateFetchError:
        logger.warning("Firebase public certificates could not be fetched.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily unavailable.",
        )
    except Exception as exc:  # noqa: BLE001 — never echo token or SDK details
        logger.info("Rejected ID token (%s).", type(exc).__name__)
        raise _unauthorized("Invalid authentication token.")

    if not decoded.get("uid"):
        raise _unauthorized("Invalid authentication token.")
    return decoded


async def get_current_user(
    claims: Annotated[dict, Depends(verify_firebase_token)],
    db: Session = Depends(get_db),
) -> UserProfile:
    """
    Return the UserProfile for the authenticated Firebase user.

    - Provisions a 'user'-role profile on first sign-in (no permissions).
    - Keeps the cached email in step with the verified token.
    - Fills display_name from the token only while the profile has none, so a
      name changed through PATCH /auth/me is not overwritten.
    """
    uid = claims["uid"]
    profile = db.get(UserProfile, uid)
    token_email = claims.get("email")
    token_name = claims.get("name")

    if profile is None:
        profile = UserProfile(
            firebase_uid=uid,
            role="user",
            display_name=(token_name or None),
            email=token_email,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    changed = False
    if token_email and profile.email != token_email:
        profile.email = token_email
        changed = True
    if token_name and not profile.display_name:
        profile.display_name = token_name
        changed = True
    if changed:
        db.commit()
        db.refresh(profile)
    return profile


CurrentUser = Annotated[UserProfile, Depends(get_current_user)]


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Session = Depends(get_db),
) -> UserProfile | None:
    """
    For public endpoints that show more to signed-in staff. No token → None.
    A token that is present but invalid is still rejected with 401.
    """
    if credentials is None:
        return None
    claims = await verify_firebase_token(credentials)
    return await get_current_user(claims, db)


def _forbidden(detail: str = "You do not have permission to perform this action.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _check_known_permissions(permissions: tuple[str, ...]) -> None:
    unknown = set(permissions) - ALL_PERMISSIONS
    if unknown:
        raise ValueError(f"Unknown permissions: {sorted(unknown)}")


def require_permission(*permissions: str):
    """Dependency: the current user's role must hold every listed permission."""
    _check_known_permissions(permissions)

    async def _check(user: CurrentUser) -> UserProfile:
        if user.role not in VALID_ROLES or not all(
            has_permission(user.role, p) for p in permissions
        ):
            raise _forbidden()
        return user

    return _check


def allow_patient_or(*permissions: str):
    """
    Dependency for endpoints shared by staff and patients.

    Staff must hold every listed permission. Patient-role users are let through
    and the endpoint MUST scope its query to their own data. Everyone else
    (including the default 'user' role and unknown roles) is denied.
    """
    _check_known_permissions(permissions)

    async def _check(user: CurrentUser) -> UserProfile:
        if user.role == "patient":
            return user
        if user.role == "user":
            raise _forbidden(
                "Your account is waiting for an administrator to assign a role."
            )
        if user.role not in VALID_ROLES or not all(
            has_permission(user.role, p) for p in permissions
        ):
            raise _forbidden()
        return user

    return _check


def require_patient():
    """Dependency: only patient-role users."""

    async def _check(user: CurrentUser) -> UserProfile:
        if user.role != "patient":
            raise _forbidden("This action is only available to patients.")
        return user

    return _check
