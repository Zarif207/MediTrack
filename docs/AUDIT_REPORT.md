# MediTrack audit and overhaul — October 2026

Status labels: **Fixed** (confirmed and fixed, with a regression test unless noted) ·
**Open** (confirmed, not fixed) · **Accepted** (confirmed, judged not exploitable here) ·
**Future** (recommended improvement).

## Baseline

| Check | Before | After |
|---|---|---|
| Backend tests | 86 passed, 1 warning — but the suite ran pattern-based `DELETE`s against the real dev database | 439 passed, 1 warning, against an isolated `meditrack_db_test` |
| Frontend lint | clean | clean |
| Frontend build | passes; 728 kB single chunk warning | passes; no warnings (routes code-split, 366 kB entry) |
| `npm audit --omit=dev` | 4 high (`@grpc/grpc-js` via Firestore) | unchanged — see A1 |

The remaining warning is Starlette's notice that its test client will move from `httpx` to `httpx2`.

Mutation check: injecting an ownership bypass makes 5 tests fail; granting accountants admin
permissions makes 31 fail.

## Security findings

| # | Finding | Status |
|---|---|---|
| S1 | `POST /auth/register` needed no token and took `firebase_uid` from the body: anyone could create profiles for arbitrary UIDs and overwrite any user's (including admins') email and name. | **Fixed** — UID/email come from the verified token; body identity fields are ignored. |
| S2 | Booking auto-linked an account to any patient record with the same email. Firebase does not verify email on sign-up, so a sign-up using a patient's address exposed that patient's clinical record. | **Fixed** — no automatic linking; only admins link, and one file links to at most one account. |
| S3 | Booking without a patient file created placeholder patient records (DOB 1900-01-01, phone 0000000000). | **Fixed** — bookings belong to the UID; no records are created. One placeholder record already in the dev DB is left in place for review (not deleted). |
| S4 | Clinical list and detail endpoints checked only "not patient / not user": accountants read every medical record and prescription, pharmacists every bill, receptionists every prescription; unknown role strings saw everything. | **Fixed** — central permission matrix, deny by default, DB CHECK on roles. |
| S5 | Token-verification errors returned SDK exception text; the 503 message named the env var. | **Fixed** |
| S6 | Public doctor directory exposed phone numbers and licence numbers to anonymous visitors. | **Fixed** — contact details only for staff tokens. |
| S7 | `link-patient` reassigned bookings that already belonged to another patient, and (NULL comparison) never attached pending unlinked bookings. | **Fixed** |
| S8 | Patients got `403` for others' records, confirming that the IDs exist. | **Fixed** — `404`. |
| S9 | `DB_ECHO` defaulted to on, logging SQL parameters (patient data). | **Fixed** — default off; production rejects it. |
| S10 | `ALLOWED_ORIGINS` in `.env` was ignored (read with `os.getenv`, not settings); CORS allowed credentials and every method/header. | **Fixed** |
| S11 | The frontend invented a `patient` role when the backend was unreachable. | **Fixed** — shows a recovery screen instead. |
| S12 | An admin could demote themselves and lock everyone out. | **Fixed** |
| S13 | `.env.*` in `.gitignore` also ignored `.env.example`; no patterns for service-account JSON or keys. | **Fixed**. History scan: no `.env`, JSON credentials or private keys were ever committed. |
| S14 | Doctor accounts are not tied to doctor records, so any doctor can read every medical record. | **Open** — needs a `user_profiles.doctor_id` link and scoping; documented. |
| S15 | No API rate limiting (sign-in throttling is handled by Firebase). | **Future** |
| A1 | `npm audit`: `@grpc/grpc-js` 1.9.16 (GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4), pinned `~1.9.0` by `@firebase/firestore`. | **Accepted** — grpc-js only runs in Node, and the app never imports Firestore, so it is not in the browser bundle. Upgrade `firebase` when a release bumps the pin. |

## Backend fixes

- Appointment booking without a clinical record (UID ownership), patient cancellation, availability
  endpoint, slot policy (30 min, 09:00–17:00, ≤180 days), status-transition rules, double-booking
  guards (partial unique index + advisory locks), patient-reassignment safeguards.
- Medical records and bills require an appointment with a patient file that is not cancelled or
  no-show.
- Validation: email, phone pattern, date of birth range, blood group, text length limits, price/stock/
  quantity bounds, BIGINT-range IDs, pagination bounds, `null` on required PATCH fields → `422`,
  empty PATCH → `400`.
- Consistent error handlers (409/422/503/500, no internals); `get_db` rolls back on error.
- Responses gained derived fields so each role gets what it needs without extra permissions:
  appointment `patient_name`/`booked_by_*`; record and prescription `patient_id`/`patient_name`;
  prescription item medicine name/strength/form.

## Frontend / integration fixes

- One API client: token refresh-and-retry, normalised `ApiError` (network, 401–503, per-field 422),
  `listAll` paging so tables are never silently cut off at 100 rows.
- Broken flows repaired: the public `/appointments/book` called staff-only APIs; the accountant's Bills
  page and pharmacist's Prescriptions/Items pages crashed on `403` lookups; booking sent raw strings
  and parsed errors separately.
- Route guards wait for the server profile (no flicker or guessed roles), keep the requested URL
  through sign-in, and render "not available" inside the layout.
- Navigation is generated from the same permissions the server returns; patients see only their pages.
- Bug found in browser testing: a page rendered once with stale `null` data when its inputs changed,
  which crashed the slot picker — fixed in `useAsync`. Non-API exceptions are no longer shown to users
  verbatim.
- Date-only values were parsed as UTC and could show the previous day — fixed.

## UI/UX

A new design system (`frontend/src/index.css` tokens, `components/ui/`): warm neutral "ink" palette
with a single pine brand colour, IBM Plex Sans with tabular numerals, Source Serif 4 for public
headings, a 4/6/8 px radius scale, and shadows only on floating layers. Shared components: Button,
IconButton, Field/Input/Select/Textarea, PageHeader, Panel, DataTable (cards below `md`, client-side
paging), StatusBadge, Empty/Loading/Error states, Alert, Modal (focus trap, Escape, focus restore),
FormModal, ConfirmDialog, toasts. All pages rebuilt on it; page-entry animations removed.

The public site shows only API data and accurate copy (no statistics, reviews, addresses or claims);
it states that MediTrack is an academic project.

## Database changes

`backend/migrate_appointment_ownership.py` (additive, idempotent, single transaction, pre-flight
checks): `appointments.patient_id` nullable, `ck_appointments_owner_present`,
`ix_appointments_firebase_uid`, `uq_appointments_doctor_active_slot`, `ck_user_profiles_role`.

Verified on a throwaway copy of the dev database (two runs; all row counts and an appointment
checksum unchanged; constraints reject duplicates, ownerless rows and unknown roles), then applied to
`meditrack_db` on 2026-10-17 with row counts unchanged. Rollback statements are in the script's docstring;
reverting `NOT NULL` is impossible once unlinked bookings exist.

Data left for manual review (not modified): one placeholder patient created by the old auto-create
flow, and one profile whose UID matches the old test-fixture prefixes.

## Verification performed

- Backend: 439 tests (authentication failures, every role against every resource, ownership/IDOR,
  booking policy, concurrent booking, CRUD, constraints, rollback, error masking, CORS, production
  settings).
- Live smoke test of uvicorn against the dev DB (health, public directory, auth rejection).
- Browser: headless Chrome via the DevTools protocol at 390, 768 and 1280 px. Public pages against
  the real API; authenticated pages through a temporary harness with a mocked auth context and
  synthetic data (removed afterwards). No horizontal overflow on any page tested. The booking flow
  (doctor → date → slot → submit, including a 409 conflict) and form validation were exercised.

**Not tested (environment):** real Firebase sign-in/sign-up/password reset end-to-end (no test
credentials available to the agent); screen-reader output; Safari/Firefox.

## Manual verification checklist

1. Sign up a new account → dashboard says *Awaiting access*; `/patient/book-appointment` is unavailable.
2. As admin, assign *Patient* → the account sees *My care* navigation.
3. Book an appointment → it appears in My appointments; sign out and back in → still there.
4. As a second patient, open the first patient's `/appointments/{id}` via the API → `404`.
5. As receptionist, the booking shows *No patient file*; attach a file, then a doctor adds a record →
   the patient sees it under Visit records.
6. As accountant, open Bills and issue a bill; as pharmacist, Bills is unavailable.
7. Try to demote the only admin → refused.
8. Resize to phone width: navigation drawer, tables as cards, dialogs full-width.

## Future improvements

Link doctor accounts to doctor records and scope clinical access; per-doctor schedules; rate limiting;
Alembic migrations; audit log of clinical reads/writes; timezone-aware timestamps; server-side search
and pagination totals; Playwright end-to-end tests with a Firebase Auth emulator.
