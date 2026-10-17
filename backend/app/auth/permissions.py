"""
Central role → permission matrix.

Every protected endpoint names the permission it needs; this module is the
single place that decides which roles hold it. Unknown roles, and the default
"user" role, hold no permissions, so access is denied by default.

Patients are handled separately: they never receive staff permissions.
Endpoints that patients may call check `is_patient(user)` and then restrict
queries to the patient's own data (see app.auth.ownership).
"""
from __future__ import annotations

from app.models.user_profile import STAFF_ROLES, VALID_ROLES

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "admin": frozenset({
        "users:manage",
        "patients:read", "patients:write", "patients:delete",
        "departments:write", "departments:delete",
        "doctors:write", "doctors:delete",
        "appointments:read", "appointments:write", "appointments:delete",
        "medical_records:read", "medical_records:write", "medical_records:delete",
        "medicines:read", "medicines:write", "medicines:delete",
        "prescriptions:read", "prescriptions:write", "prescriptions:delete",
        "prescription_items:read", "prescription_items:write", "prescription_items:delete",
        "bills:read", "bills:write", "bills:delete",
    }),
    "receptionist": frozenset({
        "patients:read", "patients:write",
        "appointments:read", "appointments:write",
        "bills:read", "bills:write",
    }),
    "doctor": frozenset({
        "patients:read",
        "appointments:read",
        "medical_records:read", "medical_records:write",
        "medicines:read",
        "prescriptions:read", "prescriptions:write",
        "prescription_items:read", "prescription_items:write", "prescription_items:delete",
    }),
    "pharmacist": frozenset({
        "medicines:read", "medicines:write",
        "prescriptions:read",
        "prescription_items:read",
    }),
    "accountant": frozenset({
        "patients:read",
        "appointments:read",
        "bills:read", "bills:write",
    }),
    "patient": frozenset(),
    "user": frozenset(),
}

ALL_PERMISSIONS: frozenset[str] = frozenset().union(*ROLE_PERMISSIONS.values())

assert set(ROLE_PERMISSIONS) == set(VALID_ROLES), "ROLE_PERMISSIONS must cover every role"


def has_permission(role: str | None, permission: str) -> bool:
    if permission not in ALL_PERMISSIONS:
        raise ValueError(f"Unknown permission: {permission}")
    return permission in ROLE_PERMISSIONS.get(role or "", frozenset())


def is_staff(role: str | None) -> bool:
    return role in STAFF_ROLES


def permissions_for(role: str | None) -> list[str]:
    return sorted(ROLE_PERMISSIONS.get(role or "", frozenset()))
