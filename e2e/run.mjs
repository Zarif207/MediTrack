// Browser end-to-end test: Chrome (DevTools protocol) → Vite app (Web SDK on the
// Auth Emulator) → FastAPI (Admin SDK on the Auth Emulator) → meditrack_db_test.
// See e2e/README.md. No production services are contacted.
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const APP = process.env.E2E_APP_URL ?? 'http://localhost:5174'
const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:8001'
const EMU = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'
const CDP = process.env.CDP_URL ?? 'http://127.0.0.1:9333'
const SHOTS = process.env.E2E_SHOTS
const PY = join(here, '..', 'backend', '.venv', 'bin', 'python')

let failures = 0
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Emulator + API helpers (for accounts the test does not create in the UI) ──
async function emuSignUp(email, password) {
  const r = await fetch(`http://${EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=e2e`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  return r.json()
}
const api = (path, token, opts = {}) => fetch(`${API}${path}`, {
  ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
})
const setRole = (uid, role) => execFileSync(PY, [join(here, 'set_role.py'), uid, role], { cwd: join(here, '..', 'backend') })

// ── CDP ──
const targets = await (await fetch(`${CDP}/json/list`)).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
const pageErrors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0])
  if (pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })) })
const js = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value
const viewport = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 })
async function waitFor(expr, label, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) { if (await js(expr)) return true; await sleep(150) }
  const where = await js('location.pathname + " | " + document.body.innerText.slice(0, 160).replace(/\\s+/g, " ")')
  check(false, `timed out waiting for: ${label} (at ${where})`)
  return false
}
const go = async (path) => { await send('Page.navigate', { url: `${APP}${path}` }); await sleep(600) }
const textOnPage = (t) => `document.body.innerText.includes(${JSON.stringify(t)})`
const clickText = (t, sel = 'a,button') => js(`(() => { const el = [...document.querySelectorAll('${sel}')].find(e => e.textContent.trim() === ${JSON.stringify(t)} && e.offsetParent !== null); if (!el) return false; el.click(); return true })()`)
async function typeInto(selector, value) {
  await js(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await send('Input.insertText', { text: value })
}
const setValue = (selector, value) => js(`(() => { const i = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
async function shot(name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  const s = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(s.data, 'base64'))
}
const path = () => js('location.pathname')

await send('Runtime.enable')
await viewport(1280)
const stamp = Date.now().toString(36)
const PASSWORD = `E2e-${stamp}-pass`

// Start from a clean test database, a clean emulator and a signed-out browser.
execFileSync(PY, [join(here, 'seed.py')], { cwd: join(here, '..', 'backend') })
await fetch(`http://${EMU}/emulator/v1/projects/${process.env.FIREBASE_PROJECT_ID ?? 'meditrack-7fe46'}/accounts`, { method: 'DELETE' })
await go('/')
await js('indexedDB.deleteDatabase("firebaseLocalStorageDb"); localStorage.clear(); true')
await go('/')

// 1. Bootstrap an admin (emulator account + DB role, as create_admin.py would).
const admin = await emuSignUp(`admin-${stamp}@example.com`, PASSWORD)
await api('/auth/register', admin.idToken, { method: 'POST', body: '{}' })
setRole(admin.localId, 'admin')

// 2. Patient signs up through the real UI.
await go('/auth/sign-up')
await typeInto('input[autocomplete="name"]', 'Erin Example')
await typeInto('input[type="email"]', `patient-${stamp}@example.com`)
await typeInto('input[autocomplete="new-password"]', PASSWORD)
await js(`document.querySelectorAll('input[autocomplete="new-password"]')[1].focus()`)
await send('Input.insertText', { text: PASSWORD })
await clickText('Create account', 'button')
await waitFor(`location.pathname === '/dashboard' && ${textOnPage('has not been given access')}`, 'awaiting-access dashboard')
check(await js(textOnPage('has not been given access')), 'new sign-up lands on "awaiting access" dashboard (role user)')
check(!(await js(textOnPage('Book appointment'))), 'role "user" has no booking navigation')
const patientUid = await js(`(async () => { const r = await new Promise(res => { const req = indexedDB.open('firebaseLocalStorageDb'); req.onsuccess = () => { const tx = req.result.transaction('firebaseLocalStorage'); const all = tx.objectStore('firebaseLocalStorage').getAll(); all.onsuccess = () => res(all.result) } }); return r[0]?.value?.uid })()`)
check(Boolean(patientUid), 'Firebase session persisted in the browser')

// 3. Admin assigns the patient role through the API with a real admin token.
const promote = await api(`/auth/users/${patientUid}/role`, admin.idToken, { method: 'PATCH', body: JSON.stringify({ role: 'patient' }) })
check(promote.status === 200, `admin assigns patient role (HTTP ${promote.status})`)
await go('/dashboard')
await waitFor(textOnPage('Book appointment'), 'patient navigation')
check(await js(textOnPage('My appointments')) && !(await js(textOnPage('Users & roles'))), 'patient sees patient navigation only')
check(await js(textOnPage('Back to home')), 'sidebar shows "Back to home"')

// 4. Book without a patient file.
await go('/patient/book-appointment')
await waitFor(`!!document.querySelector('input[name=doctor]')`, 'doctor list')
await js(`document.querySelector('input[name=doctor]').click()`)
const day = new Date(); day.setDate(day.getDate() + 7); while ([0, 6].includes(day.getDay())) day.setDate(day.getDate() + 1)
const dayISO = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
await setValue('input[type=date]', dayISO)
await waitFor(`document.querySelectorAll('[role=radio]:not([disabled])').length > 0`, 'open slots')
await js(`document.querySelectorAll('[role=radio]:not([disabled])')[2].click()`)
await clickText('Confirm booking', 'button')
await waitFor(textOnPage('Your appointment is booked'), 'booking confirmation')
check(await js(textOnPage('Your appointment is booked')), 'patient without a patient file books an appointment')
await shot('booked')

await go('/appointments')
await waitFor(textOnPage('Dr. Ada Okafor') + ` || ${textOnPage('Dr. Ben Iyer')}`, 'appointment listed')
check(await js(textOnPage('Upcoming')) && await js(textOnPage('Dr. ')), 'booking appears in My appointments')
await send('Page.reload'); await sleep(1500)
await waitFor(textOnPage('Dr. '), 'appointment after reload')
check(await js(textOnPage('Dr. ')), 'booking persists after reload')

// 5. Privacy: another patient cannot read it (API with a real token).
const other = await emuSignUp(`other-${stamp}@example.com`, PASSWORD)
await api('/auth/register', other.idToken, { method: 'POST', body: '{}' })
setRole(other.localId, 'patient')
const adminList = await (await api('/appointments/', admin.idToken)).json()
const mine = adminList.find((a) => a.firebase_uid === patientUid)
check(Boolean(mine) && mine.patient_id === null, 'stored against the account UID with no patient file')
check((await api(`/appointments/${mine.appointment_id}`, other.idToken)).status === 404, 'another patient gets 404 for it')
check((await (await api('/appointments/', other.idToken)).json()).length === 0, "another patient's list is empty")
check((await api('/patients/', other.idToken)).status === 200 && (await (await api('/patients/', other.idToken)).json()).length === 0, 'patient directory is not exposed')
check((await api('/medicines/', other.idToken)).status === 403, 'patient denied staff endpoint (403)')

// 6. Back to home keeps the session, and returning works (no loop).
await go('/appointments')
await waitFor(textOnPage('Back to home'), 'sidebar link')
await clickText('Back to home', 'a')
await waitFor(`location.pathname === '/'`, 'public home')
check((await path()) === '/', '"Back to home" opens the public home page')
await waitFor(textOnPage('Open MediTrack'), 'signed-in header')
check(await js(`document.querySelector('header').innerText.includes('Open MediTrack') && !document.querySelector('header').innerText.includes('Create account')`), 'still signed in on the public site (header)')
await clickText('Open MediTrack', 'a')
await waitFor(`location.pathname === '/dashboard' && ${textOnPage('Book an appointment')}`, 'dashboard again')
check((await path()) === '/dashboard', 'returns to the dashboard without a redirect loop')

await viewport(390)
await go('/appointments')
await waitFor(`!!document.querySelector('[aria-label="Open navigation"]')`, 'mobile menu button')
await js(`document.querySelector('[aria-label="Open navigation"]').click()`)
await waitFor(`[...document.querySelectorAll('[role=dialog] a')].some(a => a.textContent.trim() === 'Back to home')`, 'drawer link')
await shot('mobile-drawer')
await js(`[...document.querySelectorAll('[role=dialog] a')].find(a => a.textContent.trim() === 'Back to home').click()`)
await waitFor(`location.pathname === '/'`, 'home from mobile drawer')
check((await path()) === '/', '"Back to home" works from the mobile drawer')
await viewport(1280)

// 7. Sign out, then protected routes redirect to sign-in.
await go('/dashboard')
await waitFor(`!!document.querySelector('[aria-haspopup=menu]')`, 'account menu')
await js(`document.querySelector('[aria-haspopup=menu]').click()`)
await clickText('Sign out', 'button')
await waitFor(`location.pathname === '/' && document.querySelector('header').innerText.includes('Create account')`, 'signed out')
check(await js(`location.pathname === '/' && document.querySelector('header').innerText.includes('Create account')`), 'sign out returns to the public site signed out')
await go('/appointments')
await waitFor(`location.pathname === '/auth/sign-in'`, 'redirect to sign-in')
check((await path()) === '/auth/sign-in', 'protected page redirects to sign-in after sign-out')

// 8. Sign in through the UI as an unlinked doctor: sees no clinical data.
const doc = await emuSignUp(`doctor-${stamp}@example.com`, PASSWORD)
await api('/auth/register', doc.idToken, { method: 'POST', body: '{}' })
await api(`/auth/users/${doc.localId}/role`, admin.idToken, { method: 'PATCH', body: JSON.stringify({ role: 'doctor' }) })
await typeInto('input[type="email"]', `doctor-${stamp}@example.com`)
await typeInto('input[autocomplete="current-password"]', PASSWORD)
await clickText('Sign in', 'button')
await waitFor(`location.pathname === '/appointments'`, 'return to requested page after sign-in')
check((await path()) === '/appointments', 'sign-in returns to the originally requested page')
await waitFor(textOnPage('No appointments match'), 'empty schedule for unlinked doctor')
check(await js(textOnPage('No appointments match')), 'unlinked doctor sees no appointments')
await go('/dashboard')
await waitFor(textOnPage('not linked to a doctor record'), 'unlinked notice')
check(await js(textOnPage('not linked to a doctor record')), 'unlinked doctor is told why')
const nav = await js(`document.querySelector('nav[aria-label=Main]').innerText`)
check(nav.includes('Medical records') && !nav.includes('Users & roles') && !nav.includes('Bills'), `doctor navigation shows clinical pages, not admin or billing [${nav.replace(/\s+/g, ' ')}]`)
check((await (await api('/medical-records/', doc.idToken)).json()).length === 0, 'API: unlinked doctor gets no medical records')

// 9. Link the doctor; the booking becomes visible to that doctor only.
const doctors = await (await api('/doctors/', admin.idToken)).json()
const link1 = await api(`/auth/users/${doc.localId}/link-doctor`, admin.idToken, { method: 'PATCH', body: JSON.stringify({ doctor_id: mine.doctor_id }) })
check(link1.status === 200, `admin links doctor account (HTTP ${link1.status})`)
const visible = await (await api('/appointments/', doc.idToken)).json()
check(visible.some((a) => a.appointment_id === mine.appointment_id), 'linked doctor sees their own appointment')
const otherDoctor = doctors.find((d) => d.doctor_id !== mine.doctor_id)
const link2 = await api(`/auth/users/${doc.localId}/link-doctor`, admin.idToken, { method: 'PATCH', body: JSON.stringify({ doctor_id: otherDoctor.doctor_id }) })
check(link2.status === 200, `admin re-links doctor account (HTTP ${link2.status})`)
check(!(await (await api('/appointments/', doc.idToken)).json()).some((a) => a.appointment_id === mine.appointment_id), "doctor linked elsewhere cannot see it")
await go('/dashboard')
await waitFor(textOnPage('Back to home'), 'doctor sidebar')
check(await js(textOnPage('Back to home')), 'doctor sidebar shows "Back to home"')

check(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? `: ${pageErrors.join('; ')}` : ''}`)
ws.close()
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
