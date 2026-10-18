# Security model

## Authentication

1. The browser signs in with the Firebase Web SDK and sends `Authorization: Bearer <ID token>` on
   every API request (`frontend/src/services/api.js`). The SDK refreshes expired tokens; on a `401`
   the client retries once with a forced refresh, then signs the user out.
2. `verify_firebase_token` (`backend/app/auth/dependencies.py`) calls
   `firebase_admin.auth.verify_id_token(token, check_revoked=True)`:
   missing, malformed, invalid, expired, revoked or disabled → `401` with a generic message.
   Certificate fetch failure or an uninitialised SDK → `503`. SDK error text is never returned.
3. `get_current_user` loads the `user_profiles` row for the token's UID, creating one with role
   `user` on first contact. Email is refreshed from the token; the display name is filled only while
   empty, so a name changed in the app is kept.
4. The UID, role and patient link are never taken from the request. `POST /auth/register` ignores any
   `firebase_uid`, `role`, `email` or `patient_id` in the body.

Firebase Admin initialises once per process. In `production`, a credential failure aborts startup; in
development it is logged and authenticated endpoints answer `503`.

Role changes take effect on the next request: the role is read from PostgreSQL every time, not from
token claims.

**Auth Emulator.** For local tests the Admin SDK can be pointed at the Firebase Auth Emulator with
`FIREBASE_AUTH_EMULATOR_HOST`. In that mode it accepts unsigned tokens and does not check expiry, so
the API refuses to start in `production` with the variable set and logs a warning otherwise. The
frontend's `VITE_FIREBASE_AUTH_EMULATOR_HOST` is ignored in production builds.

## Permission matrix

Defined once in `backend/app/auth/permissions.py`; routes declare the permission they need. The
frontend mirrors it for navigation only (`frontend/src/config/access.js`); the server enforces it.
Unknown roles and the default `user` role hold no permissions, and the database rejects unknown role
values (`ck_user_profiles_role`).

| Resource | admin | receptionist | doctor | pharmacist | accountant | patient |
|---|---|---|---|---|---|---|
| Users & roles | manage | – | – | – | – | – |
| Patients | read · write · delete | read · write | read | – | read | own file |
| Departments, doctors (directory) | public read · write · delete | public read | public read | public read | public read | public read |
| Doctor contact & licence details | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Appointments | read · write · delete | read · write | read (own†) | – | read | own · book · cancel own |
| Medical records | read · write · delete | – | read · write (own†) | – | – | own |
| Medicines | read · write · delete | – | read | read · write | – | – |
| Prescriptions | read · write · delete | – | read · write (own†) | read | – | own |
| Prescription items | read · write · delete | – | read · write · delete (own†) | read | – | own |
| Bills | read · write · delete | read · write | – | – | read · write | own |
| Pay a bill online (Stripe) | – | – | – | – | – | own pending bills only |

`user` (Awaiting access): own profile only.

† A doctor account is limited to the appointments of the doctor record an administrator linked it to
(`user_profiles.doctor_id`), and to the medical records, prescriptions and items on those
appointments — for reads and writes. An unlinked doctor account sees none of them. Patient
demographics (`patients:read`) and the medicine formulary are not doctor-scoped.

Changes from the previous matrix, and why:

- Receptionists no longer read medical records, and can no longer edit departments: neither is
  front-desk work, and the old router-level matrix already said so.
- Pharmacists no longer create or edit prescription items: prescribing is a doctor's decision.
  Prescription responses now include the patient's name, so pharmacists do not need the patient
  directory.
- Accountants can read patients: billing needs the patient's identity (their Bills page previously
  failed with `403`).
- Previously any non-patient, non-`user` role — including unknown roles — could read every medical
  record, prescription and bill. That is now denied by default.

## Doctor scope (`backend/app/auth/ownership.py`)

- `PATCH /auth/users/{uid}/link-doctor` (admin only) sets `user_profiles.doctor_id`; one doctor record
  links to at most one account; nothing is matched by email.
- Doctor queries use `appointments.doctor_id = user_profiles.doctor_id`; with no link the clause is
  `FALSE`, so lists are empty and detail requests return `404`.
- Creating or editing a medical record, prescription or prescription item requires the parent
  appointment to be in the doctor's scope (`404` otherwise). Query filters cannot widen the scope.
- Admins, pharmacists and other staff are not row-scoped.

## Patient data ownership (`backend/app/auth/ownership.py`)

A patient-role account owns an appointment when **either**

- it booked it (`appointments.firebase_uid` = the verified UID), **or**
- an administrator linked the account to the appointment's patient file
  (`appointments.patient_id` = `user_profiles.patient_id`).

Medical records, prescriptions, prescription items and bills are owned through their appointment.
All patient list queries are built from that single clause, so there is no fallback that returns
other patients' rows when the account has no patient file. Patients receive `404` (not `403`) for
records they do not own, so record IDs cannot be probed. Query-string filters such as `patient_id` are
ignored for patients.

Safeguards around linking:

- Nothing is linked automatically by name or email — the previous auto-link by email let anyone
  who signed up with a patient's address reach that patient's clinical record.
- One patient file can be linked to at most one account.
- An appointment booked by an account linked to patient A cannot be reassigned to patient B.
- The patient on an appointment cannot change once it has a medical record or bill.
- Medical records and bills require the appointment to have a patient file.

## Data integrity

- `ck_appointments_owner_present`: every appointment has a patient file or a booking account.
- `uq_appointments_doctor_active_slot` (partial unique index): one active appointment per doctor slot.
  Booking also takes transaction-scoped advisory locks per doctor and per booking account, so the
  "one appointment per patient per time / per doctor per day" checks are race-free.
- Status transitions: `scheduled ⇄ confirmed → completed | cancelled | no_show`; final states cannot be
  rescheduled.
- PATCH bodies reject explicit `null` for NOT NULL columns (`422`) instead of failing at commit.

## Errors and logging

All errors are `{"detail": ...}`. Database errors map to `409` (integrity), `422` (out-of-range
values), `503` (database unavailable) or a generic `500`; unexpected exceptions return a generic
`500`. Details go to the server log only. SQL echo is off by default because it logs parameters.

## Configuration

- CORS: explicit origins from `ALLOWED_ORIGINS`, credentials disabled (bearer tokens, no cookies),
  methods and headers limited to what the client uses. Production refuses `*` and localhost origins.
- Production hides `/docs`, `/redoc` and `/openapi.json`.
- `.gitignore` covers `.env*` (except `.env.example`), service-account JSON, keys, logs and build output.
  A history scan found no committed credentials.

## Reporting and rotation

If a service-account key or database password is ever exposed (committed, pasted, logged), treat it as
compromised even after removal: create a new key in Firebase Console → Service accounts, update
`FIREBASE_SERVICE_ACCOUNT_PATH`, then delete the old key; change the PostgreSQL role's password and
update `DATABASE_URL`.
