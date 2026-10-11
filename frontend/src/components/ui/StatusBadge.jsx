/**
 * StatusBadge — small pill badge for appointment status, payment status, etc.
 */

const APPOINTMENT_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-teal-100 text-teal-700 border-teal-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
  no_show:   'bg-amber-100 text-amber-700 border-amber-200',
}

const PAYMENT_COLORS = {
  pending:   'bg-amber-100 text-amber-700 border-amber-200',
  paid:      'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
}

export default function StatusBadge({ type = 'appointment', value }) {
  const map = type === 'payment' ? PAYMENT_COLORS : APPOINTMENT_COLORS
  const cls = map[value] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  const label = value?.replace(/_/g, ' ') ?? '—'
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${cls}`}
    >
      {label}
    </span>
  )
}
