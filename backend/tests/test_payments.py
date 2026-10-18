"""
Stripe Checkout payments.

Only Stripe's network calls are faked (FakeStripeClient). Webhooks are signed
with a real HMAC and verified by the real stripe.Webhook.construct_event, so
signature checks, event de-duplication, row locking and the database
constraints all run for real against meditrack_db_test.
"""
import hashlib
import hmac
import json
import threading
import time
from datetime import date, datetime, time as dtime
from decimal import Decimal
from types import SimpleNamespace

import pytest
import stripe
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.config import Settings, settings
from app.main import app
from app.models import Appointment, Bill, BillPayment, Patient, StripeEvent
from tests.factories import auth

WHSEC = "whsec_test_meditrack"


class FakeStripeClient:
    """Stands in for stripe.StripeClient; records calls, returns Stripe-shaped objects."""

    created: list = []
    expired: list = []
    sessions_by_id: dict = {}

    def __init__(self, api_key):
        assert api_key.startswith("sk_test_")

        class Sessions:
            def create(self, params=None, options=None):
                sid = f"cs_test_{len(FakeStripeClient.created) + 1:04d}"
                FakeStripeClient.created.append({"params": params, "options": options, "id": sid})
                obj = SimpleNamespace(id=sid, url=f"https://checkout.stripe.com/c/pay/{sid}",
                                      status="open", payment_status="unpaid",
                                      amount_total=params["line_items"][0]["price_data"]["unit_amount"],
                                      currency=params["line_items"][0]["price_data"]["currency"],
                                      payment_intent=None)
                FakeStripeClient.sessions_by_id[sid] = obj
                return obj

            def retrieve(self, session, params=None, options=None):
                return FakeStripeClient.sessions_by_id[session]

            def expire(self, session, params=None, options=None):
                FakeStripeClient.expired.append(session)
                FakeStripeClient.sessions_by_id[session].status = "expired"
                return FakeStripeClient.sessions_by_id[session]

        self.v1 = SimpleNamespace(checkout=SimpleNamespace(sessions=Sessions()))


@pytest.fixture
def stripe_on(monkeypatch):
    FakeStripeClient.created, FakeStripeClient.expired, FakeStripeClient.sessions_by_id = [], [], {}
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    monkeypatch.setattr(settings, "stripe_webhook_secret", WHSEC)
    monkeypatch.setattr(settings, "stripe_currency", "usd")
    monkeypatch.setattr(settings, "public_app_url", "http://localhost:5173")
    monkeypatch.setattr(stripe, "StripeClient", FakeStripeClient)
    return FakeStripeClient


def signed(payload: dict, secret: str = WHSEC, ts: int | None = None):
    body = json.dumps(payload)
    ts = ts or int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    return body, {"Stripe-Signature": f"t={ts},v1={sig}", "Content-Type": "application/json"}


def event(etype, session_id, *, event_id=None, payment_status="paid", amount=10000, currency="usd", status="complete"):
    return {
        "id": event_id or f"evt_{etype}_{session_id}",
        "object": "event", "type": etype, "api_version": stripe.api_version,
        "created": int(time.time()), "livemode": False,
        "data": {"object": {
            "id": session_id, "object": "checkout.session", "status": status,
            "payment_status": payment_status, "amount_total": amount, "currency": currency,
            "payment_intent": "pi_test_123",
        }},
    }


def deliver(client, payload, **kw):
    body, headers = signed(payload, **kw)
    return client.post("/payments/stripe/webhook", content=body, headers=headers)


def checkout(client, world, who="patient_a", bill="bill_a"):
    return client.post(f"/bills/{world.ids[bill]}/checkout", headers=auth(world.uids[who]))


# ── Grouping ──────────────────────────────────────────────────────────────────

def _paid_patient(db, world):
    """Patient C with one paid bill and one cancelled bill → counts as fully paid."""
    now = datetime.now()
    pc = Patient(first_name="Cara", last_name="Paid", date_of_birth=date(1970, 1, 1), gender="Female",
                 phone="+10000000013", registered_at=now)
    db.add(pc); db.flush()
    appts = [Appointment(patient_id=pc.patient_id, doctor_id=world.ids["doctor"], appointment_date=date(2025, 7, d),
                         appointment_time=dtime(9, 0), status="completed", created_at=now) for d in (1, 2)]
    db.add_all(appts); db.flush()
    db.add_all([
        Bill(patient_id=pc.patient_id, appointment_id=appts[0].appointment_id, amount=Decimal("40.00"),
             payment_status="paid", payment_method="Cash", issued_at=now, paid_at=now),
        Bill(patient_id=pc.patient_id, appointment_id=appts[1].appointment_id, amount=Decimal("5.00"),
             payment_status="cancelled", issued_at=now),
    ])
    db.commit()
    return pc.patient_id


@pytest.mark.parametrize("role", ["admin", "receptionist", "accountant"])
def test_summary_groups_pending_and_fully_paid(client, db, world, role):
    pc = _paid_patient(db, world)
    body = client.get("/bills/summary", headers=auth(world.uids[role])).json()
    assert {b["bill_id"] for b in body["pending"]} == {world.ids["bill_a"], world.ids["bill_b"]}
    assert Decimal(body["pending_total"]) == Decimal("180.00")
    assert [p["patient_id"] for p in body["fully_paid"]] == [pc]
    assert body["fully_paid"][0]["bills_paid"] == 1 and Decimal(body["fully_paid"][0]["total_paid"]) == Decimal("40.00")
    first = body["pending"][0]
    assert first["patient_name"] and first["days_outstanding"] >= 0 and first["checkout_open"] is False


def test_patient_with_any_pending_bill_is_not_fully_paid(client, db, world):
    _paid_patient(db, world)
    body = client.get("/bills/summary", headers=auth(world.uids["admin"])).json()
    assert world.ids["patient_a"] not in [p["patient_id"] for p in body["fully_paid"]]


def test_patient_summary_is_private(client, db, world):
    _paid_patient(db, world)
    body = client.get("/bills/summary", headers=auth(world.uids["patient_a"])).json()
    assert [b["bill_id"] for b in body["pending"]] == [world.ids["bill_a"]]
    assert body["fully_paid"] == []
    assert client.get("/bills/summary", headers=auth(world.uids["patient_u"])).json()["pending"] == []


@pytest.mark.parametrize("role", ["doctor", "pharmacist", "user"])
def test_summary_denied_to_roles_without_billing(client, world, role):
    assert client.get("/bills/summary", headers=auth(world.uids[role])).status_code == 403


def test_summary_reports_whether_online_payment_is_enabled(client, world, stripe_on):
    assert client.get("/bills/summary", headers=auth(world.uids["admin"])).json()["online_payment_enabled"] is True


# ── Checkout ──────────────────────────────────────────────────────────────────

def test_checkout_not_configured_is_503(client, world, monkeypatch):
    monkeypatch.setattr(settings, "stripe_secret_key", None)
    r = checkout(client, world)
    assert r.status_code == 503 and "not available" in r.json()["detail"]


def test_live_keys_are_rejected():
    with pytest.raises(ValueError, match="test-mode"):
        Settings(database_url="postgresql://x/y", stripe_secret_key="sk_live_abc")
    assert Settings(database_url="postgresql://x/y", stripe_secret_key="sk_test_abc").stripe_enabled


def test_patient_checkout_uses_server_amount_and_test_urls(client, db, world, stripe_on):
    r = checkout(client, world)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["checkout_url"].startswith("https://checkout.stripe.com/")
    params = stripe_on.created[0]["params"]
    assert params["mode"] == "payment"
    assert params["line_items"][0]["price_data"] == {
        "currency": "usd", "unit_amount": 10000,
        "product_data": {"name": f"MediTrack bill #{world.ids['bill_a']}",
                         "description": f"Appointment #{world.ids['appt_a']}"},
    }
    assert params["metadata"] == {"bill_id": str(world.ids["bill_a"])}
    assert params["success_url"] == "http://localhost:5173/bills?payment=success&session_id={CHECKOUT_SESSION_ID}"
    assert params["cancel_url"].startswith("http://localhost:5173/bills?payment=cancelled")
    assert stripe_on.created[0]["options"]["idempotency_key"].startswith(f"meditrack-bill-{world.ids['bill_a']}-10000-")
    payment = db.scalars(select(BillPayment)).one()
    assert payment.status == "open" and payment.amount_cents == 10000 and payment.created_by == world.uids["patient_a"]
    # The bill is NOT paid just because checkout started.
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "pending"


def test_repeat_checkout_reuses_the_open_session(client, db, world, stripe_on):
    first = checkout(client, world).json()
    second = checkout(client, world).json()
    assert first["session_id"] == second["session_id"]
    assert len(stripe_on.created) == 1
    assert db.scalar(select(func.count()).select_from(BillPayment)) == 1


def test_parallel_checkout_clicks_create_one_session(db, world, stripe_on):
    results = []
    barrier = threading.Barrier(3)

    def click():
        c = TestClient(app, raise_server_exceptions=False)
        barrier.wait()
        results.append(c.post(f"/bills/{world.ids['bill_a']}/checkout", headers=auth(world.uids["patient_a"])).json()["session_id"])

    threads = [threading.Thread(target=click) for _ in range(3)]
    for t in threads: t.start()
    for t in threads: t.join()
    assert len(set(results)) == 1 and len(stripe_on.created) == 1


@pytest.mark.parametrize("who,bill,code", [
    ("patient_a", "bill_b", 404),      # another patient's bill
    ("patient_u", "bill_a", 404),      # unlinked patient
    ("admin", "bill_a", 403),          # staff may manage bills but never pay them
    ("receptionist", "bill_a", 403),
    ("accountant", "bill_a", 403),
    ("doctor", "bill_a", 403),
    ("pharmacist", "bill_a", 403),
    ("user", "bill_a", 403),
])
def test_checkout_permissions(client, world, stripe_on, who, bill, code):
    assert checkout(client, world, who=who, bill=bill).status_code == code
    assert stripe_on.created == []


@pytest.mark.parametrize("status_", ["paid", "cancelled"])
def test_checkout_refused_for_non_pending_bills(client, db, world, stripe_on, status_):
    bill = db.get(Bill, world.ids["bill_a"])
    bill.payment_status = status_
    bill.paid_at = datetime.now() if status_ == "paid" else None
    db.commit()
    assert checkout(client, world).status_code == 409
    assert stripe_on.created == []


def test_zero_amount_bill_cannot_be_paid_online(client, db, world, stripe_on):
    db.get(Bill, world.ids["bill_a"]).amount = Decimal("0.00")
    db.commit()
    assert checkout(client, world).status_code == 409


# ── Webhooks ──────────────────────────────────────────────────────────────────

def test_webhook_rejects_bad_or_missing_signature(client, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    payload = event("checkout.session.completed", sid)
    assert client.post("/payments/stripe/webhook", content=json.dumps(payload)).status_code == 400
    assert deliver(client, payload, secret="whsec_wrong").status_code == 400
    assert deliver(client, payload, ts=int(time.time()) - 3600).status_code == 400  # replayed / stale
    assert client.get(f"/bills/{world.ids['bill_a']}", headers=auth(world.uids["admin"])).json()["payment_status"] == "pending"


def test_webhook_not_configured_is_503(client, monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", None)
    assert client.post("/payments/stripe/webhook", content="{}").status_code == 503


def test_successful_payment_marks_bill_paid(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    r = deliver(client, event("checkout.session.completed", sid))
    assert r.status_code == 200 and r.json()["outcome"] == "paid"
    db.expire_all()
    bill = db.get(Bill, world.ids["bill_a"])
    assert bill.payment_status == "paid" and bill.paid_at is not None and bill.payment_method == "Card (Stripe)"
    payment = db.scalars(select(BillPayment)).one()
    assert payment.status == "paid" and payment.stripe_payment_intent_id == "pi_test_123"
    assert checkout(client, world).status_code == 409


def test_duplicate_webhook_delivery_is_applied_once(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    payload = event("checkout.session.completed", sid, event_id="evt_same")
    assert deliver(client, payload).json()["outcome"] == "paid"
    db.expire_all()
    paid_at = db.get(Bill, world.ids["bill_a"]).paid_at
    second = deliver(client, payload)
    assert second.status_code == 200 and second.json()["outcome"] == "duplicate_event"
    db.expire_all()
    assert db.get(Bill, world.ids["bill_a"]).paid_at == paid_at
    assert db.scalar(select(func.count()).select_from(StripeEvent)) == 1


def test_concurrent_duplicate_webhooks(db, world, stripe_on):
    c = TestClient(app, raise_server_exceptions=False)
    sid = c.post(f"/bills/{world.ids['bill_a']}/checkout", headers=auth(world.uids["patient_a"])).json()["session_id"]
    payload = event("checkout.session.completed", sid, event_id="evt_race")
    outcomes, barrier = [], threading.Barrier(4)

    def send():
        cl = TestClient(app, raise_server_exceptions=False)
        barrier.wait()
        outcomes.append(deliver(cl, payload).json()["outcome"])

    threads = [threading.Thread(target=send) for _ in range(4)]
    for t in threads: t.start()
    for t in threads: t.join()
    assert sorted(outcomes) == ["duplicate_event"] * 3 + ["paid"]


def test_different_events_for_same_session_are_idempotent(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    deliver(client, event("checkout.session.completed", sid, event_id="evt_1"))
    r = deliver(client, event("checkout.session.async_payment_succeeded", sid, event_id="evt_2"))
    assert r.json()["outcome"] == "already_applied"
    db.expire_all()
    assert db.scalars(select(BillPayment)).one().status == "paid"


def test_second_payment_for_paid_bill_is_flagged_not_applied(client, db, world, stripe_on):
    sid1 = checkout(client, world).json()["session_id"]
    # Simulate a second session paid in another tab after the first expired locally.
    db.scalars(select(BillPayment)).one().expires_at = datetime(2000, 1, 1)
    db.commit()
    sid2 = checkout(client, world).json()["session_id"]
    assert sid1 != sid2
    assert deliver(client, event("checkout.session.completed", sid1, event_id="evt_a")).json()["outcome"] == "paid"
    r = deliver(client, event("checkout.session.completed", sid2, event_id="evt_b"))
    assert r.json()["outcome"] == "duplicate"
    db.expire_all()
    statuses = {p.stripe_session_id: p.status for p in db.scalars(select(BillPayment))}
    assert statuses == {sid1: "paid", sid2: "duplicate"}


def test_amount_mismatch_is_never_marked_paid(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    r = deliver(client, event("checkout.session.completed", sid, amount=100))
    assert r.json()["outcome"] == "needs_review"
    db.expire_all()
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "pending"
    r = deliver(client, event("checkout.session.completed", sid, event_id="evt_cur", currency="eur"))
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "pending"


def test_delayed_payment_then_success_or_failure(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    r = deliver(client, event("checkout.session.completed", sid, payment_status="unpaid"))
    assert r.json()["outcome"] == "awaiting_payment"
    db.expire_all()
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "pending"
    r = deliver(client, event("checkout.session.async_payment_failed", sid, payment_status="unpaid"))
    assert r.json()["outcome"] == "failed"
    db.expire_all()
    assert db.scalars(select(BillPayment)).one().status == "failed"
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "pending"
    # After a failure the patient can start a fresh checkout.
    assert checkout(client, world).json()["session_id"] != sid


def test_expired_or_abandoned_checkout_leaves_bill_pending(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    r = deliver(client, event("checkout.session.expired", sid, payment_status="unpaid", status="expired"))
    assert r.json()["outcome"] == "expired"
    db.expire_all()
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "pending"
    assert checkout(client, world).json()["session_id"] != sid


def test_unknown_session_and_other_event_types_are_ignored(client, db, world, stripe_on):
    assert deliver(client, event("checkout.session.completed", "cs_test_unknown")).json()["outcome"] == "unknown_session"
    assert deliver(client, event("customer.created", "cus_1")).json()["outcome"] == "ignored"
    db.expire_all()
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "pending"


# ── Return page ───────────────────────────────────────────────────────────────

def test_cancelled_checkout_changes_nothing(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    # The patient pressed "back" on Stripe: no webhook, session still open.
    r = client.get(f"/payments/stripe/sessions/{sid}", headers=auth(world.uids["patient_a"]))
    assert r.json() == {"bill_id": world.ids["bill_a"], "bill_status": "pending", "payment_status": "open"}


def test_return_page_reconciles_with_stripe_when_webhook_is_late(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    stripe_on.sessions_by_id[sid].status = "complete"
    stripe_on.sessions_by_id[sid].payment_status = "paid"
    r = client.get(f"/payments/stripe/sessions/{sid}", headers=auth(world.uids["patient_a"]))
    assert r.json()["bill_status"] == "paid" and r.json()["payment_status"] == "paid"
    # The webhook arriving afterwards does not apply it twice.
    assert deliver(client, event("checkout.session.completed", sid)).json()["outcome"] == "already_applied"


def test_return_page_is_private(client, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    assert client.get(f"/payments/stripe/sessions/{sid}", headers=auth(world.uids["patient_b"])).status_code == 404
    assert client.get(f"/payments/stripe/sessions/{sid}", headers=auth(world.uids["doctor"])).status_code == 403
    assert client.get("/payments/stripe/sessions/not-a-session", headers=auth(world.uids["admin"])).status_code == 422


# ── Staff changes ─────────────────────────────────────────────────────────────

def test_changing_the_amount_closes_the_open_checkout(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    r = client.patch(f"/bills/{world.ids['bill_a']}", headers=auth(world.uids["accountant"]), json={"amount": "120.00"})
    assert r.status_code == 200
    assert stripe_on.expired == [sid]
    db.expire_all()
    assert db.scalars(select(BillPayment)).one().status == "expired"
    # Paying the stale session anyway is flagged, never applied.
    r = deliver(client, event("checkout.session.completed", sid))
    db.expire_all()
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "pending"


def test_staff_cash_payment_still_works_and_closes_checkout(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    r = client.patch(f"/bills/{world.ids['bill_a']}", headers=auth(world.uids["receptionist"]),
                     json={"payment_status": "paid", "payment_method": "Cash"})
    assert r.status_code == 200 and r.json()["payment_method"] == "Cash"
    assert stripe_on.expired == [sid]


def test_bill_with_payment_history_cannot_be_deleted(client, world, stripe_on):
    checkout(client, world)
    assert client.delete(f"/bills/{world.ids['bill_a']}", headers=auth(world.uids["admin"])).status_code == 409


# ── Only patients pay ─────────────────────────────────────────────────────────

STAFF_ROLES = ["admin", "receptionist", "accountant", "doctor", "pharmacist"]


@pytest.mark.parametrize("role", STAFF_ROLES)
def test_staff_direct_checkout_request_is_refused(client, db, world, stripe_on, role):
    """A direct API call from any staff role is refused before Stripe is contacted."""
    for bill in ("bill_a", "bill_b", "does-not-exist"):
        path = f"/bills/{world.ids[bill]}/checkout" if bill in world.ids else "/bills/999999/checkout"
        r = client.post(path, headers=auth(world.uids[role]))
        assert r.status_code == 403, (role, bill, r.text)
        assert "patients" in r.json()["detail"].lower()
    assert stripe_on.created == []
    assert db.scalar(select(func.count()).select_from(BillPayment)) == 0


@pytest.mark.parametrize("role", STAFF_ROLES)
def test_staff_cannot_use_a_patients_open_session(client, db, world, stripe_on, role):
    """Even when the patient already has an open session, staff cannot obtain its URL."""
    assert checkout(client, world).status_code == 200
    r = checkout(client, world, who=role)
    assert r.status_code == 403
    assert "checkout_url" not in r.text
    assert len(stripe_on.created) == 1


@pytest.mark.parametrize("role", ["admin", "receptionist", "accountant"])
def test_billing_staff_still_view_and_manage_bills(client, world, stripe_on, role):
    h = auth(world.uids[role])
    assert client.get("/bills/", headers=h).status_code == 200
    assert client.get(f"/bills/{world.ids['bill_a']}", headers=h).status_code == 200
    assert client.get("/bills/summary", headers=h).status_code == 200
    r = client.patch(f"/bills/{world.ids['bill_a']}", headers=h, json={"payment_status": "paid", "payment_method": "Cash"})
    assert r.status_code == 200 and r.json()["payment_status"] == "paid"


def test_patient_payment_flow_still_works_end_to_end(client, db, world, stripe_on):
    sid = checkout(client, world).json()["session_id"]
    assert deliver(client, event("checkout.session.completed", sid)).json()["outcome"] == "paid"
    db.expire_all()
    assert db.get(Bill, world.ids["bill_a"]).payment_status == "paid"
    assert client.get(f"/payments/stripe/sessions/{sid}", headers=auth(world.uids["patient_a"])).json()["bill_status"] == "paid"
