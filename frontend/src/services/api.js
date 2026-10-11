/**
 * MediTrack API client
 * All requests go through the Vite dev-proxy at /api → http://127.0.0.1:8000
 * In production, set VITE_API_BASE_URL to the backend origin.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Generic fetch wrapper */
async function request(method, path, body, params) {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) options.body = JSON.stringify(body)

  const res = await fetch(url.toString(), options)

  if (res.status === 204) return null // DELETE success

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // FastAPI validation errors come back as { detail: [...] }
    const msg =
      Array.isArray(data?.detail)
        ? data.detail.map((e) => `${e.loc?.join('.')}: ${e.msg}`).join('\n')
        : data?.detail ?? `HTTP ${res.status}`
    throw new Error(msg)
  }

  return data
}

const get = (path, params) => request('GET', path, undefined, params)
const post = (path, body) => request('POST', path, body)
const patch = (path, body) => request('PATCH', path, body)
const del = (path) => request('DELETE', path)

/* ── Health ── */
export const healthApi = {
  check: () => get('/health'),
}

/* ── Patients ── */
export const patientsApi = {
  list: (params) => get('/patients/', params),
  get: (id) => get(`/patients/${id}`),
  create: (body) => post('/patients/', body),
  update: (id, body) => patch(`/patients/${id}`, body),
  delete: (id) => del(`/patients/${id}`),
}

/* ── Departments ── */
export const departmentsApi = {
  list: (params) => get('/departments/', params),
  get: (id) => get(`/departments/${id}`),
  create: (body) => post('/departments/', body),
  update: (id, body) => patch(`/departments/${id}`, body),
  delete: (id) => del(`/departments/${id}`),
}

/* ── Doctors ── */
export const doctorsApi = {
  list: (params) => get('/doctors/', params),
  get: (id) => get(`/doctors/${id}`),
  create: (body) => post('/doctors/', body),
  update: (id, body) => patch(`/doctors/${id}`, body),
  delete: (id) => del(`/doctors/${id}`),
}

/* ── Appointments ── */
export const appointmentsApi = {
  list: (params) => get('/appointments/', params),
  get: (id) => get(`/appointments/${id}`),
  create: (body) => post('/appointments/', body),
  update: (id, body) => patch(`/appointments/${id}`, body),
  delete: (id) => del(`/appointments/${id}`),
}

/* ── Medical Records ── */
export const medicalRecordsApi = {
  list: (params) => get('/medical-records/', params),
  get: (id) => get(`/medical-records/${id}`),
  create: (body) => post('/medical-records/', body),
  update: (id, body) => patch(`/medical-records/${id}`, body),
  delete: (id) => del(`/medical-records/${id}`),
}

/* ── Medicines ── */
export const medicinesApi = {
  list: (params) => get('/medicines/', params),
  get: (id) => get(`/medicines/${id}`),
  create: (body) => post('/medicines/', body),
  update: (id, body) => patch(`/medicines/${id}`, body),
  delete: (id) => del(`/medicines/${id}`),
}

/* ── Prescriptions ── */
export const prescriptionsApi = {
  list: (params) => get('/prescriptions/', params),
  get: (id) => get(`/prescriptions/${id}`),
  create: (body) => post('/prescriptions/', body),
  update: (id, body) => patch(`/prescriptions/${id}`, body),
  delete: (id) => del(`/prescriptions/${id}`),
}

/* ── Prescription Items ── */
export const prescriptionItemsApi = {
  list: (params) => get('/prescription-items/', params),
  get: (id) => get(`/prescription-items/${id}`),
  create: (body) => post('/prescription-items/', body),
  update: (id, body) => patch(`/prescription-items/${id}`, body),
  delete: (id) => del(`/prescription-items/${id}`),
}

/* ── Bills ── */
export const billsApi = {
  list: (params) => get('/bills/', params),
  get: (id) => get(`/bills/${id}`),
  create: (body) => post('/bills/', body),
  update: (id, body) => patch(`/bills/${id}`, body),
  delete: (id) => del(`/bills/${id}`),
}
