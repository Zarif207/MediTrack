import { useState, useEffect, useCallback } from 'react'
import { billsApi, patientsApi, appointmentsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import StatusBadge from '../components/ui/StatusBadge'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import { formatCurrency, formatDateTime } from '../utils/format'
import {
  RiMoneyDollarCircleLine, RiAddLine, RiSearchLine, RiFilterLine,
  RiEditLine, RiDeleteBinLine, RiEyeLine, RiCloseLine,
} from 'react-icons/ri'

const PAYMENT_STATUSES = ['pending', 'paid', 'cancelled']
const PAYMENT_METHODS = ['Cash', 'Card', 'Mobile Banking', 'Insurance', 'Cheque', 'Other']

const EMPTY_FORM = {
  patient_id: '', appointment_id: '', amount: '',
  payment_status: 'pending', payment_method: '',
}

function BillForm({ initial, onSubmit, onCancel, loading, error, patients, appointments }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function validate() {
    const e = {}
    if (!form.patient_id) e.patient_id = 'Patient is required'
    if (!form.appointment_id) e.appointment_id = 'Appointment is required'
    if (form.amount === '' || isNaN(Number(form.amount)) || Number(form.amount) < 0) e.amount = 'Valid amount required (≥ 0)'
    setErrors(e); return !Object.keys(e).length
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    onSubmit({
      patient_id: Number(form.patient_id),
      appointment_id: Number(form.appointment_id),
      amount: form.amount,
      payment_status: form.payment_status,
      payment_method: form.payment_method || null,
    })
  }

  // Filter appointments for the selected patient
  const patientAppts = form.patient_id
    ? appointments.filter((a) => String(a.patient_id) === String(form.patient_id))
    : appointments

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <Select label="Patient" required value={form.patient_id} onChange={(e) => { set('patient_id', e.target.value); set('appointment_id', '') }}>
        <option value="">Select patient…</option>
        {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.first_name} {p.last_name}</option>)}
      </Select>
      {errors.patient_id && <p className="text-xs text-red-600 -mt-2">{errors.patient_id}</p>}
      <Select label="Appointment" required value={form.appointment_id} onChange={(e) => set('appointment_id', e.target.value)} error={errors.appointment_id}>
        <option value="">Select appointment…</option>
        {patientAppts.map((a) => <option key={a.appointment_id} value={a.appointment_id}>#{a.appointment_id} — {a.appointment_date} ({a.status})</option>)}
      </Select>
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Amount" type="number" required value={form.amount} onChange={(e) => set('amount', e.target.value)} error={errors.amount} min="0" step="0.01" placeholder="0.00" />
        <Select label="Payment Status" value={form.payment_status} onChange={(e) => set('payment_status', e.target.value)}>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select label="Payment Method" value={form.payment_method ?? ''} onChange={(e) => set('payment_method', e.target.value)}>
          <option value="">Not specified</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Bill</Button>
      </div>
    </form>
  )
}

function BillUpdateForm({ initial, onSubmit, onCancel, loading, error }) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function handleSubmit(ev) {
    ev.preventDefault()
    if (form.amount === '' || isNaN(Number(form.amount)) || Number(form.amount) < 0) { setErrors({ amount: 'Valid amount required' }); return }
    onSubmit({ amount: form.amount, payment_status: form.payment_status, payment_method: form.payment_method || null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Amount" type="number" required value={form.amount} onChange={(e) => set('amount', e.target.value)} error={errors.amount} min="0" step="0.01" />
        <Select label="Payment Status" value={form.payment_status} onChange={(e) => set('payment_status', e.target.value)}>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select label="Payment Method" value={form.payment_method ?? ''} onChange={(e) => set('payment_method', e.target.value)}>
          <option value="">Not specified</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Update Bill</Button>
      </div>
    </form>
  )
}

export default function Bills() {
  const [bills, setBills] = useState([])
  const [patients, setPatients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const patientMap = Object.fromEntries(patients.map((p) => [p.patient_id, `${p.first_name} ${p.last_name}`]))

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = { limit: 100 }
      if (statusFilter) params.payment_status = statusFilter
      const [billData, ptData, apptData] = await Promise.all([
        billsApi.list(params),
        patientsApi.list({ limit: 100 }),
        appointmentsApi.list({ limit: 100 }),
      ])
      setBills(billData); setPatients(ptData); setAppointments(apptData)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = bills.filter((b) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (patientMap[b.patient_id] ?? '').toLowerCase().includes(q)
      || String(b.bill_id).includes(q)
      || (b.payment_method ?? '').toLowerCase().includes(q)
  })

  async function handleCreate(payload) {
    try { setSaving(true); setFormError(null); await billsApi.create(payload); setFormOpen(false); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleUpdate(payload) {
    try { setSaving(true); setFormError(null); await billsApi.update(editTarget.bill_id, payload); setEditTarget(null); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleDelete() {
    try { setDeleting(true); await billsApi.delete(deleteTarget.bill_id); setDeleteTarget(null); load() }
    catch (e) { setError(e.message) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search by patient or bill ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <RiFilterLine size={14} className="text-gray-400 shrink-0" />
          <select className="py-2 pl-3 pr-8 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>Create Bill</Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiMoneyDollarCircleLine size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} bill${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState icon={<RiMoneyDollarCircleLine size={28} />} title={search || statusFilter ? 'No matching bills' : 'No bills yet'}
            action={!search && !statusFilter && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Create Bill</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appointment</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((b) => (
                  <tr key={b.bill_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{b.bill_id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{patientMap[b.patient_id] ?? `#${b.patient_id}`}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">#{b.appointment_id}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(b.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge type="payment" value={b.payment_status} /></td>
                    <td className="px-4 py-3 text-gray-500">{b.payment_method ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(b.issued_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewTarget(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><RiEyeLine size={15} /></button>
                        <button onClick={() => { setFormError(null); setEditTarget(b) }} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit"><RiEditLine size={15} /></button>
                        <button onClick={() => setDeleteTarget(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><RiDeleteBinLine size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Create Bill" size="lg">
        <BillForm patients={patients} appointments={appointments}
          onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Update Bill">
        {editTarget && <BillUpdateForm
          initial={{ amount: String(editTarget.amount), payment_status: editTarget.payment_status, payment_method: editTarget.payment_method ?? '' }}
          onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving} error={formError} />}
      </Modal>
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Bill Details">
        {viewTarget && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center text-amber-700">
                <RiMoneyDollarCircleLine size={18} />
              </div>
              <div>
                <p className="font-bold text-gray-900">Bill #{viewTarget.bill_id}</p>
                <StatusBadge type="payment" value={viewTarget.payment_status} />
              </div>
              <p className="ml-auto text-xl font-bold text-gray-900">{formatCurrency(viewTarget.amount)}</p>
            </div>
            {[
              ['Patient', patientMap[viewTarget.patient_id] ?? `#${viewTarget.patient_id}`],
              ['Appointment', `#${viewTarget.appointment_id}`],
              ['Payment Method', viewTarget.payment_method ?? '—'],
              ['Issued At', formatDateTime(viewTarget.issued_at)],
              ['Paid At', viewTarget.paid_at ? formatDateTime(viewTarget.paid_at) : '—'],
            ].map(([label, val]) => (
              <div key={label} className="flex flex-col sm:flex-row gap-1 py-2.5 border-b border-gray-100 last:border-0">
                <span className="text-xs font-medium text-gray-500 sm:w-32 shrink-0">{label}</span>
                <span className="text-sm text-gray-800">{val}</span>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setViewTarget(null)} icon={<RiCloseLine size={15} />}>Close</Button>
              <Button onClick={() => { setFormError(null); setEditTarget(viewTarget); setViewTarget(null) }} icon={<RiEditLine size={15} />}>Edit</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Bill" danger loading={deleting}
        message={`Delete bill #${deleteTarget?.bill_id} for ${formatCurrency(deleteTarget?.amount)}? This cannot be undone.`}
        confirmLabel="Delete" />
    </div>
  )
}
