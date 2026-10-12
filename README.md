# MediTrack — Hospital Appointment and Patient Record Management System

A university DBMS semester project demonstrating a complete relational database design with a full-stack web application.

---

## Architecture Overview

```
┌────────────────────────────┐     ┌──────────────────────────────────┐     ┌────────────────┐
│  React + Vite Frontend     │────▶│  FastAPI Backend (Python)        │────▶│  PostgreSQL 18 │
│  Tailwind CSS v4           │     │  SQLAlchemy 2.x ORM              │     │                │
│  Firebase Auth (client SDK)│     │  Pydantic v2 validation          │     │  10 tables     │
│  React Router              │     │  Firebase Admin SDK (server-side)│     │  FK constraints│
│  Framer Motion             │     │  CORS middleware                 │     │  Check constr. │
└────────────────────────────┘     └──────────────────────────────────┘     └────────────────┘
         │                                      │
         │  VITE_FIREBASE_* (public config)     │  FIREBASE_SERVICE_ACCOUNT_PATH (secret)
         └──────── Firebase Auth ───────────────┘
```

### Nine Database Entities

| # | Entity | Table |
|---|--------|-------|
| 1 | Departments | `departments` |
| 2 | Doctors | `doctors` |
| 3 | Patients | `patients` |
| 4 | Appointments | `appointments` |
| 5 | Medical Records | `medical_records` |
| 6 | Prescriptions | `prescriptions` |
| 7 | Medicines | `medicines` |
| 8 | Prescription Items | `prescription_items` |
| 9 | Bills | `bills` |
| + | User Profiles (auth) | `user_profiles` |

---

## Prerequisites

- Python 3.12+ with a virtual environment
- Node.js 20+
- PostgreSQL 18 running locally
- A Firebase project (see Firebase Setup below)

---

## 1. Backend Setup

```bash
cd backend

# Activate virtual environment
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt
```

### Backend environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
# PostgreSQL connection string — keep this secret, never commit it
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/meditrack_db

# Path to Firebase Admin SDK service-account JSON (see Firebase Setup below)
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/meditrack-firebase-adminsdk.json

# Comma-separated allowed CORS origins
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Set to False in production to suppress SQL query logging
DB_ECHO=True
```

### Run database migration (first time only)

This creates the `user_profiles` table without touching any existing tables:

```bash
cd backend
python migrate_add_user_profiles.py
```

### Start the backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
# Runs at http://127.0.0.1:8000
# API docs: http://127.0.0.1:8000/docs
```

---

## 2. Frontend Setup

```bash
cd frontend
npm install
```

### Frontend environment variables

Copy `.env.example` to `.env` and fill in your Firebase web-app config:

```bash
cp .env.example .env
```

Edit `frontend/.env`:

```env
# Firebase web configuration — these are PUBLIC values, not secrets.
# Get them from Firebase Console → Project Settings → General → Your apps → Web app.
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

**Important:** `VITE_*` variables are exposed in browser code. Never put service-account keys or any private secret in a `VITE_*` variable.

### Start the frontend

```bash
cd frontend
npm run dev
# Runs at http://localhost:5173
# API calls proxy to http://127.0.0.1:8000 via Vite dev proxy
```

---

## 3. Firebase Setup

### 3a. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g., `meditrack-demo`)
3. Enable **Authentication** → **Sign-in method** → **Email/Password**

### 3b. Get the web app configuration (frontend)

1. Firebase Console → Project Settings → General → scroll to **Your apps**
2. Click **Add app** → Web → register the app
3. Copy the `firebaseConfig` object values into `frontend/.env`

### 3c. Get the Admin SDK service account (backend)

1. Firebase Console → Project Settings → **Service accounts**
2. Click **Generate new private key** → download the JSON file
3. **Do not commit this file** — add it to `.gitignore` or store it outside the repository
4. Set `FIREBASE_SERVICE_ACCOUNT_PATH` in `backend/.env` to the absolute path of this file

### 3d. Verify Firebase is working

With both servers running:

```bash
# Backend should show Firebase configured (not a 503)
curl http://localhost:8000/health
```

If `FIREBASE_SERVICE_ACCOUNT_PATH` is not set, the backend starts but auth endpoints return 503. All public GET endpoints (departments, doctors) still work.

---

## 4. Role Assignment and Initial Admin Setup

All new accounts start with the `patient` role. An admin must promote other accounts.

### Create the first admin (CLI)

After a user signs up via the frontend (Firebase creates the account), run this from the `backend/` directory:

```bash
cd backend
source .venv/bin/activate

# Get the user's Firebase UID from Firebase Console → Authentication → Users
python create_admin.py "FIREBASE_UID_HERE" "Admin Name" "admin@example.com"
```

This writes directly to PostgreSQL. No public admin-registration route exists.

### Promote users via the UI

Once you are signed in as admin:
- Navigate to **Admin → User Roles** in the staff dashboard sidebar
- Select the new role from the dropdown and click **Apply**

### Roles and their access

| Role | Access |
|------|--------|
| **admin** | Full access to all resources and user management |
| **receptionist** | Read/write patients, appointments, bills; read departments/doctors |
| **doctor** | Read/write medical records, prescriptions, Rx items; read patients, appointments, medicines, departments, doctors |
| **pharmacist** | Read/write medicines, Rx items; read prescriptions; read departments, doctors |
| **accountant** | Read/write bills; read departments, doctors |
| **patient** | Read own patients/appointments/bills; read departments/doctors |

---

## 5. Authentication Flow

```
Browser (React)              Firebase Auth           FastAPI Backend         PostgreSQL
──────────────               ─────────────           ───────────────         ──────────
signIn(email, pwd)  ──────▶  verify credentials
                    ◀──────  ID token (JWT, 1h exp)
                    
GET /auth/me        ──────────────────────────────▶  verify_firebase_token()
  Authorization:                                     → firebase_auth.verify_id_token()
  Bearer <token>                                     → look up UserProfile by uid
                    ◀──────────────────────────────  { role, display_name, email }

Any protected API   ──────────────────────────────▶  require_roles("admin","receptionist")
  Authorization:                                     → 401 if no token / expired
  Bearer <token>                                     → 403 if wrong role
                    ◀──────────────────────────────  200 + data  OR  401/403
```

- **Tokens are verified server-side** using Firebase Admin SDK on every request to a protected endpoint.
- **Roles are stored in PostgreSQL** (`user_profiles.role`). Users cannot modify their own role.
- **Public endpoints** (GET departments, GET doctors, POST /auth/register) do not require a token.
- **Token refresh** is handled automatically by the Firebase client SDK.

---

## 6. API Route Protection Summary

| Endpoint | GET | POST | PATCH | DELETE |
|----------|-----|------|-------|--------|
| `/departments/` | public | admin, receptionist | admin, receptionist | admin |
| `/doctors/` | public | admin | admin | admin |
| `/patients/` | admin, receptionist, doctor, patient | admin, receptionist | admin, receptionist | admin |
| `/appointments/` | admin, receptionist, doctor, patient | admin, receptionist | admin, receptionist | admin |
| `/medical-records/` | admin, doctor, receptionist | admin, doctor | admin, doctor | admin |
| `/medicines/` | admin, doctor, pharmacist | admin, pharmacist | admin, pharmacist | admin |
| `/prescriptions/` | admin, doctor, pharmacist | admin, doctor | admin, doctor | admin |
| `/prescription-items/` | admin, doctor, pharmacist | admin, doctor, pharmacist | admin, doctor, pharmacist | admin, doctor |
| `/bills/` | admin, receptionist, accountant, patient | admin, receptionist, accountant | admin, receptionist, accountant | admin |
| `/auth/register` | — | public | — | — |
| `/auth/me` | any authenticated | — | any authenticated | — |
| `/auth/users` | admin | — | — | — |
| `/auth/users/{uid}/role` | — | — | admin | — |

---

## 7. Development Commands

```bash
# Terminal 1 — Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
# http://127.0.0.1:8000  |  /docs for Swagger UI

# Terminal 2 — Frontend
cd frontend
npm run dev
# http://localhost:5173

# Lint
cd frontend && npm run lint

# Production build
cd frontend && npm run build
```

---

## 8. Database Notes

- The database is **never dropped or recreated** by any application code.
- `migrate_add_user_profiles.py` is the only migration script; it uses `checkfirst=True` and is idempotent.
- To back up the database before any structural change:
  ```bash
  pg_dump meditrack_db > meditrack_backup_$(date +%Y%m%d).sql
  ```
- All nine original tables are unmodified. `user_profiles` is an additive new table.

---

## 9. Security Notes

- Firebase service-account JSON **must not** be committed to Git. Add it to `.gitignore`.
- `VITE_FIREBASE_*` variables identify the project but are not secrets. They are equivalent to a public API key.
- Role enforcement happens **server-side** on every request. Frontend role checks (hiding buttons, navigation) are usability features only, not security boundaries.
- Tokens expire after 1 hour. The Firebase client SDK refreshes them automatically.
- `DB_ECHO=True` logs all SQL queries — set to `False` in production.

---

## 10. Tests Performed

| Test | Result |
|------|--------|
| Backend startup and imports | ✓ Pass |
| Frontend production build | ✓ Pass |
| Frontend ESLint | ✓ Pass (0 errors) |
| GET /health | ✓ Returns `{"status":"ok","database":"connected"}` |
| GET /departments/ (no auth) | ✓ Returns 200 with existing data |
| GET /doctors/ (no auth) | ✓ Returns 200 with existing data |
| GET /patients/ (no auth) | ✓ Returns 401 (correct) |
| GET /appointments/ (no auth) | ✓ Returns 401 (correct) |
| POST /departments/ (no auth) | ✓ Returns 401 (correct) |
| POST /auth/register (no auth) | ✓ Returns 201, creates profile |
| GET /auth/me (no auth) | ✓ Returns 401 (correct) |
| Invalid Bearer token | ✓ Returns 401 (Firebase SDK error) |
| user_profiles table migration | ✓ Table exists in PostgreSQL |
| Firebase token verification | Blocked — requires FIREBASE_SERVICE_ACCOUNT_PATH |
| Role-based 403 responses | Blocked — requires valid Firebase tokens |
| Full end-to-end with login | Blocked — requires Firebase project configuration |

---

## 11. Remaining Setup Steps (Required)

To make Firebase Authentication fully functional:

1. **Create a Firebase project** (see Section 3 above)
2. **Enable Email/Password sign-in** in Firebase Console → Authentication
3. **Download the Admin SDK service account JSON** and set `FIREBASE_SERVICE_ACCOUNT_PATH` in `backend/.env`
4. **Copy Firebase web config values** into `frontend/.env`
5. **Restart the backend** — Firebase initializes at startup
6. **Sign up** via the frontend (`/auth/sign-up`)
7. **Promote the first admin** using `python create_admin.py <uid>`
8. **Sign in** and verify the staff dashboard is accessible

---

## 12. Known Limitations

- Dashboard stat cards fetch up to 100 records and display the count. For databases with more than 100 records, the totals shown are not exact database counts (no server-side `COUNT(*)` endpoint exists).
- The `patient` role restriction is enforced at the API auth level (requiring a token) but per-patient row-level filtering (only seeing your own records) is not yet fully implemented at the service layer — all authenticated patient-role users can currently read any patient record by ID.
- Firebase is required for all staff dashboard features. Without it, the dashboard renders in demo mode (no auth, all endpoints return 503 for protected writes).

---

## Patient Self-Booking

Authenticated patients book appointments at `POST /appointments/book`:

```
POST /appointments/book
Authorization: Bearer <firebase-id-token>

{
  "doctor_id": 1,
  "appointment_date": "2026-12-01",
  "appointment_time": "14:00",
  "reason": "Annual checkup"
}
```

- `patient_id` is **never accepted from the request** — derived from the server-side `UserProfile`
- Requires a linked patient record (`patient_id` not null) — returns 403 with a clear message otherwise
- Validates doctor existence, date/time format, and prevents double-booking conflicts
- Staff use `POST /appointments/` (requires admin or receptionist role)

## Patient Onboarding Flow

1. Patient signs up → `role = patient`, `patient_id = null`
2. Patient sees onboarding dashboard (not a 403) with booking and browsing options
3. Staff creates a patient record at `/patients`  
4. Admin links it: **Admin → User Roles** → click the **Unlinked** badge → select patient → **Save Link**  
5. Patient refreshes → full health portal: appointments, medical records, prescriptions, bills  

## Profile Name Sync (fixed)

`get_current_user` now updates `display_name` and `email` from the Firebase token on every authenticated request. `POST /auth/register` also updates existing profiles if the name has changed. Previously, profiles created before a display name was set kept `null` permanently.

## New API Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/appointments/book` | Patient self-booking (patient role, linked only) |
| `POST` | `/auth/me/refresh` | Force-refresh profile from Firebase token |

## Tests

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/test_patient_ownership.py -v
# Expected: 50 passed
```
