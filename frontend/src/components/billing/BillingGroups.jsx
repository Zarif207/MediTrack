/**
 * Pending payments and fully paid patients, from GET /bills/summary.
 * Used on the staff Overview and the staff Bills page.
 */
import { useState } from 'react'
import { RiBillLine, RiCheckboxCircleLine, RiTimeLine } from 'react-icons/ri'
import Panel from '../ui/Panel'
import { Badge } from '../ui/StatusBadge'
import { Alert, EmptyState } from '../ui/States'
import PayButton from './PayButton'
import { formatCurrency, formatDate, plural } from '../../utils/format'

const OVERDUE_DAYS = 14

function Outstanding({ days }) {
  if (days >= OVERDUE_DAYS) return <Badge tone="warn"><RiTimeLine aria-hidden size={12} />Outstanding {days} days</Badge>
  return <span className="text-xs text-ink-500">{days === 0 ? 'Issued today' : `Issued ${plural(days, 'day')} ago`}</span>
}

export function PendingPayments({ summary, canPay, limit, title = 'Pending payments', showPatient = true, action }) {
  const [error, setError] = useState(null)
  const rows = limit ? summary.pending.slice(0, limit) : summary.pending
  return (
    <Panel
      title={title}
      description={summary.pending.length ? `${plural(summary.pending.length, 'bill')} · ${formatCurrency(summary.pending_total)} outstanding` : undefined}
      actions={action}
    >
      {error && <div className="px-4 pt-3 sm:px-5"><Alert onDismiss={() => setError(null)}>{error}</Alert></div>}
      {rows.length ? (
        <ul className="divide-y divide-ink-100">
          {rows.map((b) => (
            <li key={b.bill_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">
                  {showPatient ? (b.patient_name ?? `Patient #${b.patient_id}`) : `Bill #${b.bill_id}`}
                </p>
                <p className="text-xs text-ink-500">
                  {showPatient ? `Bill #${b.bill_id} · ` : ''}appointment #{b.appointment_id} · issued {formatDate(b.issued_at)}
                </p>
              </div>
              <Outstanding days={b.days_outstanding} />
              {b.checkout_open && <Badge tone="info">Checkout in progress</Badge>}
              <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatCurrency(b.amount)}</span>
              {canPay && summary.online_payment_enabled && <PayButton billId={b.bill_id} onError={setError} />}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={RiCheckboxCircleLine} title="No pending payments" description="Every active bill has been paid." />
      )}
      {canPay && !summary.online_payment_enabled && summary.pending.length > 0 && (
        <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500 sm:px-5">Online payment is not configured; record payments manually.</p>
      )}
      {limit && summary.pending.length > limit && (
        <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500 sm:px-5">Showing the {limit} oldest of {summary.pending.length}.</p>
      )}
    </Panel>
  )
}

export function FullyPaid({ summary, limit }) {
  const rows = limit ? summary.fully_paid.slice(0, limit) : summary.fully_paid
  return (
    <Panel title="Fully paid" description="Patients whose bills are all paid">
      {rows.length ? (
        <ul className="divide-y divide-ink-100">
          {rows.map((p) => (
            <li key={p.patient_id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <RiCheckboxCircleLine aria-hidden size={18} className="shrink-0 text-pine-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{p.patient_name ?? `Patient #${p.patient_id}`}</p>
                <p className="text-xs text-ink-500">
                  {plural(p.bills_paid, 'bill')} paid{p.last_paid_at ? ` · last on ${formatDate(p.last_paid_at)}` : ''}
                </p>
              </div>
              <span className="text-sm tabular-nums text-ink-700">{formatCurrency(p.total_paid)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={RiBillLine} title="No fully paid patients yet" />
      )}
      {limit && summary.fully_paid.length > limit && (
        <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500 sm:px-5">Showing {limit} of {summary.fully_paid.length}.</p>
      )}
    </Panel>
  )
}

export function PendingReminder({ summary }) {
  const overdue = summary.pending.filter((b) => b.days_outstanding >= OVERDUE_DAYS)
  if (!summary.pending.length) return null
  return (
    <div className="mb-6">
      <Alert tone={overdue.length ? 'warn' : 'info'} title={`${plural(summary.pending.length, 'bill')} awaiting payment · ${formatCurrency(summary.pending_total)}`}>
        {overdue.length
          ? `${plural(overdue.length, 'bill')} ${overdue.length === 1 ? 'has' : 'have'} been outstanding for ${OVERDUE_DAYS} days or more.`
          : 'All pending bills were issued within the last two weeks.'}
      </Alert>
    </div>
  )
}
