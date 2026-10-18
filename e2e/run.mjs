// Browser end-to-end test: Chrome (DevTools protocol) → Vite app (Web SDK on the
// Auth Emulator) → FastAPI (Admin SDK on the Auth Emulator) → meditrack_db_test.
// See e2e/README.md. No production services are contacted.
import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
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

// Click a visible link by its text inside an optional container and report where it lands.
async function followLink(text, scope = 'main') {
  const ok = await js(`(() => { const el = [...document.querySelectorAll('${scope} a')].find(a => a.textContent.trim().startsWith(${JSON.stringify(text)}) && a.offsetParent !== null); if (!el) return false; el.scrollIntoView(); el.click(); return true })()`)
  await sleep(700)
  return ok ? js('location.pathname + location.hash') : null
}
async function homepageChecks(label) {
  // Every image on the page must load (scroll so lazy images are requested).
  await js('(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)) } scrollTo(0, 0); return true })()')
  await waitFor(`[...document.querySelectorAll('main img')].every(i => i.complete)`, 'homepage images to finish loading')
  const imgs = await js(`[...document.querySelectorAll('main img')].map(i => ({ src: i.currentSrc.split('/').pop(), ok: i.naturalWidth > 0, alt: i.alt }))`)
  check(imgs.length >= 5 && imgs.every((i) => i.ok), `${label}: all ${imgs.length} homepage photos load (${imgs.filter((i) => !i.ok).map((i) => i.src).join(', ') || 'none broken'})`)
  check(imgs.every((i) => i.alt.length > 15), `${label}: every photo has descriptive alt text`)
  check(await js(`document.querySelectorAll('main h1').length === 1 && !!document.querySelector('main h1').textContent.includes('booked in minutes')`), `${label}: one h1 (hero headline)`)
  check(await js(`!!document.querySelector('#how-it-works')`), `${label}: "How booking works" anchor target exists`)
  check(await js('document.documentElement.scrollWidth <= innerWidth'), `${label}: no horizontal overflow`)
}

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

// 0. Homepage, signed out: every link goes somewhere real.
await go('/')
await waitFor(`!!document.querySelector('main h1')`, 'homepage')
await homepageChecks('signed out')
const links = [
  ['Book an appointment', '/appointments/book', 'main'],
  ['Meet our doctors', '/public/doctors', 'main'],
  ['Browse all departments', '/public/departments', 'main'],
  ['Cardiology', '/public/departments', 'main'],
  ['Start booking', '/appointments/book', 'main'],
  ['Full directory', '/public/doctors', 'main'],
  ['Create an account', '/auth/sign-up', 'main'],
  ['Book appointment', '/appointments/book', 'header'],
  ['Sign in', '/auth/sign-in', 'header'],
  ['Create account', '/auth/sign-up', 'header'],
  ['Departments', '/public/departments', 'header nav'],
  ['Doctors', '/public/doctors', 'header nav'],
  ['About', '/about', 'header nav'],
]
for (const [text, expected, scope] of links) {
  await go('/')
  await waitFor(`!!document.querySelector('main h1')`, 'homepage')
  await sleep(300)
  const landed = await followLink(text, scope)
  check(landed === expected, `homepage "${text}" (${scope}) → ${expected}${landed === expected ? '' : ` [got ${landed}]`}`)
}
await go('/')
const anchor = await followLink('How booking works', 'header nav')
await sleep(400)
check(anchor === '/#how-it-works' && await js(`Math.abs(document.querySelector('#how-it-works').getBoundingClientRect().top) < 120`), 'header "How booking works" scrolls to the section')
await go('/appointments/book')
await waitFor(textOnPage('Sign in to book'), 'booking entry')
check(await js(textOnPage('Sign in to book')), 'signed-out booking entry asks the visitor to sign in')
await go('/')
const faqOpens = await js(`(() => { const d = document.querySelector('main details'); d.querySelector('summary').click(); return d.open })()`)
check(faqOpens, 'FAQ question expands')

// Homepage on a phone: own header with Book + menu.
await viewport(390)
await go('/')
await waitFor(`!!document.querySelector('[aria-controls=mobile-nav]')`, 'mobile menu toggle')
await homepageChecks('mobile')
check(await js(`[...document.querySelectorAll('header a')].some(a => a.textContent.trim() === 'Book' && a.offsetParent !== null)`), 'mobile header shows a Book button')
await js(`document.querySelector('[aria-controls=mobile-nav]').click()`)
await sleep(300)
check(await js(`!!document.querySelector('#mobile-nav') && document.querySelector('[aria-controls=mobile-nav]').getAttribute('aria-expanded') === 'true'`), 'mobile menu opens (aria-expanded=true)')
const mLanded = await followLink('Doctors', '#mobile-nav')
check(mLanded === '/public/doctors' && !(await js(`!!document.querySelector('#mobile-nav')`)), 'mobile menu link navigates and the menu closes')
await viewport(1280)

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
const order = (root) => `[...document.querySelectorAll('${root} nav[aria-label=Main] a')].slice(0, 2).map(a => a.textContent.trim()).join(' > ')`
check((await js(order('aside'))) === 'Back to home > Overview', `desktop sidebar starts with "Back to home" directly above "Overview" [${await js(order('aside'))}]`)

// Homepage while signed in as a patient.
await go('/')
await waitFor(textOnPage('Open MediTrack'), 'signed-in homepage')
await homepageChecks('signed in')
check(await js(`document.querySelector('header').innerText.includes('Open MediTrack') && !document.querySelector('header').innerText.includes('Sign in')`), 'signed-in header offers Open MediTrack, not Sign in')
const signedBook = await followLink('Book an appointment', 'main')
await waitFor(`location.pathname === '/patient/book-appointment'`, 'patient booking page')
check((await path()) === '/patient/book-appointment', `homepage "Book an appointment" takes a patient straight to booking [${signedBook}]`)
await go('/')
const openApp = await followLink('Open MediTrack', 'main')
check(openApp === '/dashboard', 'closing section "Open MediTrack" → /dashboard')

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

// 5b. Billing and Stripe Checkout (Stripe API faked in the launcher; signatures real).
const WHSEC = 'whsec_e2e_meditrack'
async function webhook(evt) {
  const body = JSON.stringify(evt)
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', WHSEC).update(`${t}.${body}`).digest('hex')
  const r = await fetch(`${API}/payments/stripe/webhook`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${v1}` } })
  return { status: r.status, body: await r.json() }
}
const stripeEvent = (id, type, sid, amount) => ({ id, object: 'event', type, created: Math.floor(Date.now() / 1000), livemode: false,
  data: { object: { id: sid, object: 'checkout.session', status: 'complete', payment_status: 'paid', amount_total: amount, currency: 'usd', payment_intent: 'pi_e2e' } } })

// Staff identify the patient: create a file, link the account, then issue a bill.
const file = await (await api('/patients/', admin.idToken, { method: 'POST', body: JSON.stringify({ first_name: 'Erin', last_name: 'Example', date_of_birth: '1990-02-03', gender: 'Female', phone: '+1 555 0199' }) })).json()
await api(`/auth/users/${patientUid}/link-patient`, admin.idToken, { method: 'PATCH', body: JSON.stringify({ patient_id: file.patient_id }) })
const billRes = await api('/bills/', admin.idToken, { method: 'POST', body: JSON.stringify({ patient_id: file.patient_id, appointment_id: mine.appointment_id, amount: '45.00' }) })
const bill = await billRes.json()
check(billRes.status === 201, `staff issue a 45.00 bill for the booking (HTTP ${billRes.status})`)
const ONLINE = (await (await api('/bills/summary', admin.idToken)).json()).online_payment_enabled
console.log(`  (online payment ${ONLINE ? 'enabled — fake Stripe' : 'NOT configured'})`)

await go('/dashboard')
await waitFor(textOnPage('Bills to pay'), 'overview pending payments')
check(await js(textOnPage('Bills to pay')) && await js(textOnPage('Pay with Stripe')), 'patient Overview shows the pending bill with "Pay with Stripe"')
await go('/bills')
await waitFor(textOnPage('Awaiting payment') + ` && [...document.querySelectorAll('tbody tr')].length > 0`, 'patient bills pending section')
check(await js(textOnPage('Awaiting payment')) && await js(textOnPage('Payment history')), 'patient Bills page groups pending and history')
await shot(`patient-pending-${ONLINE ? 'stripe-on' : 'stripe-off'}`)

// Regression: the Pay button must be present on pending bills whether or not
// Stripe is configured — disabled with an explanation when it is not.
const payState = (billId) => js(`(() => {
  const inPanel = [...document.querySelectorAll('section')].filter(s => /Awaiting payment|Pending payments|Bills to pay/.test(s.innerText))
    .flatMap(s => [...s.querySelectorAll('li')]).filter(li => new RegExp('[Bb]ill #${billId}([^0-9]|$)').test(li.innerText))
    .flatMap(li => [...li.querySelectorAll('button')]).filter(b => b.textContent.includes('Pay with Stripe'))
  const inTable = [...document.querySelectorAll('tbody tr')].filter(tr => new RegExp('(^|Bill )#${billId}([^0-9]|$)').test(tr.querySelector('td').innerText.trim()))
    .flatMap(tr => [...tr.querySelectorAll('button')]).filter(b => b.textContent.includes('Pay with Stripe'))
  const all = [...inPanel, ...inTable]
  return { panel: inPanel.length, table: inTable.length, disabled: all.length > 0 && all.every(b => b.disabled) }
})()`)
const ps = await payState(bill.bill_id)
check(ps.panel === 1 && ps.table === 1, `patient sees "Pay with Stripe" for the pending bill in the pending list and its table row [panel=${ps.panel}, table=${ps.table}]`)
if (ONLINE) {
  check(!ps.disabled, 'Stripe configured: the Pay buttons are enabled')
} else {
  check(ps.disabled, 'Stripe not configured: the Pay buttons are shown disabled, not hidden')
  check(await js(textOnPage("Online payment isn't set up yet")) && await js(textOnPage('pay at the clinic')), 'Stripe not configured: patient sees a clear explanation')
  const r = await api(`/bills/${bill.bill_id}/checkout`, other.idToken, { method: 'POST' })
  check(r.status === 404, 'another patient still cannot start checkout for it')
}

if (ONLINE) {
  // Click Pay: capture the redirect to Stripe and block it (no real Stripe page is loaded).
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://checkout.stripe.com/*' }] })
  let checkoutUrl = null
  const onPaused = (e) => {
    const m = JSON.parse(e.data)
    if (m.method === 'Fetch.requestPaused') { checkoutUrl = m.params.request.url; ws.send(JSON.stringify({ id: ++id, method: 'Fetch.failRequest', params: { requestId: m.params.requestId, errorReason: 'Aborted' } })) }
  }
  ws.addEventListener('message', onPaused)
  await clickText('Pay with Stripe', 'button')
  const until = Date.now() + 10000
  while (!checkoutUrl && Date.now() < until) await sleep(100)
  ws.removeEventListener('message', onPaused)
  await send('Fetch.disable')
  check(Boolean(checkoutUrl?.startsWith('https://checkout.stripe.com/c/pay/cs_test_')), `"Pay with Stripe" redirects to Stripe Checkout [${checkoutUrl?.slice(0, 60)}]`)
  const sid = checkoutUrl?.split('/').pop()
  check((await (await api(`/bills/${bill.bill_id}`, other.idToken)).status) === 404, "another patient cannot see this bill")
  check((await (await api(`/bills/${bill.bill_id}/checkout`, other.idToken, { method: 'POST' })).status) === 404, "another patient cannot start checkout for it")
  check((await (await api(`/bills/${bill.bill_id}`, admin.idToken)).json()).payment_status === 'pending', 'starting checkout does not mark the bill paid')

  // Cancelled on Stripe → back to /bills, nothing changes.
  await go(`/bills?payment=cancelled&bill=${bill.bill_id}`)
  await waitFor(textOnPage('Payment cancelled'), 'cancel notice')
  check(await js(textOnPage('Nothing was charged')), 'cancel return explains nothing was charged')
  // Forged "success" return without Stripe confirmation → not paid.
  await go(`/bills?payment=success&session_id=${sid}`)
  await sleep(2500)
  check(!(await js(textOnPage('Payment received'))) && (await (await api(`/bills/${bill.bill_id}`, admin.idToken)).json()).payment_status === 'pending',
    'success URL alone does not mark the bill paid')

  // Stripe confirms via signed webhook; a duplicate delivery is ignored.
  const w1 = await webhook(stripeEvent('evt_e2e_1', 'checkout.session.completed', sid, 4500))
  check(w1.status === 200 && w1.body.outcome === 'paid', `verified webhook marks the bill paid (${w1.body.outcome})`)
  const w2 = await webhook(stripeEvent('evt_e2e_1', 'checkout.session.completed', sid, 4500))
  check(w2.body.outcome === 'duplicate_event', 'duplicate webhook delivery is ignored')
  const forged = await fetch(`${API}/payments/stripe/webhook`, { method: 'POST', body: '{}', headers: { 'Stripe-Signature': 't=1,v1=bad' } })
  check(forged.status === 400, 'webhook with a bad signature is rejected (400)')
  await go(`/bills?payment=success&session_id=${sid}`)
  await waitFor(textOnPage('Payment received'), 'success notice')
  check(await js(textOnPage('Payment received')), 'return page confirms the payment')
  const paidBill = await (await api(`/bills/${bill.bill_id}`, admin.idToken)).json()
  check(paidBill.payment_status === 'paid' && paidBill.payment_method === 'Card (Stripe)', 'bill is paid by Stripe card')
  check(!(await js(textOnPage('Awaiting payment'))), 'patient Bills page no longer lists it as pending')
  const summary = await (await api('/bills/summary', admin.idToken)).json()
  check(summary.fully_paid.some((p) => p.patient_id === file.patient_id) && !summary.pending.some((b) => b.bill_id === bill.bill_id),
    'staff summary moves the patient to "Fully paid"')
  check((await api(`/bills/${bill.bill_id}/checkout`, admin.idToken, { method: 'POST' })).status === 409, 'a paid bill cannot be checked out again')
} else {
  check((await api(`/bills/${bill.bill_id}/checkout`, admin.idToken, { method: 'POST' })).status === 503, 'checkout API answers 503 while Stripe is not configured')
  check((await (await api(`/bills/${bill.bill_id}`, admin.idToken)).json()).payment_status === 'pending', 'the bill stays pending')
  const cash = await api(`/bills/${bill.bill_id}`, admin.idToken, { method: 'PATCH', body: JSON.stringify({ payment_status: 'paid', payment_method: 'Cash' }) })
  check(cash.status === 200, 'staff record a cash payment instead')
}
await go('/bills')
await waitFor(`[...document.querySelectorAll('tbody tr')].length > 0 && !${textOnPage('Awaiting payment')}`, 'paid bill view')
const after = await payState(bill.bill_id)
check(after.panel === 0 && after.table === 0, `no Pay button once the bill is paid [panel=${after.panel}, table=${after.table}]`)

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
check((await js(order('[role=dialog]'))) === 'Back to home > Overview', `mobile drawer starts with "Back to home" directly above "Overview" [${await js(order('[role=dialog]'))}]`)
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
check((await js(order('aside'))) === 'Back to home > Overview', 'doctor sidebar: "Back to home" above "Overview"')

// 10. Staff billing view: sign in as the admin through the UI.
await js(`document.querySelector('[aria-haspopup=menu]').click()`)
await clickText('Sign out', 'button')
await waitFor(`location.pathname === '/'`, 'signed out')
await go('/auth/sign-in')
await typeInto('input[type="email"]', `admin-${stamp}@example.com`)
await typeInto('input[autocomplete="current-password"]', PASSWORD)
await clickText('Sign in', 'button')
await waitFor(`location.pathname === '/dashboard' && ${textOnPage('Fully paid')}`, 'admin overview billing')
check(await js(textOnPage('Pending payments')) && await js(textOnPage('Fully paid')), 'staff Overview shows "Pending payments" and "Fully paid"')
check(await js(`[...document.querySelectorAll('section')].some(s => s.innerText.startsWith('Fully paid') && s.innerText.includes('Erin Example'))`), 'the paid patient is listed under "Fully paid"')
const appt2 = await (await api('/appointments/', admin.idToken, { method: 'POST', body: JSON.stringify({ patient_id: file.patient_id, doctor_id: mine.doctor_id, appointment_date: dayISO, appointment_time: '15:30' }) })).json()
const bill2 = await (await api('/bills/', admin.idToken, { method: 'POST', body: JSON.stringify({ patient_id: file.patient_id, appointment_id: appt2.appointment_id, amount: '20.00' }) })).json()
await go('/bills')
await waitFor(textOnPage('Fully paid') + ' && ' + textOnPage('Pending payments') + ` && [...document.querySelectorAll('tbody tr')].length >= 2`, 'staff bills grouping')
check(await js(textOnPage('Pending payments')) && await js(textOnPage('Fully paid')) && await js(textOnPage('All bills')), 'staff Bills page shows the same grouping')
await shot(`staff-bills-${ONLINE ? 'stripe-on' : 'stripe-off'}`)
const staffPending = await payState(bill2.bill_id)
const staffPaid = await payState(bill.bill_id)
check(staffPending.panel === 1 && staffPending.table === 1, `billing staff see "Pay with Stripe" for a pending bill in the list and the table [panel=${staffPending.panel}, table=${staffPending.table}]`)
check(staffPaid.panel === 0 && staffPaid.table === 0, 'billing staff see no Pay button on a paid bill')
check(ONLINE ? !staffPending.disabled : (staffPending.disabled && await js(textOnPage('Stripe is not configured on the server'))),
  ONLINE ? 'staff Pay button is enabled with Stripe configured' : 'staff see the button disabled with a configuration explanation')

check(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? `: ${pageErrors.join('; ')}` : ''}`)
ws.close()
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
