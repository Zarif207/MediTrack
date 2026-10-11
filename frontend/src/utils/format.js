/** Format an ISO date string → "Jan 15, 2025" */
export function formatDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d)) return val
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Format an ISO datetime → "Jan 15, 2025, 09:30 AM" */
export function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d)) return val
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Format a time string "HH:MM:SS" → "09:30 AM" */
export function formatTime(val) {
  if (!val) return '—'
  const [h, m] = val.split(':').map(Number)
  if (isNaN(h)) return val
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 || 12
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Format a Decimal/number as currency */
export function formatCurrency(val) {
  if (val === null || val === undefined) return '—'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return val
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Truncate a long string */
export function truncate(str, len = 60) {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '…' : str
}

/** Calculate age from date_of_birth (YYYY-MM-DD) */
export function calcAge(dob) {
  if (!dob) return '—'
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/** Title-case a string */
export function titleCase(str) {
  if (!str) return ''
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
