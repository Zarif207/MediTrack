# MediTrack — Hospital Appointment and Patient Record Management System

A university DBMS project: patients book appointments online and see their own visit records,
prescriptions and bills; staff manage the schedule, patient files, clinical records, the medicine
formulary and billing — each role seeing only what it needs.

> MediTrack is an academic demonstration, not a healthcare provider. Use synthetic data only.

| Document | Contents |
|---|---|
| [docs/SECURITY.md](docs/SECURITY.md) | Authentication flow, role/permission matrix, ownership rules, security notes |
| [docs/API.md](docs/API.md) | Endpoint inventory with roles, inputs and error conditions |
| [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md) | October 2026 audit: findings, fixes, test results, remaining risks |

## Architecture

```
React 19 + Vite 8 + Tailwind 4 ──/api──▶ FastAPI ──SQLAlchemy 2──▶ PostgreSQL 18
        │  Firebase Web SDK (sign-in)        │  Firebase Admin SDK (verifies every ID token)
```

- `backend/app/auth/` — token verification, the central permission matrix (`permissions.py`) and
  patient-ownership rules (`ownership.py`)
- `backend/app/routes/`, `services/`, `schemas/`, `models/` — one module per resource
- `backend/migrate_*.py` — idempotent, additive schema migrations (no Alembic)
- `frontend/src/services/api.js` — the single API client (token refresh, error normalisation)
- `frontend/src/config/` — role-aware navigation and route access rules
- `frontend/src/components/ui/` — the design-system components

**Entities:** departments, doctors, patients, appointments, medical records, prescriptions,
prescription items, medicines, bills, and user profiles (Firebase UID → role, optional patient file).

## Prerequisites

Python 3.13, Node.js 20+, PostgreSQL 18 (port 5432), and a Firebase project
(`meditrack-7fe46`) with Email/Password sign-in enabled.

## 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt        # runtime deps + pytest
cp .env.example .env                        # then fill in the values
```

### Environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development` (default), `test` or `production`. Production enforces strict settings and hides `/docs`. |
| `DATABASE_URL` | PostgreSQL URL, e.g. `postgresql+psycopg://USER:PASSWORD@localhost:5432/meditrack_db` |
| `TEST_DATABASE_URL` | Optional. Defaults to `DATABASE_URL` with `_test` appended to the database name. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Absolute path to the Admin SDK service-account JSON (keep it outside the repo). |
| `FIREBASE_PROJECT_ID` | Defaults to `meditrack-7fe46`. |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins. |
| `DB_ECHO` | SQL logging (includes parameters, i.e. patient data). Default `false`; must be false in production. |

### Database setup and migrations

New, empty database:

```bash
createdb meditrack_db
python create_tables.py                    # creates all tables from the models
```

Existing database (run each once, in order; each is idempotent and only adds):

```bash
python migrate_add_user_profiles.py
python migrate_add_patient_link.py
python migrate_appointments_firebase_uid.py
python migrate_appointment_ownership.py    # nullable appointments.patient_id + integrity guards
python migrate_add_doctor_link.py          # user_profiles.doctor_id (doctor accounts → doctor records)
```

`create_all()` never alters existing tables — editing a model does not change a live database.
`migrate_appointment_ownership.py` checks existing data first and stops without changes if a doctor
slot is double-booked or a profile has an unknown role. Its docstring lists the rollback statements.

### First administrator

Sign up in the app (the account starts as *Awaiting access*), copy its UID from Firebase Console →
Authentication → Users, then:

```bash
python create_admin.py <firebase_uid> "Display Name" admin@example.com
```

Further roles are assigned in the app under **Users & roles**. Doctor accounts must also be linked to
their doctor record there; until then they see no appointments or clinical records.

### Run

```bash
uvicorn app.main:app --reload              # http://127.0.0.1:8000, docs at /docs
```

## 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env                       # Firebase *web* config — public values, not secrets
npm run dev                                # http://localhost:5173, proxies /api → :8000
```

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_*` | Firebase web-app configuration (Console → Project settings → Your apps). |
| `VITE_API_BASE_URL` | Optional backend origin for production; defaults to `/api` (Vite proxy). |
| `VITE_CURRENCY` | Optional ISO currency code for amounts; defaults to `USD`. |

Never put service-account keys or database credentials in a `VITE_*` variable: Vite ships them to the browser.

## 3. Tests and checks

```bash
cd backend && python -m pytest -q          # 464 tests (+6 emulator tests skipped), meditrack_db_test only
cd frontend && npm run lint && npm run build
```

Real Firebase ID tokens, via the local Auth Emulator (no production contact):

```bash
npx firebase-tools@15.34.0 emulators:start --only auth --project meditrack-7fe46
cd backend && FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 python -m pytest tests/test_firebase_emulator.py
```

Browser end-to-end tests and a manual procedure for real Firebase: [e2e/README.md](e2e/README.md).

The test suite creates `meditrack_db_test` if needed and rebuilds its schema on every run. It refuses
to run against any database whose name does not end in `_test`, so development data is never touched.
Firebase token verification is replaced with a local fake; every other layer (dependencies,
permissions, SQL, constraints) runs for real.

## 4. How booking works

1. A visitor signs up → profile with role `user` (no access).
2. An administrator assigns the `patient` role.
3. The patient books: `POST /appointments/book`. The owner is the UID from the verified ID token;
   no patient file is required and none is created.
4. The booking appears in **My appointments** immediately and persists across sessions.
5. When staff identify the person, an administrator links the account to a patient file
   (**Users & roles → Patient file**), or reception attaches the file to the appointment. Only then can
   medical records and bills be added, and the patient sees them.

Online booking offers 30-minute slots 09:00–17:00, from now up to 180 days ahead. Staff can schedule
any time. See [docs/SECURITY.md](docs/SECURITY.md) for the full rules.

## 5. Known limitations

- No per-doctor working hours or leave; one clinic-wide booking window applies.
- No rate limiting on the API (the client handles `429` if a proxy adds it).
- Times use the server's local clock; there is no timezone handling.
- Patients cannot reschedule online; they cancel and book again.

See [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md) for the complete list.
