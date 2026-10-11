
"""Firebase Admin SDK initialization."""
import firebase_admin
from firebase_admin import credentials

from app.core.config import settings


def initialize_firebase() -> None:
    """Initialize Firebase Admin SDK once per process."""
    if firebase_admin._apps:
        return

    service_account_path = settings.firebase_service_account_path

    if service_account_path:
        cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(
            cred,
            {"projectId": "meditrack-7fe46"},
        )
    else:
        # Use Application Default Credentials if explicitly configured.
        firebase_admin.initialize_app(
            options={"projectId": "meditrack-7fe46"}
        )
