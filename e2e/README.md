# Browser end-to-end tests

`run.mjs` drives headless Chrome over the DevTools protocol through the real app:

```
Chrome → Vite app (Firebase Web SDK → Auth Emulator) → FastAPI (Admin SDK → Auth Emulator) → meditrack_db_test
```

Nothing here contacts production Firebase or the development database. `start_backend.py`,
`seed.py` and `set_role.py` refuse to run against any database whose name does not end in `_test`.
Ports default to 8001 (API) and 5174 (app), so they do not clash with normal dev servers on 8000/5173.

Requirements: Google Chrome, Node 22+, and the backend virtualenv. No packages are added to the project.

## Run

Four terminals, from the repository root:

```bash
# 1. Firebase Auth Emulator (local only; no Java needed for auth)
npx firebase-tools@15.34.0 emulators:start --only auth --project meditrack-7fe46

# 2. API on the test database, verifying emulator tokens
cd backend && E2E_FAKE_STRIPE=1 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 .venv/bin/python ../e2e/start_backend.py

# 3. App with the Web SDK pointed at the emulator
cd frontend && VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 VITE_API_BASE_URL=http://127.0.0.1:8001 npx vite --port 5174

# 4. Headless Chrome, then the test (it resets the test DB and emulator accounts itself)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/meditrack-e2e about:blank &
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node e2e/run.mjs
```

Set `E2E_SHOTS=/some/dir` to save screenshots.

## What it covers (91 checks)

Homepage, signed out and signed in: every link and CTA lands on the right route, all photos load with alt text, one h1, no overflow, mobile header and menu. Sign-up through the UI → *Awaiting access*; admin assigns the patient role; booking with no patient
file; the booking is listed and survives a reload; it is stored against the account UID; another
patient gets `404`; patient-only navigation; **Back to home** from the desktop sidebar and the mobile
drawer keeps the session and returning to the dashboard does not loop; sign-out lands on the home
page signed out; protected pages then redirect to sign-in; sign-in through the UI returns to the
requested page; an unlinked doctor sees no appointments or records and is told why; doctor navigation
has no admin or billing pages; a linked doctor sees their own appointment and loses it when re-linked
to another doctor record; no uncaught page errors.

Stripe modes for `start_backend.py`: **off by default** (a key in `backend/.env` is ignored),
`E2E_FAKE_STRIPE=1` for the fake below, or `E2E_REAL_STRIPE=1` to use your `sk_test_` key (then run
`stripe listen`; the signed-webhook checks in `run.mjs` only pass in fake mode). Run the suite in both
the default and fake modes: it checks the right Pay-button state for each, and that only patients can pay.

`E2E_FAKE_STRIPE=1` replaces Stripe's API calls with `fake_stripe.py` (no network, test key only).
Webhook signatures are still verified by the real code: `run.mjs` signs events with the fake's secret.
The payment checks cover Pay → redirect to `checkout.stripe.com` (intercepted, never loaded), cancel and
success returns, signed and forged webhooks, duplicates, and the staff "Pending payments" / "Fully paid"
groups. For a real Stripe test-mode run see *Stripe (test mode)* in the root README.

## Emulator limitations

In emulator mode the Admin SDK does **not** check token signatures or expiry (verified in
`firebase_admin/_token_gen.py`). Expiry handling is covered by `backend/tests/test_auth.py`; signature
checks are done by Google's verifier in production. For this reason the backend refuses to start with
`APP_ENV=production` while `FIREBASE_AUTH_EMULATOR_HOST` is set, and logs a warning otherwise. The
frontend ignores `VITE_FIREBASE_AUTH_EMULATOR_HOST` in production builds.

## Manual check against real Firebase

The emulator tests prove the code paths; this confirms the real project configuration. Use
**dedicated test accounts** only — never real patient accounts — and do not paste their passwords
into tickets, chat or commit messages.

1. In Firebase Console → Authentication → Users, add three test users with addresses you control
   (for example `meditrack.qa.patient+1@yourdomain`, `…admin+1@…`, `…doctor+1@…`). Store their passwords
   in your password manager.
2. Start the normal servers (`uvicorn app.main:app`, `npm run dev`) **without** any `*_EMULATOR_HOST`
   variable. Check the API log does not show the emulator warning.
3. Sign up / sign in as each account once so a profile exists. Make the admin with
   `python create_admin.py <uid>`; assign Patient and Doctor in **Users & roles**, and link the doctor
   account to a doctor record.
4. As the patient: book, reload, sign out, sign back in — the booking is still listed.
5. In the browser dev tools Network tab, confirm API calls carry `Authorization: Bearer …` and that a
   request with the header removed returns `401`.
6. Token refresh: leave the tab open for over an hour (ID tokens last 60 minutes), then navigate — the
   page should load without signing in again.
7. Revocation: revoke the test user's sessions (Admin SDK `revoke_refresh_tokens`, or disable then
   re-enable the user in the Console). The next API call returns `401` and the app returns to sign-in.
8. Afterwards delete the test users in the Console and set their profiles back to *Awaiting access* in
   **Users & roles** (the app has no profile-delete action).
