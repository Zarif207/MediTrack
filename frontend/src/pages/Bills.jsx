import { useMemo, useState } from 'react'
import { RiAddLine, RiBillLine, RiDeleteBinLine, RiPencilLine } from 'react-icons/ri'
import { appointmentsApi, billsApi, patientsApi } from '../services/api'
import { optional, useAsync } from '../hooks/useAsync'
import { useForm } from '../hooks/useForm'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Button, { IconButton } from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import StatusBadge from '../components/ui/StatusBadge'
import SearchInput from '../components/ui/SearchInput'
import Toolbar, { FilterSelect } from '../components/ui/Toolbar'
import FormModal from '../components/ui/FormModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { FieldGrid, Input, Select } from '../components/ui/Field'
import { EmptyState } from '../components/ui/States'
import { FullyPaid, PendingPayments, PendingReminder } from '../components/billing/BillingGroups'
import PaymentReturnNotice from '../components/billing/PaymentReturnNotice'
import { formatCurrency, formatDate, formatTime, fullName, plural } from '../utils/format'

const STATUSES = { pending: 'Pending', paid: 'Paid', cancelled: 'Cancelled' }
const METHODS = ['Cash', 'Card', 'Mobile banking', 'Insurance', 'Cheque', 'Other']
const EMPTY = { patient_id: '', appointment_id: '', amount: '', payment_status: 'pending', payment_method: '' }
const AMOUNT = /^\d{1,8}(\.\d{1,2})?$/

export default function Bills() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('bills:write')
  const canDelete = can('bills:delete')
  const { data, loading, error, reload } = useAsync(() => Promise.all([
    billsApi.listAll(),
    can('patients:read') ? optional(patientsApi.listAll()) : [],
    can('appointments:read') ? optional(appointmentsApi.listAll()) : [],
    billsApi.summary(),
  ]), [])
  const [bills, patients, appointments, summary] = data ?? [[], [], [], null]
  const patientById = useMemo(() => Object.fromEntries(patients.map((p) => [p.patient_id, p])), [patients])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  const billed = useMemo(() => new Set(bills.map((b) => b.appointment_id)), [bills])
  const billable = appointments.filter((a) =>
    String(a.patient_id) === form.values.patient_id && !['cancelled', 'no_show'].includes(a.status) && !billed.has(a.appointment_id))

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...bills]
      .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
      .filter((b) => !status || b.payment_status === status)
      .filter((b) => !q || [fullName(patientById[b.patient_id]), String(b.bill_id), String(b.appointment_id), b.payment_method]
        .some((v) => v?.toLowerCase().includes(q)))
  }, [bills, status, search, patientById])

  const totals = useMemo(() => rows.reduce((t, b) => ({ ...t, [b.payment_status]: (t[b.payment_status] ?? 0) + Number.parseFloat(b.amount) }), {}), [rows])

  function openForm(b) {
    setFormError(null)
    form.reset(b === 'new' ? EMPTY : {
      patient_id: String(b.patient_id), appointment_id: String(b.appointment_id), amount: String(b.amount),
      payment_status: b.payment_status, payment_method: b.payment_method ?? '',
    })
    setEditing(b)
  }

  async function save() {
    const v = form.values
    const e = {}
    if (editing === 'new' && !v.patient_id) e.patient_id = 'Choose a patient.'
    if (editing === 'new' && !v.appointment_id) e.appointment_id = 'Choose an appointment.'
    if (!AMOUNT.test(v.amount)) e.amount = 'Enter an amount such as 120.00.'
    form.setErrors(e)
    if (Object.keys(e).length) return
    const common = { amount: v.amount, payment_status: v.payment_status, payment_method: v.payment_method || null }
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') {
        await billsApi.create({ ...common, patient_id: Number(v.patient_id), appointment_id: Number(v.appointment_id) })
        notify('Bill issued.')
      } else {
        await billsApi.update(editing.bill_id, common)
        notify('Bill updated.')
      }
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(form.applyServerErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    setFormError(null)
    try {
      await billsApi.remove(deleting.bill_id)
      setDeleting(null)
      notify('Bill deleted.')
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Bills" description="One bill per appointment. Marking a bill paid records the payment time."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>Issue bill</Button>} />
      <PaymentReturnNotice onConfirmed={reload} />
      {summary && <PendingReminder summary={summary} />}
      {!loading && !error && bills.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(STATUSES).map(([k, label]) => (
            <div key={k} className="rounded-lg border border-ink-100 bg-surface px-4 py-3.5">
              <p className="text-xs text-ink-500">{label}{status || search ? ' (filtered)' : ''}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totals[k] ?? 0)}</p>
            </div>
          ))}
        </div>
      )}
      {summary && (
        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <PendingPayments summary={summary} canPay={canWrite} />
          <FullyPaid summary={summary} />
        </div>
      )}
      <Panel title="All bills">
        <Toolbar count={!loading && !error ? plural(rows.length, 'bill') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Patient, bill # or appointment #" className="sm:w-80" />
          <FilterSelect label="Payment status" value={status} onChange={setStatus}>
            <option value="">Any status</option>
            {Object.entries(STATUSES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </FilterSelect>
        </Toolbar>
        <DataTable
          caption="Bills" loading={loading} error={error} onRetry={reload} rows={rows} rowKey={(b) => b.bill_id}
          empty={<EmptyState icon={RiBillLine} title="No bills found" />}
          columns={[
            { key: 'patient', header: 'Patient', primary: true, render: (b) => (
              <span><span className="block font-medium text-ink-900">{fullName(patientById[b.patient_id]) || `Patient #${b.patient_id}`}</span>
                <span className="block text-xs text-ink-500">Bill #{b.bill_id} · appt #{b.appointment_id}</span></span>
            ) },
            { key: 'issued', header: 'Issued', render: (b) => formatDate(b.issued_at) },
            { key: 'status', header: 'Status', render: (b) => <StatusBadge type="payment" value={b.payment_status} /> },
            { key: 'method', header: 'Method', hideOnMobile: true, render: (b) => b.payment_method ?? '—' },
            { key: 'amount', header: 'Amount', align: 'right', render: (b) => <span className="font-medium">{formatCurrency(b.amount)}</span> },
          ]}
          actions={(canWrite || canDelete) ? (b) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit bill #${b.bill_id}`} onClick={() => openForm(b)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Delete bill #${b.bill_id}`} onClick={() => { setFormError(null); setDeleting(b) }} />}
            </>
          ) : undefined}
        />
      </Panel>

      <FormModal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Issue bill' : `Edit bill #${editing?.bill_id}`}
        onSubmit={save} busy={busy} error={formError} submitLabel={editing === 'new' ? 'Issue bill' : 'Save changes'}>
        {editing === 'new' && (
          <FieldGrid>
            <Select label="Patient" required {...form.bind('patient_id')} onChange={(e) => { form.set('patient_id', e.target.value); form.set('appointment_id', '') }}>
              <option value="">Select a patient…</option>
              {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{fullName(p)} · #{p.patient_id}</option>)}
            </Select>
            <Select label="Appointment" required {...form.bind('appointment_id')} disabled={!form.values.patient_id}
              hint={form.values.patient_id && !billable.length ? 'This patient has no unbilled appointments.' : undefined}>
              <option value="">Select an appointment…</option>
              {billable.map((a) => <option key={a.appointment_id} value={a.appointment_id}>{formatDate(a.appointment_date)} {formatTime(a.appointment_time)} · #{a.appointment_id}</option>)}
            </Select>
          </FieldGrid>
        )}
        <FieldGrid>
          <Input label="Amount" required inputMode="decimal" {...form.bind('amount')} />
          <Select label="Payment status" {...form.bind('payment_status')}>
            {Object.entries(STATUSES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Select label="Payment method" {...form.bind('payment_method')}>
            <option value="">Not recorded</option>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
            {form.values.payment_method && !METHODS.includes(form.values.payment_method) && <option>{form.values.payment_method}</option>}
          </Select>
        </FieldGrid>
      </FormModal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete bill #${deleting?.bill_id}?`}
        message={`${formatCurrency(deleting?.amount)} for appointment #${deleting?.appointment_id} will be removed permanently. To void a bill but keep a record, set its status to Cancelled instead.`}
        confirmLabel="Delete bill" danger loading={busy} error={formError} />
    </>
  )
}
