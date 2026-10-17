/**
 * MediTrack API client.
 *
 * - Requests go to VITE_API_BASE_URL, or /api (proxied to FastAPI by Vite).
 * - The signed-in user's Firebase ID token is attached as a Bearer token.
 *   The SDK refreshes expired tokens; on a 401 the request is retried once
 *   with a forced refresh before the session is treated as ended.
 * - Every failure is thrown as an ApiError with a human-readable message, the
 *   HTTP status and, for validation errors, per-field messages.
 */
import { auth } from './firebase'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

/** Fired when the backend rejects the session even after a token refresh. */
export const SESSION_EXPIRED_EVENT = 'meditrack:session-expired'

export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = {}, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  get isNetwork() { return this.status === 0 }
  get isForbidden() { return this.status === 403 }
  get isNotFound() { return this.status === 404 }
}

const STATUS_MESSAGES = {
  401: 'Your session has ended. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'That item could not be found.',
  409: 'That conflicts with existing data.',
  422: 'Some details need attention.',
  429: 'Too many requests. Please wait a moment and try again.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
}

const FIELD_LABELS = {
  first_name: 'First name', last_name: 'Last name', date_of_birth: 'Date of birth',
  appointment_date: 'Date', appointment_time: 'Time', doctor_id: 'Doctor',
  patient_id: 'Patient', department_id: 'Department', license_number: 'License number',
  unit_price: 'Unit price', stock_quantity: 'Stock', payment_status: 'Payment status',
  payment_method: 'Payment method', blood_group: 'Blood group',
  emergency_contact: 'Emergency contact', medicine_id: 'Medicine',
  prescription_id: 'Prescription', record_id: 'Medical record',
}

function humanField(name) {
  return FIELD_LABELS[name] ?? name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function cleanValidationMessage(msg = '') {
  // Pydantic prefixes custom messages with "Value error, ".
  return msg.replace(/^Value error, /, '').replace(/^String should/, 'Should')
}

function toApiError(status, data) {
  const detail = data?.detail
  if (status === 422 && Array.isArray(detail)) {
    const fieldErrors = {}
    for (const e of detail) {
      const field = e.loc?.filter((p) => p !== 'body' && p !== 'query' && p !== 'path').join('.') || 'form'
      if (!fieldErrors[field]) fieldErrors[field] = cleanValidationMessage(e.msg)
    }
    const summary = Object.entries(fieldErrors)
      .map(([f, m]) => (f === 'form' ? m : `${humanField(f)}: ${m}`))
      .join(' ')
    return new ApiError(summary || STATUS_MESSAGES[422], { status, fieldErrors })
  }
  if (status >= 500 && status !== 503) {
    return new ApiError('Something went wrong on our side. Please try again.', { status })
  }
  const message = typeof detail === 'string' && detail ? detail : STATUS_MESSAGES[status] ?? `Request failed (${status}).`
  return new ApiError(message, { status })
}

async function currentToken(forceRefresh = false) {
  const user = auth?.currentUser
  if (!user) return null
  try {
    return await user.getIdToken(forceRefresh)
  } catch {
    return null
  }
}

async function send(method, path, { body, params, token }) {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    return await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    throw new ApiError(
      'Cannot reach the MediTrack server. Check your connection and try again.',
      { status: 0, cause },
    )
  }
}

async function request(method, path, { body, params } = {}) {
  let token = await currentToken()
  let res = await send(method, path, { body, params, token })

  if (res.status === 401 && token) {
    token = await currentToken(true)
    if (token) res = await send(method, path, { body, params, token })
    if (res.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw toApiError(res.status, data)
  return data
}

const get = (path, params) => request('GET', path, { params })
const post = (path, body) => request('POST', path, { body })
const patch = (path, body) => request('PATCH', path, { body })
const del = (path) => request('DELETE', path)

const PAGE = 100
const MAX_ROWS = 5000

/** Fetch every page of a list endpoint (bounded), so tables never silently truncate. */
async function listAll(path, params = {}) {
  const rows = []
  for (let skip = 0; skip < MAX_ROWS; skip += PAGE) {
    const page = await get(path, { ...params, skip, limit: PAGE })
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}

function resource(path) {
  return {
    list: (params) => get(path, params),
    listAll: (params) => listAll(path, params),
    get: (id) => get(`${path}${id}`),
    create: (body) => post(path, body),
    update: (id, body) => patch(`${path}${id}`, body),
    remove: (id) => del(`${path}${id}`),
  }
}

export const healthApi = { check: () => get('/health') }

export const authApi = {
  register: (displayName) => post('/auth/register', displayName ? { display_name: displayName } : {}),
  me: () => get('/auth/me'),
  updateMe: (body) => patch('/auth/me', body),
  listUsers: () => get('/auth/users'),
  setRole: (uid, role) => patch(`/auth/users/${encodeURIComponent(uid)}/role`, { role }),
  linkPatient: (uid, patientId) =>
    patch(`/auth/users/${encodeURIComponent(uid)}/link-patient`, { patient_id: patientId }),
}

export const patientsApi = resource('/patients/')
export const departmentsApi = resource('/departments/')
export const doctorsApi = {
  ...resource('/doctors/'),
  availability: (doctorId, on) => get(`/doctors/${doctorId}/availability`, { on }),
}
export const appointmentsApi = {
  ...resource('/appointments/'),
  book: (body) => post('/appointments/book', body),
  cancel: (id) => post(`/appointments/${id}/cancel`),
}
export const medicalRecordsApi = resource('/medical-records/')
export const medicinesApi = resource('/medicines/')
export const prescriptionsApi = resource('/prescriptions/')
export const prescriptionItemsApi = resource('/prescription-items/')
export const billsApi = resource('/bills/')
