# Online payment — Stripe Checkout (test mode)

## Flow

1. **Pay with Stripe** (Overview → *Pending payments* / *Bills to pay*, or the Bills page) calls
   `POST /bills/{id}/checkout`. Allowed: the patient who owns the bill, or staff with `bills:write`
   (admin, receptionist, accountant). Others get `403`; other patients' bills return `404`.
2. The server locks the bill, refuses it unless it is `pending` with an amount above zero, and either
   reuses an open Checkout Session for the same amount or creates one. The amount and currency come
   from the database; an idempotency key prevents duplicate sessions on retries.
3. The browser goes to `checkout.stripe.com`. Stripe returns it to
   `/bills?payment=success&session_id=…` or `/bills?payment=cancelled&bill=…`.
4. **Nothing is marked paid by the return URL.** The bill becomes paid when either
   - Stripe calls `POST /payments/stripe/webhook` with a valid `Stripe-Signature`
     (`checkout.session.completed` or `…async_payment_succeeded` with `payment_status = paid`), or
   - the return page asks `GET /payments/stripe/sessions/{id}` and the server retrieves the session from
     Stripe with the secret key and it reports `complete` + `paid` (covers a late webhook).
5. On confirmation the server checks the paid amount and currency against the bill, then sets
   `payment_status = paid`, `paid_at`, `payment_method = "Card (Stripe)"`.

## Duplicate and failure handling

| Situation | Result |
|---|---|
| Same webhook delivered twice (Stripe retries) | Event ID stored in `stripe_events`; second delivery acknowledged as `duplicate_event`, not applied |
| Two different events for the same session | Second is `already_applied` |
| A second session paid for an already-paid bill | Recorded as `duplicate` for refund; bill unchanged |
| Amount/currency differs from the bill, or the bill was cancelled/changed | Recorded as `needs_review`; bill not marked paid |
| Delayed payment method (`payment_status = unpaid`) | Bill stays pending until `async_payment_succeeded`; `async_payment_failed` → attempt `failed` |
| Patient cancels on Stripe / session expires | Bill stays pending; `checkout.session.expired` marks the attempt `expired`; a new checkout can start |
| Staff change the amount or mark the bill paid/cancelled | Open sessions are expired at Stripe and locally |
| Bad or missing signature | `400`, nothing changes |
| Database | One `paid` attempt per bill (partial unique index); bills with payment history cannot be deleted |

Live keys are refused at startup (`STRIPE_SECRET_KEY` must start with `sk_test_` or `rk_test_`).

## Configure (test mode)

1. Stripe Dashboard → turn on **Test mode** → Developers → API keys → copy the **secret key**
   (`sk_test_…`). Never commit it.
2. In `backend/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...      # from step 3
   STRIPE_CURRENCY=usd                  # keep in step with VITE_CURRENCY
   PUBLIC_APP_URL=http://localhost:5173
   ```
3. Forward webhooks locally with the Stripe CLI (it prints the `whsec_…` signing secret):
   ```
   stripe login
   stripe listen --forward-to localhost:8000/payments/stripe/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
   ```
4. Run `python migrate_add_stripe_payments.py`, restart the API.

## Manual test with Stripe test cards

Use only test cards (any future expiry, any CVC, any postcode):

| Card | Expected |
|---|---|
| `4242 4242 4242 4242` | Paid; bill turns **Paid**, method "Card (Stripe)" |
| `4000 0000 0000 9995` | Declined on the Stripe page; bill stays pending |
| `4000 0025 0000 3155` | 3-D Secure challenge; approve → paid, fail → stays pending |
| Close the Stripe page / press back | "Payment cancelled"; bill stays pending |

Also check: pay the same bill from two tabs (second tab is sent to the same session); resend an event
with `stripe events resend <evt_id>` (logged as `duplicate_event`); stop `stripe listen`, pay, and
confirm the return page still settles via the server-side check.

## Tests

- `backend/tests/test_payments.py` (39): grouping, permissions, checkout creation and reuse, parallel
  clicks, success/failed/expired/cancelled, duplicate and concurrent webhooks, amount mismatch, bad
  signatures, late-webhook reconciliation, staff edits. Stripe's API is faked; signature verification is real.
- `e2e/run.mjs` with `E2E_FAKE_STRIPE=1`: the browser flow from Pay → Stripe redirect (intercepted) →
  cancel and success returns → signed webhook → Paid, plus staff "Pending payments" / "Fully paid".
