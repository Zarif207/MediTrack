"""Firebase Admin SDK initialization."""
import logging

import firebase_admin
from firebase_admin import credentials

from app.core.config import settings

logger = logging.getLogger(__name__)


def initialize_firebase() -> None:
    """
    Initialize the Firebase Admin SDK once per process.

    Development: a missing or unreadable credential is logged and the API keeps
    running; authenticated endpoints then answer 503 instead of crashing.
    Production: the same problem aborts startup so the server never runs
    without working token verification.
    """
    if firebase_admin._apps:
        return

    options = {"projectId": settings.firebase_project_id}
    try:
        if settings.firebase_service_account_path:
            cred = credentials.Certificate(settings.firebase_service_account_path)
            firebase_admin.initialize_app(cred, options)
        else:
            # Application Default Credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS).
            firebase_admin.initialize_app(options=options)
            logger.warning(
                "FIREBASE_SERVICE_ACCOUNT_PATH is not set; using Application "
                "Default Credentials. Revocation checks require valid credentials."
            )
    except Exception as exc:  # noqa: BLE001 — never log credential contents
        if settings.is_production:
            raise RuntimeError(
                "Firebase Admin SDK could not be initialised. Check the "
                "service-account configuration."
            ) from exc
        logger.error(
            "Firebase Admin SDK could not be initialised (%s). Authenticated "
            "endpoints will return 503 until this is fixed.",
            type(exc).__name__,
        )
