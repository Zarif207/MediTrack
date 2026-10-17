const TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  info: 'bg-info-50 text-info-700',
  good: 'bg-pine-50 text-pine-700',
  warn: 'bg-warn-50 text-warn-700',
  bad: 'bg-danger-50 text-danger-700',
}

const APPOINTMENT = {
  scheduled: ['info', 'Scheduled'],
  confirmed: ['good', 'Confirmed'],
  completed: ['neutral', 'Completed'],
  cancelled: ['bad', 'Cancelled'],
  no_show: ['warn', 'No-show'],
}

const PAYMENT = {
  pending: ['warn', 'Pending'],
  paid: ['good', 'Paid'],
  cancelled: ['neutral', 'Cancelled'],
}

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}

export default function StatusBadge({ type = 'appointment', value }) {
  const map = type === 'payment' ? PAYMENT : APPOINTMENT
  const [tone, label] = map[value] ?? ['neutral', value ?? '—']
  return (
    <Badge tone={tone}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </Badge>
  )
}
