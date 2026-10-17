const CURRENCY = import.meta.env.VITE_CURRENCY ?? 'USD'

/** Parse "YYYY-MM-DD" as a local calendar date (not UTC midnight). */
function toDate(val) {
  if (val instanceof Date) return val
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(val)
}

export function formatDate(val, opts = {}) {
  if (!val) return '—'
  const d = toDate(val)
  if (Number.isNaN(d.getTime())) return String(val)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...opts })
}

export function formatWeekday(val) {
  return formatDate(val, { weekday: 'short' })
}

export function formatDateTime(val) {
  if (!val) return '—'
  const d = toDate(val)
  if (Number.isNaN(d.getTime())) return String(val)
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** "14:30:00" → "2:30 PM" (locale aware) */
export function formatTime(val) {
  if (!val) return '—'
  const [h, m] = String(val).split(':').map(Number)
  if (Number.isNaN(h)) return String(val)
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return '—'
  const n = typeof val === 'string' ? Number.parseFloat(val) : val
  if (Number.isNaN(n)) return String(val)
  return n.toLocaleString(undefined, { style: 'currency', currency: CURRENCY })
}

export function truncate(str, len = 60) {
  if (!str) return '—'
  return str.length > len ? `${str.slice(0, len).trimEnd()}…` : str
}

export function calcAge(dob) {
  if (!dob) return null
  const today = new Date()
  const birth = toDate(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : '')
export const doctorName = (d) => (d ? `Dr. ${d.first_name} ${d.last_name}` : '')

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** True when an appointment's date + time is still ahead. */
export function isUpcoming(appt) {
  if (!appt) return false
  const [y, mo, d] = appt.appointment_date.split('-').map(Number)
  const [h, mi] = appt.appointment_time.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi) > new Date()
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

/** "brain, nerve, and spinal cord" → "Brain, nerve, and spinal cord" */
export function sentenceCase(str = '') {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}
