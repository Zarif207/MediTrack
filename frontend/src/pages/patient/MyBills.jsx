import { RiBillLine } from 'react-icons/ri'
import { billsApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import PageHeader from '../../components/ui/PageHeader'
import Panel from '../../components/ui/Panel'
import DataTable from '../../components/ui/DataTable'
import StatusBadge from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/States'
import { formatCurrency, formatDate } from '../../utils/format'
import { PendingPayments } from '../../components/billing/BillingGroups'
import PaymentReturnNotice from '../../components/billing/PaymentReturnNotice'

export default function MyBills() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([billsApi.listAll(), billsApi.summary()]), [])
  const [allBills, summary] = data ?? [[], null]
  const bills = [...allBills].sort((a, b) => b.issued_at.localeCompare(a.issued_at))
  const outstanding = bills
    .filter((b) => b.payment_status === 'pending')
    .reduce((sum, b) => sum + Number.parseFloat(b.amount), 0)

  return (
    <>
      <PageHeader title="Bills" description="Charges for your visits and their payment status." />
      <PaymentReturnNotice onConfirmed={reload} />
      {!loading && !error && bills.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-100 bg-surface px-4 py-3.5">
            <p className="text-xs text-ink-500">Outstanding</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(outstanding)}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-surface px-4 py-3.5">
            <p className="text-xs text-ink-500">Bills on record</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{bills.length}</p>
          </div>
        </div>
      )}
      {summary && summary.pending.length > 0 && (
        <div className="mb-6">
          <PendingPayments summary={summary} canPay showPatient={false} title="Awaiting payment" />
        </div>
      )}
      <Panel title="Payment history">
        <DataTable
          caption="Your bills"
          loading={loading}
          error={error}
          onRetry={reload}
          rows={bills}
          rowKey={(b) => b.bill_id}
          empty={<EmptyState icon={RiBillLine} title="No bills yet" description="Bills issued for your visits will appear here." />}
          columns={[
            { key: 'bill_id', header: 'Bill', primary: true, render: (b) => <span className="font-mono text-[13px]">#{b.bill_id}</span> },
            { key: 'issued_at', header: 'Issued', render: (b) => formatDate(b.issued_at) },
            { key: 'appointment_id', header: 'Visit', render: (b) => `Appointment #${b.appointment_id}` },
            { key: 'status', header: 'Status', render: (b) => <StatusBadge type="payment" value={b.payment_status} /> },
            { key: 'paid_at', header: 'Paid', render: (b) => (b.paid_at ? formatDate(b.paid_at) : '—') },
            { key: 'amount', header: 'Amount', align: 'right', render: (b) => <span className="font-medium">{formatCurrency(b.amount)}</span> },
          ]}
        />
      </Panel>
    </>
  )
}
