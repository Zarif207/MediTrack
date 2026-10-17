# API endpoint inventory

57 operations (from the generated OpenAPI schema). All errors are `{"detail": ...}`.
"Patient (own)" means the endpoint is scoped to the caller's data via `app/auth/ownership.py`;
other patients' IDs return `404`. Permissions are listed in [SECURITY.md](SECURITY.md).

Common errors on every authenticated route: `401` (no/invalid/expired/revoked token),
`403` (role lacks the permission, or role is `user`), `503` (auth or database unavailable),
`422` (body, path or query validation; IDs must be 1 … 2⁶³−1; `limit` 1–100, `skip` 0–100000).
Every list accepts `skip`/`limit` and returns a JSON array; the frontend pages through with `limit=100`.

## Health & auth

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/health` | public | `503` if the database is unreachable |
| POST | `/auth/register` | any signed-in | Body `{display_name?}`. Creates the caller's profile (role `user`) → `201`, or returns it → `200`. UID/email from token. Response includes `permissions`. |
| GET | `/auth/me` | any signed-in | Profile + `permissions` |
| POST | `/auth/me/refresh` | any signed-in | Same as GET `/auth/me` |
| PATCH | `/auth/me` | any signed-in | Body `{display_name}` only |
| GET | `/auth/users` | `users:manage` | All profiles |
| PATCH | `/auth/users/{uid}/role` | `users:manage` | Body `{role}`; `404` unknown uid; `409` self-demotion or last admin; `patient → user` clears the link |
| PATCH | `/auth/users/{uid}/link-patient` | `users:manage` | Body `{patient_id \| null}`; `404` patient; `409` file linked to another account. Moves the account's own bookings without clinical data to the new link. |

## Directory (public reads)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/departments/`, `/departments/{id}` | public | |
| POST/PATCH | `/departments/`, `/departments/{id}` | `departments:write` | `409` duplicate name; PATCH `400` empty, `422` null name |
| DELETE | `/departments/{id}` | `departments:delete` | `409` if doctors assigned |
| GET | `/doctors/`, `/doctors/{id}` | public | Staff tokens get phone/email/licence; everyone else gets id, department, names, specialization. An invalid token is still `401`. |
| GET | `/doctors/{id}/availability?on=YYYY-MM-DD` | patient or `appointments:read` | `{slot_minutes, opens_at, closes_at, available[], unavailable[]}` — times only |
| POST/PATCH | `/doctors/`, `/doctors/{id}` | `doctors:write` | `404` department; `409` duplicate email/licence |
| DELETE | `/doctors/{id}` | `doctors:delete` | `409` if appointments exist |

## Patients

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/patients/` | `patients:read` · patient (own file, or `[]`) | |
| GET | `/patients/{id}` | `patients:read` · patient (own) | |
| POST | `/patients/` | `patients:write` | Validates email, phone pattern, DOB (past, ≥1900), blood group; `409` duplicate email |
| PATCH | `/patients/{id}` | `patients:write` | `422` null on required field |
| DELETE | `/patients/{id}` | `patients:delete` | `409` if appointments/bills exist; account links are cleared |

## Appointments

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/appointments/book` | patient | Body `{doctor_id, appointment_date, appointment_time, reason?}`. Owner = token UID; `patient_id` = linked file or null. `422` outside the slot policy / past / >180 days; `404` doctor; `409` slot taken, own clash at that time, or same doctor same day. |
| POST | `/appointments/{id}/cancel` | patient (own) | `409` if not active or already started |
| POST | `/appointments/` | `appointments:write` | Requires a patient file; `404` patient/doctor; `409` slot taken |
| GET | `/appointments/` | `appointments:read` · patient (own) | Filters `patient_id` (ignored for patients), `doctor_id`, `appointment_status`. Response adds `patient_name`, `booked_by_name`, `booked_by_email`. |
| GET | `/appointments/{id}` | `appointments:read` · patient (own) | |
| PATCH | `/appointments/{id}` | `appointments:write` | Transition rules; final states cannot be rescheduled; patient change blocked with record/bill or if booked by an account linked elsewhere; `409` slot taken |
| DELETE | `/appointments/{id}` | `appointments:delete` | `409` with medical record or bill |

## Clinical

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/medical-records/`, `/{id}` | `medical_records:read` · patient (own) | Filter `appointment_id`. Response adds `patient_id`, `patient_name`. |
| POST | `/medical-records/` | `medical_records:write` | `404` appointment; `409` existing record, no patient file, or cancelled/no-show; text ≤5000 |
| PATCH | `/medical-records/{id}` | `medical_records:write` | |
| DELETE | `/medical-records/{id}` | `medical_records:delete` | `409` with prescriptions |
| GET | `/prescriptions/`, `/{id}` | `prescriptions:read` · patient (own) | Filter `record_id`. Adds `patient_id`, `patient_name`. |
| POST/PATCH | `/prescriptions/`, `/{id}` | `prescriptions:write` | `404` record; instructions ≤2000 |
| DELETE | `/prescriptions/{id}` | `prescriptions:delete` | `409` with items |
| GET | `/prescription-items/`, `/{id}` | `prescription_items:read` · patient (own) | Filter `prescription_id`. Adds `medicine_name`, `medicine_strength`, `medicine_form`. |
| POST | `/prescription-items/` | `prescription_items:write` | `404` prescription/medicine; `409` medicine already on prescription; quantity 1–10000 |
| PATCH | `/prescription-items/{id}` | `prescription_items:write` | |
| DELETE | `/prescription-items/{id}` | `prescription_items:delete` | |
| GET | `/medicines/`, `/{id}` | `medicines:read` | |
| POST/PATCH | `/medicines/`, `/{id}` | `medicines:write` | price ≥0 (2 dp), stock 0–1,000,000 |
| DELETE | `/medicines/{id}` | `medicines:delete` | `409` if on a prescription |

## Billing

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/bills/` | `bills:read` · patient (own) | Filters `patient_id` (ignored for patients), `appointment_id`, `payment_status` |
| GET | `/bills/{id}` | `bills:read` · patient (own) | |
| POST | `/bills/` | `bills:write` | `404` patient/appointment; `400` appointment belongs to another patient; `409` existing bill, no patient file, cancelled/no-show |
| PATCH | `/bills/{id}` | `bills:write` | `paid` sets `paid_at`; `pending`/`cancelled` clears it |
| DELETE | `/bills/{id}` | `bills:delete` | |

## Tests

Each row is covered in `backend/tests/`: `test_permission_matrix.py` (every role × every
list/create/update/delete route), `test_auth.py`, `test_roles.py`, `test_booking.py` (including a
concurrent-booking race), `test_ownership.py`, `test_crud.py`, `test_errors.py`.
