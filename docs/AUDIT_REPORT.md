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
| S14 | Doctor accounts were not tied to doctor records, so any doctor could read every medical record. | **Fixed (follow-up)** — admin-set `user_profiles.doctor_id`; doctors are scoped to their own appointments and the clinical data on them, for reads and writes; unlinked doctors see nothing. |
| S15 | No API rate limiting (sign-in throttling is handled by Firebase). | **Future** |
| A1 | `npm audit`: `@grpc/grpc-js` 1.9.16 (GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4), pinned `~1.9.0` by `@firebase/firestore`. | **Accepted** — re-checked in the follow-up: no compatible fix exists (1.9.16 is the last 1.9.x; firebase 11.10.0 is the latest 11.x and firebase 13.0.0 still pins `~1.9.0`; npm's suggestion is a breaking downgrade to firebase 9.14.0). The built bundle contains no grpc code and the app imports only `firebase/app` and `firebase/auth`. Upgrade when Firebase bumps the pin. |
| S16 | The Admin SDK skips signature and expiry checks when `FIREBASE_AUTH_EMULATOR_HOST` is set; a stray variable in production would accept forged tokens. | **Fixed (follow-up)** — production startup refuses it; development logs a warning; the frontend ignores its emulator variable in production builds. |
| S17 | "Sign out" from inside the app landed on the sign-in page instead of home (route guard raced the navigation). Found by the browser test. | **Fixed (follow-up)** |

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

Data left for manual review (not modified) — see the follow-up section below.

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


## Follow-up pass — 2026-10-17

| Item | Result |
|---|---|
| Doctor authorization | `migrate_add_doctor_link.py` (additive, idempotent) verified on a DB copy, then applied to `meditrack_db`; row counts unchanged. The one existing doctor-role account is unlinked and has no clinical access until an admin links it. 24 regression tests in `test_doctor_scope.py`; disabling doctor scoping makes 12 of them fail. |
| Real Firebase tokens | `tests/test_firebase_emulator.py`: 6 tests through the real `verify_id_token(check_revoked=True)` against the Firebase Auth Emulator — sign-up → register, wrong audience/malformed tokens, refreshed tokens, revoked sessions, disabled accounts, admin promotion and booking with real tokens. **Production Firebase was not tested**; see the manual procedure in `e2e/README.md`. |
| Browser end-to-end | `e2e/run.mjs`: 31 checks, real Chrome → app → API → emulator → `meditrack_db_test`; passed three consecutive runs. |
| Back to home | Sidebar footer link to `/` (shared by desktop sidebar and mobile drawer, so every role gets it). Browser test confirms it keeps the session and returning to the dashboard does not loop. |
| Dependencies | See A1. No packages changed. |

### Flagged development rows (read-only inspection, not modified)

- **Patient #176** — placeholder created by the old auto-create flow (DOB 1900-01-01, phone
  `0000000000`, gender "Unknown"). It is **in use**: linked to one patient-role account, with
  appointment #244 (booked online, scheduled 2026-10-20, doctor #12), one medical record, one
  prescription and one bill. Do not delete it. Recommended: confirm the person's identity, then have
  reception edit #176 with their real details (Patients → Edit).
- **Profile `PYTEST_REG_TEST`** — created by the old `test_register_open` test (role `user`, display
  name "Test", no patient link, no bookings, referenced by nothing). Safe to remove once you approve:
  `DELETE FROM user_profiles WHERE firebase_uid = 'PYTEST_REG_TEST';`

### Checks that need you

1. Link the existing doctor account to its doctor record (Users & roles) — until then it sees no clinical data.
2. Run the real-Firebase manual procedure in `e2e/README.md` with dedicated test accounts.
3. Decide on the two rows above.
4. Restart your running dev API (it was started before this pass) so it loads the new code.
