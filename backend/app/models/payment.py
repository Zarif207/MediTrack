"""
Online payments for bills (Stripe Checkout).

BillPayment is one Checkout attempt. A bill is marked paid only when a
verified Stripe confirmation arrives for one of its attempts. The partial
unique index allows at most one *paid* attempt per bill, so a bill can never
be settled twice in the database.

StripeEvent records every webhook event ID that has been processed; Stripe
retries deliveries, and a repeated event is acknowledged without being applied
again.
"""
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

PAYMENT_STATUSES = ("open", "paid", "expired", "failed", "duplicate", "needs_review")


class BillPayment(Base):
    __tablename__ = "bill_payments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'paid', 'expired', 'failed', 'duplicate', 'needs_review')",
            name="ck_bill_payments_status",
        ),
        CheckConstraint("amount_cents > 0", name="ck_bill_payments_amount_positive"),
        Index(
            "uq_bill_payments_one_paid_per_bill",
            "bill_id",
            unique=True,
            postgresql_where=text("status = 'paid'"),
        ),
    )

    payment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    bill_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("bills.bill_id"), nullable=False, index=True)
    stripe_session_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str | None] = mapped_column(
        String(128), ForeignKey("user_profiles.firebase_uid", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    bill: Mapped["Bill"] = relationship()


class StripeEvent(Base):
    __tablename__ = "stripe_events"

    event_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
