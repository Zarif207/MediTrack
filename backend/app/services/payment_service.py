"""
Stripe Checkout for bills (test mode only — see Settings.stripe_secret_key).

Rules:
  - The amount charged always comes from the bill in the database, never from
    the browser.
  - A bill becomes "paid" only after Stripe confirms the payment through a
    signature-verified webhook, or when the server itself retrieves the
    Checkout Session from Stripe with the secret key and it reports "paid".
    The browser being sent to the success URL proves nothing and changes
    nothing.
  - Duplicate protection: an open Checkout Session is reused instead of
    creating another; each webhook event ID is applied once; the bill row is
    locked while a payment is applied; the database allows one paid attempt per
    bill; a payment that arrives for a bill that is already paid (or cancelled,
    or whose amount changed) is recorded for refund/review and never applied.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal

import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.bill import Bill
from app.models.payment import BillPayment, StripeEvent
from app.models.user_profile import UserProfile

logger = logging.getLogger(__name__)

# Stripe requires Checkout Sessions to stay open at least 30 minutes.
SESSION_LIFETIME = timedelta(minutes=31)
PAYMENT_METHOD_LABEL = "Card (Stripe)"


def get_client() -> stripe.StripeClient:
    if not settings.stripe_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Online payment is not available right now. Please pay at the clinic.",
        )
    return stripe.StripeClient(settings.stripe_secret_key)


def to_cents(amount: Decimal) -> int:
    return int((Decimal(amount) * 100).quantize(Decimal("1")))


def _provider_error(exc: Exception) -> HTTPException:
    logger.warning("Stripe request failed (%s).", type(exc).__name__)
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="The payment provider could not be reached. Please try again.",
    )


def lock_bill(db: Session, bill_id: int) -> Bill:
    """
    SELECT … FOR UPDATE the bill. populate_existing refreshes a Bill the session
    already loaded, so status checks after the lock see the committed row, not
    a copy read before another request changed it.
    """
    bill = db.scalars(
        select(Bill).where(Bill.bill_id == bill_id).with_for_update()
        .execution_options(populate_existing=True)
    ).first()
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found.")
    return bill


def settled_online(db: Session, bill_id: int) -> bool:
    """True when a Stripe payment for this bill has been confirmed and applied."""
    return db.scalar(
        select(BillPayment.payment_id).where(BillPayment.bill_id == bill_id, BillPayment.status == "paid").limit(1)
    ) is not None


# ── Checkout ──────────────────────────────────────────────────────────────────

def start_checkout(db: Session, bill_id: int, user: UserProfile) -> BillPayment:
    """Return an open Checkout Session for the bill, creating one if needed."""
    client = get_client()
    bill = lock_bill(db, bill_id)  # serialises double clicks and parallel tabs

    if bill.payment_status == "paid":
        raise HTTPException(status_code=409, detail="This bill has already been paid.")
    if bill.payment_status != "pending":
        raise HTTPException(status_code=409, detail="This bill is not awaiting payment.")
    cents = to_cents(bill.amount)
    if cents <= 0:
        raise HTTPException(status_code=409, detail="There is nothing to pay on this bill.")

    now = datetime.now()
    existing = db.scalars(
        select(BillPayment).where(
            BillPayment.bill_id == bill.bill_id,
            BillPayment.status == "open",
            BillPayment.amount_cents == cents,
            BillPayment.currency == settings.stripe_currency,
            BillPayment.expires_at > now + timedelta(minutes=2),
        ).order_by(BillPayment.created_at.desc())
    ).first()
    if existing is not None and existing.checkout_url:
        db.commit()  # release the lock
        return existing

    attempt = db.scalar(
        select(BillPayment.payment_id).where(BillPayment.bill_id == bill.bill_id).order_by(
            BillPayment.payment_id.desc()).limit(1)
    ) or 0
    base = settings.public_app_url.rstrip("/")
    try:
        session = client.v1.checkout.sessions.create(
            params={
                "mode": "payment",
                "client_reference_id": str(bill.bill_id),
                "line_items": [{
                    "quantity": 1,
                    "price_data": {
                        "currency": settings.stripe_currency,
                        "unit_amount": cents,
                        "product_data": {
                            "name": f"MediTrack bill #{bill.bill_id}",
                            "description": f"Appointment #{bill.appointment_id}",
                        },
                    },
                }],
                "metadata": {"bill_id": str(bill.bill_id)},
                "payment_intent_data": {"metadata": {"bill_id": str(bill.bill_id)}},
                "success_url": f"{base}/bills?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
                "cancel_url": f"{base}/bills?payment=cancelled&bill={bill.bill_id}",
                "expires_at": int((now + SESSION_LIFETIME).timestamp()),
            },
            # A retried request for the same bill/amount/attempt returns the
            # same session instead of creating a second one.
            options={"idempotency_key": f"meditrack-bill-{bill.bill_id}-{cents}-{attempt}"},
        )
    except stripe.StripeError as exc:
        db.rollback()
        raise _provider_error(exc) from exc

    payment = BillPayment(
        bill_id=bill.bill_id,
        stripe_session_id=session.id,
        checkout_url=session.url,
        amount_cents=cents,
        currency=settings.stripe_currency,
        status="open",
        created_by=user.firebase_uid,
        created_at=now,
        expires_at=now + SESSION_LIFETIME,
    )
    db.add(payment)
    try:
        db.commit()
    except IntegrityError:
        # Same session returned for an idempotent retry that was already stored.
        db.rollback()
        payment = db.scalars(select(BillPayment).where(BillPayment.stripe_session_id == session.id)).one()
    return payment


def expire_open_sessions(db: Session, bill_id: int, reason: str) -> None:
    """
    Close any open Checkout Sessions for a bill whose amount or status changed,
    so a stale session cannot be paid. Best effort at Stripe; always recorded
    locally. Caller commits.
    """
    open_payments = db.scalars(
        select(BillPayment).where(BillPayment.bill_id == bill_id, BillPayment.status == "open")
    ).all()
    if not open_payments:
        return
    client = stripe.StripeClient(settings.stripe_secret_key) if settings.stripe_enabled else None
    for payment in open_payments:
        if client is not None:
            try:
                client.v1.checkout.sessions.expire(payment.stripe_session_id)
            except stripe.StripeError as exc:
                logger.warning("Could not expire Stripe session for bill %s (%s).", bill_id, type(exc).__name__)
        payment.status = "expired"
        payment.note = reason[:255]
        payment.completed_at = datetime.now()


# ── Confirmation ──────────────────────────────────────────────────────────────

def _apply_paid_session(db: Session, payment: BillPayment, session) -> str:
    """Apply a Stripe session that Stripe reports as paid. Caller commits. Idempotent."""
    if payment.status == "paid":
        return "already_applied"
    bill = lock_bill(db, payment.bill_id)
    payment.stripe_payment_intent_id = _id_of(getattr(session, "payment_intent", None))
    payment.completed_at = datetime.now()

    amount_total = getattr(session, "amount_total", None)
    currency = (getattr(session, "currency", None) or "").lower()
    if amount_total != payment.amount_cents or currency != payment.currency:
        payment.status = "needs_review"
        payment.note = f"Paid {amount_total} {currency}; expected {payment.amount_cents} {payment.currency}."
        logger.warning("Stripe amount mismatch on bill %s; not marked paid.", bill.bill_id)
        return "needs_review"
    if bill.payment_status == "paid":
        payment.status = "duplicate"
        payment.note = "Bill was already paid; refund this payment."
        logger.warning("Duplicate payment received for bill %s; flagged for refund.", bill.bill_id)
        return "duplicate"
    if bill.payment_status != "pending" or to_cents(bill.amount) != payment.amount_cents:
        payment.status = "needs_review"
        payment.note = "Bill was cancelled or changed after checkout started; review and refund."
        logger.warning("Payment for changed/cancelled bill %s; flagged for review.", bill.bill_id)
        return "needs_review"

    payment.status = "paid"
    bill.payment_status = "paid"
    bill.paid_at = datetime.now()
    bill.payment_method = PAYMENT_METHOD_LABEL
    return "paid"


def _id_of(value):
    if value is None or isinstance(value, str):
        return value
    return getattr(value, "id", None)


def _payment_for_session(db: Session, session_id: str) -> BillPayment | None:
    return db.scalars(
        select(BillPayment).where(BillPayment.stripe_session_id == session_id).with_for_update()
        .execution_options(populate_existing=True)
    ).first()


def handle_event(db: Session, event) -> str:
    """Process one verified webhook event exactly once. Returns an outcome label."""
    if getattr(event, "livemode", False):
        # Only test-mode keys are accepted; a live event means a misconfigured endpoint.
        logger.warning("Ignored a live-mode Stripe event; MediTrack runs in test mode only.")
        return "ignored_livemode"
    db.add(StripeEvent(event_id=event.id, event_type=event.type, received_at=datetime.now()))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return "duplicate_event"

    outcome = "ignored"
    if event.type.startswith("checkout.session."):
        session = event.data.object
        payment = _payment_for_session(db, session.id)
        if payment is None:
            logger.info("Webhook for an unknown Checkout Session; ignored.")
            outcome = "unknown_session"
        elif event.type in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
            if getattr(session, "payment_status", None) == "paid":
                outcome = _apply_paid_session(db, payment, session)
            else:
                outcome = "awaiting_payment"  # e.g. a delayed bank payment
        elif event.type == "checkout.session.async_payment_failed":
            if payment.status == "open":
                payment.status, payment.completed_at = "failed", datetime.now()
            outcome = "failed"
        elif event.type == "checkout.session.expired":
            if payment.status == "open":
                payment.status, payment.completed_at = "expired", datetime.now()
            outcome = "expired"
    db.commit()
    return outcome


def reconcile_session(db: Session, payment: BillPayment) -> BillPayment:
    """
    If the webhook has not arrived yet, ask Stripe (server-side, with the secret
    key) whether this session has been paid. Used by the return page.
    """
    if payment.status != "open" or not settings.stripe_enabled:
        return payment
    try:
        session = get_client().v1.checkout.sessions.retrieve(payment.stripe_session_id)
    except stripe.StripeError as exc:
        logger.info("Could not retrieve Stripe session (%s).", type(exc).__name__)
        return payment
    locked = _payment_for_session(db, payment.stripe_session_id)
    if getattr(session, "status", None) == "complete" and getattr(session, "payment_status", None) == "paid":
        _apply_paid_session(db, locked, session)
    elif getattr(session, "status", None) == "expired" and locked.status == "open":
        locked.status, locked.completed_at = "expired", datetime.now()
    db.commit()
    db.refresh(locked)
    return locked


# ── Grouping ──────────────────────────────────────────────────────────────────

def summarise(bills: list[Bill], open_bill_ids: set[int]) -> dict:
    """Pending bills (oldest first) and patients whose every active bill is paid."""
    now = datetime.now()
    pending = []
    by_patient: dict[int, dict] = {}
    for bill in bills:
        if bill.payment_status == "cancelled":
            continue
        name = f"{bill.patient.first_name} {bill.patient.last_name}" if bill.patient else None
        entry = by_patient.setdefault(bill.patient_id, {
            "patient_id": bill.patient_id, "patient_name": name,
            "bills_paid": 0, "total_paid": Decimal("0"), "last_paid_at": None, "has_pending": False,
        })
        if bill.payment_status == "pending":
            entry["has_pending"] = True
            pending.append({
                "bill_id": bill.bill_id,
                "patient_id": bill.patient_id,
                "patient_name": name,
                "appointment_id": bill.appointment_id,
                "amount": bill.amount,
                "issued_at": bill.issued_at,
                "days_outstanding": max(0, (now - bill.issued_at).days),
                "checkout_open": bill.bill_id in open_bill_ids,
            })
        else:
            entry["bills_paid"] += 1
            entry["total_paid"] += bill.amount
            if bill.paid_at and (entry["last_paid_at"] is None or bill.paid_at > entry["last_paid_at"]):
                entry["last_paid_at"] = bill.paid_at
    pending.sort(key=lambda b: b["issued_at"])
    fully_paid = sorted(
        ({k: v for k, v in e.items() if k != "has_pending"} for e in by_patient.values()
         if not e["has_pending"] and e["bills_paid"] > 0),
        key=lambda e: (e["patient_name"] or ""),
    )
    return {
        "pending": pending,
        "pending_total": sum((b["amount"] for b in pending), Decimal("0")),
        "fully_paid": fully_paid,
        "online_payment_enabled": settings.stripe_enabled,
    }
