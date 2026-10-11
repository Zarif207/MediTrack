import { useState, useEffect, useCallback } from 'react'
import { medicalRecordsApi, appointmentsApi, patientsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import { formatDateTime, truncate } from '../utils/format'
import {
  RiFileList3Line, RiAddLine, RiSearchLine, RiEditLine,
  RiDeleteBinLine, RiEyeLine, RiCloseLine,
} from 'react-icons/ri'

const EMPTY_FORM = { appointment_id: '', diagnosis: '', symptoms: '', treatment_notes: '' }

function RecordForm({ initial, onSubmit, onCancel, loading, error, appointments, patientMap }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.appointment_id) { setErrors({ appointment_id: 'Appointment is required' }); return }
    onSubmit({
      appointment_id: Number(form.appointment_id),
      diagnosis: form.diagnosis || null,
      symptoms: form.symptoms || null,
      treatment_notes: form.treatment_notes || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <Select label="Appointment" required value={form.appointment_id} onChange={(e) => set('appointment_id', e.target.value)} error={errors.appointment_id}>
        <option value="">Select appointment…</option>
        {appointments.map((a) => (
          <option key={a.appointment_id} value={a.appointment_id}>
            #{a.appointment_id} — {patientMap[a.patient_id] ?? `Patient #${a.patient_id}`} — {a.appointment_date}
          </option>
        ))}
      </Select>
      <Input label="Diagnosis" type="textarea" value={form.diagnosis ?? ''} onChange={(e) => set('diagnosis', e.target.value)} placeholder="Clinical diagnosis…" />
      <Input label="Symptoms" type="textarea" value={form.symptoms ?? ''} onChange={(e) => set('symptoms', e.target.value)} placeholder="Presenting symptoms…" />
      <Input label="Treatment Notes" type="textarea" value={form.treatment_notes ?? ''} onChange={(e) => set('treatment_notes', e.target.value)} placeholder="Treatment plan, notes…" />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Record</Button>
      </div>
    </form>
  )
}

function RecordDetail({ record, apptMap, patientMap, onEdit, onClose }) {
  const appt = apptMap[record.appointment_id]
  const row = (label, val) => (
    <div key={label} className="flex flex-col gap-1 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800 whitespace-pre-wrap">{val ?? '—'}</span>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-blue-200 flex items-center justify-center text-blue-700">
          <RiFileList3Line size={18} />
        </div>
        <div>
          <p className="font-bold text-gray-900">Record #{record.record_id}</p>
          <p className="text-xs text-gray-500">
            Appt #{record.appointment_id}
            {appt && patientMap[appt.patient_id] ? ` · ${patientMap[appt.patient_id]}` : ''}
          </p>
        </div>
      </div>
      {row('Diagnosis', record.diagnosis)}
      {row('Symptoms', record.symptoms)}
      {row('Treatment Notes', record.treatment_notes)}
      {row('Record Date', formatDateTime(record.record_date))}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} icon={<RiCloseLine size={15} />}>Close</Button>
        <Button onClick={onEdit} icon={<RiEditLine size={15} />}>Edit</Button>
      </div>
    </div>
  )
}

export default function MedicalRecords() {
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

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [recs, appts, pts] = await Promise.all([
        medicalRecordsApi.list({ limit: 100 }),
        appointmentsApi.list({ limit: 100 }),
        patientsApi.list({ limit: 100 }),
      ])
      setRecords(recs); setAppointments(appts); setPatients(pts)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = records.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (r.diagnosis ?? '').toLowerCase().includes(q)
      || (r.symptoms ?? '').toLowerCase().includes(q)
      || String(r.record_id).includes(q)
      || String(r.appointment_id).includes(q)
  })

  async function handleCreate(payload) {
    try { setSaving(true); setFormError(null); await medicalRecordsApi.create(payload); setFormOpen(false); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleUpdate(payload) {
    // appointment_id is not updatable — strip it out before sending
    const body = { diagnosis: payload.diagnosis, symptoms: payload.symptoms, treatment_notes: payload.treatment_notes }
    try { setSaving(true); setFormError(null); await medicalRecordsApi.update(editTarget.record_id, body); setEditTarget(null); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleDelete() {
    try { setDeleting(true); await medicalRecordsApi.delete(deleteTarget.record_id); setDeleteTarget(null); load() }
    catch (e) { setError(e.message) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search by diagnosis, symptoms, or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>Add Record</Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiFileList3Line size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState icon={<RiFileList3Line size={28} />} title={search ? 'No matching records' : 'No medical records yet'}
            action={!search && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Add Record</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appointment / Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diagnosis</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symptoms</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const appt = apptMap[r.appointment_id]
                  return (
                    <tr key={r.record_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-400">#{r.record_id}</td>
                      <td className="px-5 py-3">
                        <p className="text-gray-700 text-xs font-mono">Appt #{r.appointment_id}</p>
                        {appt && <p className="text-xs text-gray-500">{patientMap[appt.patient_id] ?? '—'}</p>}
                      </td>
                      <td className="px-5 py-3 text-gray-600 max-w-[180px]">{truncate(r.diagnosis, 50)}</td>
                      <td className="px-5 py-3 text-gray-500 max-w-[160px]">{truncate(r.symptoms, 45)}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDateTime(r.record_date)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewTarget(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><RiEyeLine size={15} /></button>
                          <button onClick={() => { setFormError(null); setEditTarget(r) }} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit"><RiEditLine size={15} /></button>
                          <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><RiDeleteBinLine size={15} /></button>
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add Medical Record" size="lg">
        <RecordForm appointments={appointments} patientMap={patientMap} onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Medical Record" size="lg">
        {editTarget && <RecordForm
          appointments={appointments} patientMap={patientMap}
          initial={{ appointment_id: String(editTarget.appointment_id), diagnosis: editTarget.diagnosis ?? '', symptoms: editTarget.symptoms ?? '', treatment_notes: editTarget.treatment_notes ?? '' }}
          onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving} error={formError} />}
      </Modal>
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Medical Record Details">
        {viewTarget && <RecordDetail record={viewTarget} apptMap={apptMap} patientMap={patientMap}
          onEdit={() => { setFormError(null); setEditTarget(viewTarget); setViewTarget(null) }}
          onClose={() => setViewTarget(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Medical Record" danger loading={deleting}
        message={`Delete medical record #${deleteTarget?.record_id}? This cannot be undone.`}
        confirmLabel="Delete" />
    </div>
  )
}
