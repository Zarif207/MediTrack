"""
Stripe endpoints.

  POST /payments/stripe/webhook               Stripe → MediTrack. No user auth;
                                              authenticity comes from the
                                              Stripe-Signature header, verified
                                              with STRIPE_WEBHOOK_SECRET.
  GET  /payments/stripe/sessions/{session_id} The return page asks whether a
                                              checkout has been confirmed. Reads
                                              the database and, if the webhook
                                              has not arrived, asks Stripe
                                              server-side. Never trusts the browser.
"""
import logging
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import allow_patient_or
from app.auth.ownership import is_patient, not_found, owns_appointment
from app.core.config import settings
from app.database.dependencies import get_db
from app.models.payment import BillPayment
from app.models.user_profile import UserProfile
from app.schemas.bill import PaymentStatusResponse
from app.services import payment_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments/stripe", tags=["Payments"])


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhooks are not configured.")
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature.")
    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        logger.warning("Rejected a Stripe webhook with an invalid signature or payload.")
        raise HTTPException(status_code=400, detail="Invalid Stripe signature.")
    outcome = payment_service.handle_event(db, event)
    logger.info("Stripe event %s → %s", event.type, outcome)
    return {"received": True, "outcome": outcome}


@router.get("/sessions/{session_id}", response_model=PaymentStatusResponse)
def checkout_status(
    session_id: Annotated[str, Path(min_length=8, max_length=255, pattern=r"^cs_[A-Za-z0-9_]+$")],
    current_user: Annotated[UserProfile, Depends(allow_patient_or("bills:read"))],
    db: Session = Depends(get_db),
):
    payment = db.scalars(select(BillPayment).where(BillPayment.stripe_session_id == session_id)).first()
    if payment is None or (is_patient(current_user) and not owns_appointment(current_user, payment.bill.appointment)):
        raise not_found("Payment")
    payment = payment_service.reconcile_session(db, payment)
    return {"bill_id": payment.bill_id, "bill_status": payment.bill.payment_status, "payment_status": payment.status}
