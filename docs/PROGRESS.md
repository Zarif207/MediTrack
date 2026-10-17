# Audit & overhaul — progress log

Resume from the last unchecked item. Each checked item was verified as noted.

## Stage A — Inspect
- [x] Repository, schema and dependency inventory
- [x] Baseline: 86 passed / 1 warning (run against isolated `meditrack_db_test`)
- [x] Frontend lint clean, build passes (chunk-size warning), npm audit: 4 high (transitive `@grpc/grpc-js`, not in browser bundle)

## Stage B/C — Secure and repair backend
- [x] Tests isolated from the dev database (`tests/conftest.py` refuses non-`_test` DBs)
- [x] Central permission matrix (`app/auth/permissions.py`), deny-by-default
- [x] Ownership helpers (`app/auth/ownership.py`); patients get 404 for others' rows
- [x] `/auth/register` derives UID/email from the verified token
- [x] Booking without a clinical record; no auto-created/email-matched patients
- [x] Scheduling policy, status transitions, advisory locks, partial unique index
- [x] Validation, PATCH null handling, error handlers, CORS from settings, SQL echo off
- [x] Migration `migrate_appointment_ownership.py` verified on a DB copy, then applied to dev (row counts unchanged)
- [x] New suite: 438 passed; mutation checks confirm ownership/permission tests fail when broken

## Stage D — Frontend integration
- [x] API client: token refresh, error normalisation, list pagination
- [x] Auth lifecycle (no fake roles, register with token)
- [x] Role-aware routes and sidebar from one permission map
- [x] Pages wired to correct endpoints; tolerant auxiliary lookups

## Stage E — Redesign
- [x] Design tokens and base components
- [x] App shell, dashboards, data pages, forms
- [x] Public site

## Stage F/G — Verify and report
- [x] Lint, build, backend suite, browser checks
- [x] Documentation and final report

Frontend verified: lint clean, build without warnings, headless Chrome at 390/768/1280 px
(no horizontal overflow). One crash found and fixed during browser testing (useAsync stale data).
Not verified here: real Firebase sign-in end-to-end.

## Follow-up pass (2026-10-17)
- [x] Doctor scoping (`user_profiles.doctor_id`, migration applied after copy verification)
- [x] Auth Emulator integration tests (6) and production guard for the emulator variable
- [x] Browser end-to-end suite `e2e/` (31 checks, 3 clean runs)
- [x] Sidebar "Back to home"; sign-out now lands on the home page
- [x] npm audit re-checked: no compatible fix; unchanged
- [x] Flagged dev rows inspected read-only; recommendations in AUDIT_REPORT.md
- [ ] Manual real-Firebase verification (owner)
