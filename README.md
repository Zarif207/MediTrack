# MediTrack — Hospital Appointment and Patient Record Management System

A university DBMS project. Patients book appointments online and see their own visit records,
prescriptions and bills, and pay pending bills through Stripe Checkout (test mode). Staff manage the
schedule, patient files, clinical records, the medicine formulary and billing, and each role sees only
what it needs.

> MediTrack is an academic demonstration, not a healthcare provider. Use synthetic data only.


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
├── backend/vercel.json, frontend/vercel.json   Vercel project configuration
└── render.yaml             alternative Render blueprint
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
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Alternative for hosts without secret files (Vercel): the JSON contents. Takes precedence. |
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

## Deployment (Vercel)

Two Vercel projects are connected to this one GitHub repository:

| Vercel project | Root Directory | Framework | What Vercel runs |
|---|---|---|---|
| `meditrack-web` | `frontend` | Vite | `npm run build` → static files from `dist/`, SPA rewrite in `frontend/vercel.json` |
| `meditrack-api` | `backend` | FastAPI (auto-detected) | `app/main.py` → one Python 3.13 Vercel Function (`backend/vercel.json`, `.python-version`) |

PostgreSQL comes from Neon (Vercel Marketplace, free plan). Auth stays on Firebase, and payments stay in
Stripe **test mode**.

How the backend behaves on Vercel:
- When `VERCEL=1` (set by Vercel), the API opens no local connection pool and disables server-side
  prepared statements. Use Neon's **pooled** connection string (host contains `-pooler`).
- Vercel has no secret files: paste the service-account JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Migrations do **not** run during builds. Run them yourself against each database, from `backend/`:
  `DATABASE_URL='<direct (non-pooled) Neon URL>' python -m migrations`.

**Environment variables.** Mark the secret ones *Sensitive*. Set them separately for Preview and
Production, and point each environment at its own database.

| Project | Variable | Value |
|---|---|---|
| api | `APP_ENV` | `production` (also for Preview, so the production checks apply) |
| api | `DATABASE_URL` | Neon pooled URL (`…-pooler…/neondb?sslmode=require`) |
| api | `FIREBASE_SERVICE_ACCOUNT_JSON` | full contents of the service-account JSON (Sensitive) |
| api | `FIREBASE_PROJECT_ID` | `meditrack-7fe46` |
| api | `ALLOWED_ORIGINS` | the frontend URL of the same environment, e.g. `https://meditrack-web.vercel.app` |
| api | `PUBLIC_APP_URL` | same frontend URL (Stripe returns the browser there) |
| api | `STRIPE_SECRET_KEY` | `sk_test_…` (Sensitive; live keys are refused) |
| api | `STRIPE_WEBHOOK_SECRET` | `whsec_…` of that environment's webhook endpoint (Sensitive) |
| api | `STRIPE_CURRENCY` | `usd` |
| web | `VITE_API_BASE_URL` | the API URL of the same environment, e.g. `https://meditrack-api.vercel.app` |
| web | `VITE_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_STORAGE_BUCKET`, `…_MESSAGING_SENDER_ID`, `…_APP_ID` | Firebase web config (public) |
| web | `VITE_CURRENCY` | `USD` |

`VITE_*` values are baked in at build time, so redeploy the frontend after changing them. Changes to API
variables also need a redeploy.

**Dashboard settings**
- **meditrack-api → Deployment Protection:** turn Vercel Authentication **off** for this project. The
  browser calls the API from another origin without Vercel's cookie, and Stripe webhooks can't log in;
  with protection on, both are blocked. The API has its own Firebase authentication and hides `/docs`
  in production.
- **Both projects → Git:** under Build and Deployment → Root Directory, enable *Skip deployments when
  there are no changes to the root directory*. Every push to `main` deploys **production**.
- **Firebase Console → Authentication → Settings → Authorized domains:** add the frontend domains.
- **Stripe (test mode) → Webhooks:** endpoint `https://<api>/payments/stripe/webhook` with the four
  `checkout.session.*` events listed above, one per environment.

After deploying, check `https://<api>/health` → `{"status":"ok","database":"connected"}`. Then sign up on
the site and promote the first admin from your machine:
`cd backend && DATABASE_URL='<neon url>' python create_admin.py <uid>`.

**Vercel limitations to know**
- Functions run in **UTC** (`TZ` cannot be set). Booking windows and timestamps use the server clock.
- Function bundle limit 500 MB (this API is ~280 MB of dependencies). Request body limit 4.5 MB.
  `maxDuration` is 30 s.
- Cold starts add latency to the first request after idle.
- Preview URLs change per deployment. Use stable aliases (`vercel alias`) or branch URLs in
  `ALLOWED_ORIGINS`, `PUBLIC_APP_URL` and `VITE_API_BASE_URL`.

**Backups.** Use Neon's point-in-time restore and check your plan's retention. For a manual copy, run
`pg_dump "$DATABASE_URL" > meditrack-YYYYMMDD.sql` and keep it outside the repository; dumps are
git-ignored because they contain patient data.

**Troubleshooting**

| Symptom | Likely cause |
|---|---|
| Function crashes at startup with a list of problems | A production check (CORS, Stripe URLs, emulator, Firebase credential); the log names it |
| Every API call returns `503 Authentication is temporarily unavailable` | `FIREBASE_SERVICE_ACCOUNT_JSON` missing or not valid JSON |
| Browser CORS errors, or API responses are a Vercel login page | `ALLOWED_ORIGINS` mismatch, or Deployment Protection still on for the API |
| Bills stay pending after paying | Webhook URL/secret mismatch; Stripe → Webhooks → delivery attempts |
| `/health` returns 503 | Wrong `DATABASE_URL`, or the database is suspended/unreachable |

`render.yaml` remains as an alternative single-dashboard setup on Render (long-running server instead of
functions).

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
- Timestamps use the server's local clock (no time-zone handling); on Vercel that is UTC.
- Stripe refunds are done in the Stripe Dashboard; MediTrack does not process refund webhooks.
- `npm audit` reports `@grpc/grpc-js` via Firebase's Firestore package. The app imports only
  `firebase/app` and `firebase/auth`, so it is not in the browser bundle. No compatible fix exists yet.
