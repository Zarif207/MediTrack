import { useState, useEffect, useCallback } from 'react'
import { prescriptionsApi, medicalRecordsApi, appointmentsApi, patientsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import { formatDateTime } from '../utils/format'
import {
  RiCapsuleLine, RiAddLine, RiSearchLine,
  RiEditLine, RiDeleteBinLine, RiEyeLine, RiCloseLine,
} from 'react-icons/ri'

const EMPTY_FORM = { record_id: '', instructions: '' }

function PrescForm({ initial, onSubmit, onCancel, loading, error, records, patientMap, apptMap }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.record_id) { setErrors({ record_id: 'Medical record is required' }); return }
    onSubmit({ record_id: Number(form.record_id), instructions: form.instructions || null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <Select label="Medical Record" required value={form.record_id} onChange={(e) => set('record_id', e.target.value)} error={errors.record_id}>
        <option value="">Select medical record…</option>
        {records.map((r) => {
          const appt = apptMap[r.appointment_id]
          const patient = appt ? (patientMap[appt.patient_id] ?? `Patient #${appt.patient_id}`) : `Appt #${r.appointment_id}`
          return <option key={r.record_id} value={r.record_id}>#{r.record_id} — {patient}{r.diagnosis ? ` — ${r.diagnosis.slice(0,30)}` : ''}</option>
        })}
      </Select>
      <Input label="Instructions" type="textarea" value={form.instructions ?? ''} onChange={(e) => set('instructions', e.target.value)} placeholder="Dosage instructions, special notes…" />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Prescription</Button>
      </div>
    </form>
  )
}

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([])
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

  const patientMap = Object.fromEntries(patients.map((p) => [p.patient_id, `${p.first_name} ${p.last_name}`]))
  const apptMap = Object.fromEntries(appointments.map((a) => [a.appointment_id, a]))
  const recordMap = Object.fromEntries(records.map((r) => [r.record_id, r]))

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [pres, recs, appts, pts] = await Promise.all([
        prescriptionsApi.list({ limit: 100 }),
        medicalRecordsApi.list({ limit: 100 }),
        appointmentsApi.list({ limit: 100 }),
        patientsApi.list({ limit: 100 }),
      ])
      setPrescriptions(pres); setRecords(recs); setAppointments(appts); setPatients(pts)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = prescriptions.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return String(p.prescription_id).includes(q)
      || String(p.record_id).includes(q)
      || (p.instructions ?? '').toLowerCase().includes(q)
  })

  function patientForPrescription(p) {
    const rec = recordMap[p.record_id]
    if (!rec) return '—'
    const appt = apptMap[rec.appointment_id]
    if (!appt) return '—'
    return patientMap[appt.patient_id] ?? '—'
  }

  async function handleCreate(payload) {
    try { setSaving(true); setFormError(null); await prescriptionsApi.create(payload); setFormOpen(false); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleUpdate(payload) {
    try { setSaving(true); setFormError(null); await prescriptionsApi.update(editTarget.prescription_id, { instructions: payload.instructions }); setEditTarget(null); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleDelete() {
    try { setDeleting(true); await prescriptionsApi.delete(deleteTarget.prescription_id); setDeleteTarget(null); load() }
    catch (e) { setError(e.message) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search by prescription ID, record, or instructions…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>Add Prescription</Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiCapsuleLine size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} prescription${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState icon={<RiCapsuleLine size={28} />} title={search ? 'No matching prescriptions' : 'No prescriptions yet'}
            action={!search && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Add Prescription</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-160">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Record / Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructions</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.prescription_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">#{p.prescription_id}</td>
                    <td className="px-5 py-3">
                      <p className="text-gray-700 text-xs font-mono">Rec #{p.record_id}</p>
                      <p className="text-xs text-gray-500">{patientForPrescription(p)}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-50 truncate">{p.instructions ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{formatDateTime(p.prescription_date)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewTarget(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><RiEyeLine size={15} /></button>
                        <button onClick={() => { setFormError(null); setEditTarget(p) }} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit"><RiEditLine size={15} /></button>
                        <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><RiDeleteBinLine size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add Prescription" size="md">
        <PrescForm records={records} patientMap={patientMap} apptMap={apptMap} onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Prescription" size="md">
        {editTarget && <PrescForm records={records} patientMap={patientMap} apptMap={apptMap}
          initial={{ record_id: String(editTarget.record_id), instructions: editTarget.instructions ?? '' }}
          onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving} error={formError} />}
      </Modal>
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Prescription Details">
        {viewTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center text-purple-700">
                <RiCapsuleLine size={18} />
              </div>
              <div>
                <p className="font-bold text-gray-900">Prescription #{viewTarget.prescription_id}</p>
                <p className="text-xs text-gray-500">{patientForPrescription(viewTarget)}</p>
              </div>
            </div>
            <div>
              {[
                ['Medical Record', `#${viewTarget.record_id}`],
                ['Instructions', viewTarget.instructions ?? '—'],
                ['Date Issued', formatDateTime(viewTarget.prescription_date)],
              ].map(([label, val]) => (
                <div key={label} className="flex flex-col gap-1 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs font-medium text-gray-500">{label}</span>
                  <span className="text-sm text-gray-800 whitespace-pre-wrap">{val}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setViewTarget(null)} icon={<RiCloseLine size={15} />}>Close</Button>
              <Button onClick={() => { setFormError(null); setEditTarget(viewTarget); setViewTarget(null) }} icon={<RiEditLine size={15} />}>Edit</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Prescription" danger loading={deleting}
        message={`Delete prescription #${deleteTarget?.prescription_id}? This cannot be undone.`}
        confirmLabel="Delete" />
    </div>
  )
}
