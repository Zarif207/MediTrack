# MediTrack — Hospital Appointment and Patient Record Management System

A university DBMS project. Patients book appointments online and see their own visit records,
prescriptions and bills, and pay pending bills through Stripe Checkout (test mode). Staff manage the
schedule, patient files, clinical records, the medicine formulary and billing, and each role sees only
what it needs.

> MediTrack is an academic demonstration, not a healthcare provider. Use synthetic data only.

[![CI](https://github.com/Zarif207/MediTrack/actions/workflows/ci.yml/badge.svg)](https://github.com/Zarif207/MediTrack/actions/workflows/ci.yml)

## Architecture

```
React 19 + Vite 8 + Tailwind 4 ──HTTPS──▶ FastAPI ──SQLAlchemy 2──▶ PostgreSQL
   │ Firebase Web SDK (sign-in)            │ Firebase Admin SDK (verifies every ID token)
   └──── redirect to Stripe Checkout ──────┤ Stripe API + signed webhooks (test mode)
```

```
MediTrack/
├── backend/                FastAPI application
│   ├── app/auth/           token verification, permission matrix, row-level ownership
│   ├── app/routes|services|schemas|models/   one module per resource
│   ├── migrations/         idempotent, additive schema migrations (python -m migrations)
│   ├── tests/              pytest suite (isolated *_test database)
│   └── create_admin.py     promotes the first administrator
├── frontend/               React single-page app
│   └── src/services/api.js the only API client; src/config/ role-aware routes and navigation
├── e2e/                    headless-Chrome end-to-end tests (Firebase Auth Emulator)
├── .github/workflows/ci.yml
└── render.yaml             optional deployment blueprint (see Deployment)
```

## Prerequisites

Python 3.13, Node.js 22+, PostgreSQL 16+ (18 used in development), a Firebase project with
Email/Password sign-in enabled, and optionally a Stripe account in **test mode**.

## Local setup

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # then fill in the values (see below)
createdb meditrack_db
python -m migrations          # creates/updates the schema; safe to re-run
uvicorn app.main:app --reload # http://127.0.0.1:8000, interactive docs at /docs
```

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development` (default), `test` or `production`. Production enforces the checks listed under Deployment and hides `/docs`. |
| `DATABASE_URL` | `postgresql+psycopg://USER:PASSWORD@HOST:5432/meditrack_db` (`postgres://` URLs from hosts are accepted). |
| `TEST_DATABASE_URL` | Optional. Defaults to `DATABASE_URL` with `_test` appended to the database name. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Absolute path to the Admin SDK service-account JSON, stored **outside** the repository. |
| `FIREBASE_PROJECT_ID` | Defaults to `meditrack-7fe46`. |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (the frontend URL). |
| `STRIPE_SECRET_KEY` | Optional; enables online payment. Must be `sk_test_…`/`rk_test_…`: live keys are refused. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` signing secret for the webhook endpoint. |
| `STRIPE_CURRENCY` | ISO code, default `usd`. Keep in step with `VITE_CURRENCY`. |
| `PUBLIC_APP_URL` | Frontend origin that Stripe returns the browser to. |
| `DB_ECHO` | SQL logging including parameters (patient data). Default `false`; refused in production. |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # Firebase *web* config: public identifiers, not secrets
npm run dev            # http://localhost:5173, proxies /api → 127.0.0.1:8000
```

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_*` | Firebase Console → Project settings → Your apps → Web app. |
| `VITE_API_BASE_URL` | Backend origin in production; defaults to `/api` (the dev proxy). |
| `VITE_CURRENCY` | Display currency, default `USD`. |

Never put service-account keys, database URLs or Stripe secrets in a `VITE_*` variable: Vite ships
them to every browser.

### First administrator

Sign up in the app (the new account shows *Awaiting access*), copy its UID from Firebase Console →
Authentication → Users, then from `backend/`:

```bash
python create_admin.py <firebase_uid> "Display Name" admin@example.com
```

Assign every other role in the app under **Users & roles**. Doctor accounts must also be linked to
their doctor record there; until then they see no appointments or clinical data.

## Database and migrations

`python -m migrations` (from `backend/`) is the single schema command for every environment:

1. it creates any missing table from the SQLAlchemy models, without altering existing tables or rows;
2. it then applies the additive column and constraint migrations in `backend/migrations/` for databases
   created before those columns existed.

Each step is idempotent, so the command is safe on an empty, old or current database.
`appointment_ownership` checks existing data first (double-booked slots, unknown roles) and stops
without changing anything if it finds rows to fix by hand. Each migration's docstring lists its manual
rollback. Editing a model does **not** change an existing database; add a migration step for that.

Integrity is enforced in PostgreSQL, not only in code: CHECK constraints on statuses, roles, amounts and
`paid_at`; one active appointment per doctor slot (partial unique index); every appointment has an owner;
at most one paid Stripe attempt per bill; bills with payment history cannot be deleted.

## Roles and permissions

The server enforces everything (`backend/app/auth/permissions.py`, `ownership.py`). The frontend mirrors it
only to decide what to show (`frontend/src/config/access.js`). Unknown roles and the default `user` role
have no permissions.

| Resource | admin | receptionist | doctor | pharmacist | accountant | patient |
|---|---|---|---|---|---|---|
| Users & roles | manage | – | – | – | – | – |
| Patients | read · write · delete | read · write | read | – | read | own file |
| Departments, doctors | write · delete | public read | public read | public read | public read | public read |
| Appointments | read · write · delete | read · write | read (own†) | – | read | own · book · cancel |
| Medical records | read · write · delete | – | read · write (own†) | – | – | own |
| Medicines | read · write · delete | – | read | read · write | – | – |
| Prescriptions, items | read · write · delete | – | read · write (own†) | read | – | own |
| Bills | read · write · delete | read · write | – | – | read · write | own |
| **Pay a bill online** | – | – | – | – | – | **own pending bills only** |

† Only appointments of the doctor record an admin linked to the account, and clinical data on them.

- Identity comes only from the verified Firebase ID token (`verify_id_token(check_revoked=True)`); the role
  and patient/doctor links come from PostgreSQL on every request. Nothing in a request body can set them.
- Patients get `404` (not `403`) for other people's records, so IDs cannot be probed.
- Accounts are never linked to patient files automatically (for example by email). Only an admin links them.
- Errors are always `{"detail": …}`; database and internal errors are logged server-side without SQL
  parameters and never echoed to the client.

## Online payment (Stripe Checkout, test mode)

1. A patient presses **Pay with Stripe** on their Overview or Bills page →
   `POST /bills/{id}/checkout`. **Only patient accounts may call it, and only for their own pending bills.**
   Every staff role gets `403` before the bill is even looked up, including on direct API requests.
   Another patient's bill returns `404`.
2. The server locks the bill, requires `pending` with an amount above zero, and reuses an open session
   or creates one. The amount and currency always come from the database. An idempotency key stops
   duplicate sessions on retries and double clicks.
3. Returning to `/bills?payment=success` proves nothing. A bill becomes **paid only** when Stripe sends a
   webhook to `POST /payments/stripe/webhook` with a valid `Stripe-Signature`, or when the server itself
   retrieves the session from Stripe and it reports `complete` + `paid`. Either way, the paid amount and
   currency must match the bill.

| Situation | Result |
|---|---|
| Same webhook event delivered again, or concurrently | Event ID stored once in `stripe_events`; repeat → `duplicate_event` |
| Second session paid for an already-paid bill | Attempt recorded as `duplicate` (refund it); bill unchanged |
| Amount/currency mismatch, or bill changed/cancelled after checkout began | `needs_review`; bill not marked paid |
| Bad, missing or stale signature | `400`, nothing changes |
| Live-mode event | Ignored (`ignored_livemode`) |
| Staff change a bill's amount or status | Open sessions are expired at Stripe and locally |
| Staff try to edit a bill Stripe has settled | `409`. After refunding in Stripe, it can only be marked *cancelled* |

Staff still view bills, see *Pending payments* / *Fully paid*, and record cash or card payments at the desk
by editing a bill.

**Local test-mode setup**

1. Stripe Dashboard → **Test mode** → Developers → API keys → copy the secret key (`sk_test_…`) into
   `backend/.env` as `STRIPE_SECRET_KEY`.
2. Forward webhooks with the Stripe CLI and put the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`:
   ```bash
   stripe listen --forward-to localhost:8000/payments/stripe/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
   ```
3. Restart the API and pay as a patient with test cards (any future expiry and CVC):
   `4242 4242 4242 4242` succeeds, `4000 0000 0000 9995` is declined, and `4000 0025 0000 3155` asks for 3-D Secure.

## Tests

```bash
cd backend && python -m pytest -q     # unit + API tests against meditrack_db_test
cd backend && ruff check . ../e2e --config ruff.toml   # lint
cd frontend && npm run lint && npm run build
```

- The suite creates `meditrack_db_test` if needed and rebuilds its schema every run. It **refuses** any
  database whose name does not end in `_test`, so development data is never touched.
- Firebase token verification is replaced by a local fake and Stripe's API by a fake client. Webhook
  signature checks, permissions, SQL, locks and constraints all run for real. Coverage includes every role
  against every route, ownership/IDOR, concurrent booking and payment races, and the migration runner.
- `tests/test_firebase_emulator.py` uses real ID tokens from the Firebase Auth Emulator. It is skipped
  unless `FIREBASE_AUTH_EMULATOR_HOST` is set:
  ```bash
  npx firebase-tools@15.34.0 emulators:start --only auth --project meditrack-7fe46
  cd backend && FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 python -m pytest tests/test_firebase_emulator.py
  ```
- Browser end-to-end tests: see [e2e/README.md](e2e/README.md).

GitHub Actions (`.github/workflows/ci.yml`) runs backend lint and tests against a throwaway PostgreSQL
container, the migration runner on an empty database, and frontend lint and build. It needs no secrets.

## Deployment

Recommended free setup for a student project:

| Part | Host | Notes |
|---|---|---|
| Frontend | Render static site | HTTPS and custom domains included |
| API | Render web service (free) | Sleeps when idle; the first request after a pause takes ~1 minute |
| PostgreSQL | Neon (free) or any managed PostgreSQL | Connection string with `sslmode=require` |
| Auth | Firebase Authentication | Existing project |
| Payments | Stripe **test mode** | No real money moves |

`render.yaml` describes both Render services. **Applying it creates resources in your account**, so
review it first. Production steps, in order:

1. **Database.** Create a Neon project and copy its connection string.
2. **Blueprint.** Render Dashboard → New → Blueprint → this repository. Fill in each prompted value:
   `DATABASE_URL`, `ALLOWED_ORIGINS` and `PUBLIC_APP_URL` (both the frontend URL, `https://…onrender.com`),
   `VITE_API_BASE_URL` (the API URL) and the `VITE_FIREBASE_*` web config.
3. **Firebase credentials.** Firebase Console → Project settings → Service accounts → Generate new private
   key. In Render → meditrack-api → Environment → **Secret Files**, add it as
   `firebase-service-account.json`. Never commit it.
4. **Firebase domains.** Firebase Console → Authentication → Settings → Authorized domains → add the
   frontend domain (needed for Firebase auth flows such as password-reset links on that domain).
5. **Stripe (optional).** In test mode, add a webhook endpoint `https://<api>/payments/stripe/webhook`
   with the four `checkout.session.*` events above. Set `STRIPE_SECRET_KEY` (`sk_test_…`) and that
   endpoint's `STRIPE_WEBHOOK_SECRET` on the API. Leave both unset to disable online payment.
6. **Deploy, then check** `https://<api>/health` → `{"status":"ok","database":"connected"}`. Sign up
   on the live site, then create the first admin from your machine against the hosted database:
   `cd backend && DATABASE_URL='<neon url>' python create_admin.py <uid>`.

The API's start command runs `python -m migrations` before `uvicorn`. With `APP_ENV=production` the API
**refuses to start** if `ALLOWED_ORIGINS` is `*` or localhost, `DB_ECHO` is on,
`FIREBASE_AUTH_EMULATOR_HOST` is set, Firebase credentials fail to load, a live Stripe key is used, or
Stripe is enabled without a webhook secret and an `https://` `PUBLIC_APP_URL`. It also hides `/docs`.

**Backups.** Use your database host's point-in-time restore and check its retention period. For a manual
copy, run `pg_dump "$DATABASE_URL" > meditrack-YYYYMMDD.sql` and keep it outside the repository; dumps are
git-ignored because they contain patient data.

**Troubleshooting**

| Symptom | Likely cause |
|---|---|
| API fails at startup with a list of problems | One of the production checks above; the message names it |
| Every API call returns `503 Authentication is temporarily unavailable` | Secret file missing or wrong `FIREBASE_SERVICE_ACCOUNT_PATH` |
| Browser shows CORS errors | `ALLOWED_ORIGINS` doesn't exactly match the frontend origin (scheme, host, no trailing slash) |
| Firebase reports `auth/unauthorized-domain` | Step 4 |
| Deep links such as `/bills` return 404 | Static site is missing the rewrite to `/index.html` |
| Bills stay pending after paying | Webhook URL/secret mismatch; check Stripe → Webhooks → delivery attempts |
| `/health` returns 503 | Database URL wrong, or the database is asleep/unreachable |

## Secrets and credential rotation

Real `.env` files, service-account JSON, keys, database dumps and logs are git-ignored. Only
`.env.example` templates with placeholders are committed. If a secret is ever exposed (committed,
pasted, logged), treat it as compromised even after deleting it, and rotate it:

- **Firebase service account:** Console → Service accounts → generate a new key, update the secret
  file/path, then delete the old key under Google Cloud → IAM → Service accounts → Keys.
- **Stripe:** Developers → API keys → roll the secret key. Webhooks → roll the signing secret.
- **PostgreSQL:** `ALTER ROLE … PASSWORD …` (or reset in the host's dashboard) and update `DATABASE_URL`.

Removing a file from Git does not remove it from history. Rotation is the fix.

## Known limitations

- No per-doctor working hours; one clinic-wide booking window (30-minute slots, 09:00–17:00, up to 180 days ahead).
- No API rate limiting (Firebase throttles sign-in).
- Timestamps use the server's local clock (no time-zone handling). Set the host's `TZ` if needed.
- Stripe refunds are done in the Stripe Dashboard; MediTrack does not process refund webhooks.
- `npm audit` reports `@grpc/grpc-js` via Firebase's Firestore package. The app imports only
  `firebase/app` and `firebase/auth`, so it is not in the browser bundle. No compatible fix exists yet.
