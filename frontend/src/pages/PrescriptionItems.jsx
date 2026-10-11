import { useState, useEffect, useCallback } from 'react'
import {
  prescriptionItemsApi, prescriptionsApi, medicinesApi,
  medicalRecordsApi, appointmentsApi, patientsApi,
} from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import { RiListCheck3, RiAddLine, RiSearchLine, RiEditLine, RiDeleteBinLine, RiEyeLine, RiCloseLine } from 'react-icons/ri'

const EMPTY_FORM = {
  prescription_id: '', medicine_id: '',
  dosage: '', frequency: '', duration: '', quantity: '',
}

function ItemForm({ initial, onSubmit, onCancel, loading, error, prescriptions, medicines, patientForPrescription }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }
  const isEdit = !!initial?.prescription_item_id

  function validate() {
    const e = {}
    if (!form.prescription_id) e.prescription_id = 'Prescription is required'
    if (!form.medicine_id) e.medicine_id = 'Medicine is required'
    if (!form.dosage.trim()) e.dosage = 'Dosage is required'
    if (!form.frequency.trim()) e.frequency = 'Frequency is required'
    if (!form.duration.trim()) e.duration = 'Duration is required'
    if (!form.quantity || Number(form.quantity) < 1) e.quantity = 'Quantity must be ≥ 1'
    setErrors(e); return !Object.keys(e).length
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const payload = {
      prescription_id: Number(form.prescription_id),
      medicine_id: Number(form.medicine_id),
      dosage: form.dosage,
      frequency: form.frequency,
      duration: form.duration,
      quantity: Number(form.quantity),
    }
    if (isEdit) {
      // prescription_id and medicine_id are not updatable — send only editable fields
      const updateFields = { dosage: payload.dosage, frequency: payload.frequency, duration: payload.duration, quantity: payload.quantity }
      onSubmit(updateFields)
    } else {
      onSubmit(payload)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <Select label="Prescription" required value={form.prescription_id} onChange={(e) => set('prescription_id', e.target.value)} error={errors.prescription_id} disabled={isEdit}>
        <option value="">Select prescription…</option>
        {prescriptions.map((p) => <option key={p.prescription_id} value={p.prescription_id}>#{p.prescription_id} — {patientForPrescription(p)}</option>)}
      </Select>
      <Select label="Medicine" required value={form.medicine_id} onChange={(e) => set('medicine_id', e.target.value)} error={errors.medicine_id} disabled={isEdit}>
        <option value="">Select medicine…</option>
        {medicines.map((m) => <option key={m.medicine_id} value={m.medicine_id}>{m.medicine_name} ({m.strength})</option>)}
      </Select>
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Dosage" required value={form.dosage} onChange={(e) => set('dosage', e.target.value)} error={errors.dosage} placeholder="e.g. 1 tablet" />
        <Input label="Frequency" required value={form.frequency} onChange={(e) => set('frequency', e.target.value)} error={errors.frequency} placeholder="e.g. Twice daily" />
        <Input label="Duration" required value={form.duration} onChange={(e) => set('duration', e.target.value)} error={errors.duration} placeholder="e.g. 7 days" />
        <Input label="Quantity" type="number" required value={form.quantity} onChange={(e) => set('quantity', e.target.value)} error={errors.quantity} min="1" step="1" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Item</Button>
      </div>
    </form>
  )
}

export default function PrescriptionItems() {
  const [items, setItems] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [medicines, setMedicines] = useState([])
  const [records, setRecords] = useState([])
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const medMap = Object.fromEntries(medicines.map((m) => [m.medicine_id, m]))
  const recordMap = Object.fromEntries(records.map((r) => [r.record_id, r]))
  const apptMap = Object.fromEntries(appointments.map((a) => [a.appointment_id, a]))
  const patientMap = Object.fromEntries(patients.map((p) => [p.patient_id, `${p.first_name} ${p.last_name}`]))

  function patientForPrescription(pres) {
    const rec = recordMap[pres.record_id]
    if (!rec) return '—'
    const appt = apptMap[rec.appointment_id]
    return appt ? (patientMap[appt.patient_id] ?? '—') : '—'
  }

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [itms, pres, meds, recs, appts, pts] = await Promise.all([
        prescriptionItemsApi.list({ limit: 100 }),
        prescriptionsApi.list({ limit: 100 }),
        medicinesApi.list({ limit: 100 }),
        medicalRecordsApi.list({ limit: 100 }),
        appointmentsApi.list({ limit: 100 }),
        patientsApi.list({ limit: 100 }),
      ])
      setItems(itms); setPrescriptions(pres); setMedicines(meds)
      setRecords(recs); setAppointments(appts); setPatients(pts)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const presMap = Object.fromEntries(prescriptions.map((p) => [p.prescription_id, p]))

  const filtered = items.filter((i) => {
    if (!search) return true
    const q = search.toLowerCase()
    const medName = (medMap[i.medicine_id]?.medicine_name ?? '').toLowerCase()
    return medName.includes(q)
      || String(i.prescription_id).includes(q)
      || i.dosage.toLowerCase().includes(q)
  })

  async function handleCreate(payload) {
    try { setSaving(true); setFormError(null); await prescriptionItemsApi.create(payload); setFormOpen(false); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleUpdate(payload) {
    try { setSaving(true); setFormError(null); await prescriptionItemsApi.update(editTarget.prescription_item_id, payload); setEditTarget(null); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleDelete() {
    try { setDeleting(true); await prescriptionItemsApi.delete(deleteTarget.prescription_item_id); setDeleteTarget(null); load() }
    catch (e) { setError(e.message) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search by medicine or prescription…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>Add Item</Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiListCheck3 size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} prescription item${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState icon={<RiListCheck3 size={28} />} title={search ? 'No matching items' : 'No prescription items yet'}
            action={!search && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Add Item</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prescription / Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dosage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => {
                  const med = medMap[item.medicine_id]
                  const pres = presMap[item.prescription_id]
                  const patient = pres ? patientForPrescription(pres) : '—'
                  return (
                    <tr key={item.prescription_item_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">#{item.prescription_item_id}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-gray-500">Rx #{item.prescription_id}</p>
                        <p className="text-xs text-gray-400">{patient}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{med?.medicine_name ?? `#${item.medicine_id}`}</p>
                        {med && <p className="text-xs text-gray-400">{med.strength} · {med.dosage_form}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.dosage}</td>
                      <td className="px-4 py-3 text-gray-600">{item.frequency}</td>
                      <td className="px-4 py-3 text-gray-600">{item.duration}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewTarget(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><RiEyeLine size={15} /></button>
                          <button onClick={() => { setFormError(null); setEditTarget(item) }} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit"><RiEditLine size={15} /></button>
                          <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><RiDeleteBinLine size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add Prescription Item" size="lg">
        <ItemForm prescriptions={prescriptions} medicines={medicines} patientForPrescription={patientForPrescription}
          onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Prescription Item" size="lg">
        {editTarget && <ItemForm
          prescriptions={prescriptions} medicines={medicines} patientForPrescription={patientForPrescription}
          initial={{ ...editTarget, prescription_id: String(editTarget.prescription_id), medicine_id: String(editTarget.medicine_id), quantity: String(editTarget.quantity) }}
          onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving} error={formError} />}
      </Modal>
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Prescription Item Details">
        {viewTarget && (() => {
          const med = medMap[viewTarget.medicine_id]
          const pres = presMap[viewTarget.prescription_id]
          return (
            <div className="space-y-3">
              {[
                ['Item ID', `#${viewTarget.prescription_item_id}`],
                ['Prescription', `#${viewTarget.prescription_id}${pres ? ` — ${patientForPrescription(pres)}` : ''}`],
                ['Medicine', med ? `${med.medicine_name} (${med.strength}, ${med.dosage_form})` : `#${viewTarget.medicine_id}`],
                ['Dosage', viewTarget.dosage],
                ['Frequency', viewTarget.frequency],
                ['Duration', viewTarget.duration],
                ['Quantity', viewTarget.quantity],
              ].map(([label, val]) => (
                <div key={label} className="flex flex-col sm:flex-row gap-1 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs font-medium text-gray-500 sm:w-32 shrink-0">{label}</span>
                  <span className="text-sm text-gray-800">{val ?? '—'}</span>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setViewTarget(null)} icon={<RiCloseLine size={15} />}>Close</Button>
                <Button onClick={() => { setFormError(null); setEditTarget(viewTarget); setViewTarget(null) }} icon={<RiEditLine size={15} />}>Edit</Button>
              </div>
            </div>
          )
        })()}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Prescription Item" danger loading={deleting}
        message={`Delete item #${deleteTarget?.prescription_item_id}? This cannot be undone.`}
        confirmLabel="Delete" />
    </div>
  )
}
