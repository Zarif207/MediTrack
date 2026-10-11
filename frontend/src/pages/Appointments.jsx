import { useState, useEffect, useCallback } from 'react'
import { appointmentsApi, patientsApi, doctorsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import StatusBadge from '../components/ui/StatusBadge'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import { formatDate, formatTime, formatDateTime } from '../utils/format'
import {
  RiCalendarCheckLine, RiAddLine, RiSearchLine, RiEditLine,
  RiDeleteBinLine, RiEyeLine, RiCloseLine, RiFilterLine,
} from 'react-icons/ri'

const STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']
const EMPTY_FORM = {
  patient_id: '', doctor_id: '', appointment_date: '',
  appointment_time: '', status: 'scheduled', reason: '',
}

function AppointmentForm({ initial, onSubmit, onCancel, loading, error, patients, doctors }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function validate() {
    const e = {}
    if (!form.patient_id) e.patient_id = 'Patient is required'
    if (!form.doctor_id) e.doctor_id = 'Doctor is required'
    if (!form.appointment_date) e.appointment_date = 'Date is required'
    if (!form.appointment_time) e.appointment_time = 'Time is required'
    setErrors(e); return !Object.keys(e).length
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    onSubmit({
      patient_id: Number(form.patient_id),
      doctor_id: Number(form.doctor_id),
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time + ':00',
      status: form.status,
      reason: form.reason || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <div className="grid sm:grid-cols-2 gap-4">
        <Select label="Patient" required value={form.patient_id} onChange={(e) => set('patient_id', e.target.value)} error={errors.patient_id}>
          <option value="">Select patient…</option>
          {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.first_name} {p.last_name}</option>)}
        </Select>
        <Select label="Doctor" required value={form.doctor_id} onChange={(e) => set('doctor_id', e.target.value)} error={errors.doctor_id}>
          <option value="">Select doctor…</option>
          {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name}</option>)}
        </Select>
        <Input label="Date" type="date" required value={form.appointment_date} onChange={(e) => set('appointment_date', e.target.value)} error={errors.appointment_date} />
        <Input label="Time" type="time" required value={form.appointment_time} onChange={(e) => set('appointment_time', e.target.value)} error={errors.appointment_time} />
        <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </Select>
      </div>
      <Input label="Reason" type="textarea" value={form.reason ?? ''} onChange={(e) => set('reason', e.target.value)} placeholder="Reason for appointment…" />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Appointment</Button>
      </div>
    </form>
  )
}

function AppointmentDetail({ appt, patientMap, doctorMap, onEdit, onClose }) {
  const row = (label, val) => (
    <div key={label} className="flex flex-col sm:flex-row gap-1 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 sm:w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-800">{val ?? '—'}</span>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-indigo-200 flex items-center justify-center text-indigo-700">
          <RiCalendarCheckLine size={18} />
        </div>
        <div>
          <p className="font-bold text-gray-900">Appointment #{appt.appointment_id}</p>
          <StatusBadge value={appt.status} />
        </div>
      </div>
      <div>
        {row('Patient', patientMap[appt.patient_id] ?? `#${appt.patient_id}`)}
        {row('Doctor', doctorMap[appt.doctor_id] ?? `#${appt.doctor_id}`)}
        {row('Date', formatDate(appt.appointment_date))}
        {row('Time', formatTime(appt.appointment_time))}
        {row('Reason', appt.reason)}
        {row('Created', formatDateTime(appt.created_at))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} icon={<RiCloseLine size={15} />}>Close</Button>
        <Button onClick={onEdit} icon={<RiEditLine size={15} />}>Edit</Button>
      </div>
    </div>
  )
}

export default function Appointments() {
  const [appts, setAppts] = useState([])
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
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
  const doctorMap = Object.fromEntries(doctors.map((d) => [d.doctor_id, `Dr. ${d.first_name} ${d.last_name}`]))

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = { limit: 100 }
      if (statusFilter) params.appointment_status = statusFilter
      const [apptData, ptData, drData] = await Promise.all([
        appointmentsApi.list(params),
        patientsApi.list({ limit: 100 }),
        doctorsApi.list({ limit: 100 }),
      ])
      setAppts(apptData); setPatients(ptData); setDoctors(drData)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = appts.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (patientMap[a.patient_id] ?? '').toLowerCase().includes(q)
      || (doctorMap[a.doctor_id] ?? '').toLowerCase().includes(q)
      || (a.reason ?? '').toLowerCase().includes(q)
      || String(a.appointment_id).includes(q)
  })

  async function handleCreate(payload) {
    try { setSaving(true); setFormError(null); await appointmentsApi.create(payload); setFormOpen(false); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleUpdate(payload) {
    try { setSaving(true); setFormError(null); await appointmentsApi.update(editTarget.appointment_id, payload); setEditTarget(null); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleDelete() {
    try { setDeleting(true); await appointmentsApi.delete(deleteTarget.appointment_id); setDeleteTarget(null); load() }
    catch (e) { setError(e.message) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search by patient, doctor, or reason…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <RiFilterLine size={14} className="text-gray-400 shrink-0" />
          <select
            className="py-2 pl-3 pr-8 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>Schedule</Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiCalendarCheckLine size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} appointment${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState icon={<RiCalendarCheckLine size={28} />} title={search || statusFilter ? 'No matching appointments' : 'No appointments yet'}
            action={!search && !statusFilter && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Schedule Appointment</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => (
                  <tr key={a.appointment_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{a.appointment_id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{patientMap[a.patient_id] ?? `#${a.patient_id}`}</td>
                    <td className="px-4 py-3 text-gray-600">{doctorMap[a.doctor_id] ?? `#${a.doctor_id}`}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{formatDate(a.appointment_date)}</p>
                      <p className="text-xs text-gray-400">{formatTime(a.appointment_time)}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge value={a.status} /></td>
                    <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{a.reason ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewTarget(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><RiEyeLine size={15} /></button>
                        <button onClick={() => { setFormError(null); setEditTarget(a) }} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit"><RiEditLine size={15} /></button>
                        <button onClick={() => setDeleteTarget(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><RiDeleteBinLine size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Schedule Appointment" size="lg">
        <AppointmentForm patients={patients} doctors={doctors} onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Appointment" size="lg">
        {editTarget && <AppointmentForm
          patients={patients} doctors={doctors}
          initial={{
            patient_id: String(editTarget.patient_id),
            doctor_id: String(editTarget.doctor_id),
            appointment_date: editTarget.appointment_date,
            appointment_time: editTarget.appointment_time.slice(0, 5),
            status: editTarget.status,
            reason: editTarget.reason ?? '',
          }}
          onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving} error={formError} />}
      </Modal>
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Appointment Details">
        {viewTarget && <AppointmentDetail appt={viewTarget} patientMap={patientMap} doctorMap={doctorMap}
          onEdit={() => { setFormError(null); setEditTarget(viewTarget); setViewTarget(null) }}
          onClose={() => setViewTarget(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Appointment" danger loading={deleting}
        message={`Delete appointment #${deleteTarget?.appointment_id}? This cannot be undone.`}
        confirmLabel="Delete" />
    </div>
  )
}
