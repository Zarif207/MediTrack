import { useState, useEffect, useCallback } from 'react'
import { patientsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import { formatDate, formatDateTime, calcAge } from '../utils/format'
import {
  RiUserHeartLine,
  RiAddLine,
  RiSearchLine,
  RiEditLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiCloseLine,
} from 'react-icons/ri'

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const EMPTY_FORM = {
  first_name: '', last_name: '', date_of_birth: '', gender: '',
  phone: '', email: '', address: '', blood_group: '', emergency_contact: '',
}

function PatientForm({ initial, onSubmit, onCancel, loading, error }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function validate() {
    const e = {}
    if (!form.first_name.trim()) e.first_name = 'First name is required'
    if (!form.last_name.trim()) e.last_name = 'Last name is required'
    if (!form.date_of_birth) e.date_of_birth = 'Date of birth is required'
    if (!form.gender) e.gender = 'Gender is required'
    if (!form.phone.trim()) e.phone = 'Phone is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const payload = { ...form }
    // strip empty optionals
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null })
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="First Name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} />
        <Input label="Last Name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} />
        <Input label="Date of Birth" type="date" required value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} error={errors.date_of_birth} />
        <Select label="Gender" required value={form.gender} onChange={(e) => set('gender', e.target.value)} error={errors.gender}>
          <option value="">Select gender…</option>
          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
        <Input label="Phone" required value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="+880-XXX-XXXXXXX" />
        <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} error={errors.email} />
        <Select label="Blood Group" value={form.blood_group ?? ''} onChange={(e) => set('blood_group', e.target.value)}>
          <option value="">Unknown</option>
          {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
        <Input label="Emergency Contact" value={form.emergency_contact ?? ''} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="Phone number" />
      </div>
      <Input label="Address" type="textarea" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Patient</Button>
      </div>
    </form>
  )
}

function PatientDetail({ patient, onEdit, onClose }) {
  const row = (label, value) => (
    <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 sm:w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-800">{value ?? '—'}</span>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-navy-50 rounded-xl">
        <div className="w-14 h-14 rounded-full bg-navy-200 flex items-center justify-center text-navy-700 font-bold text-xl">
          {patient.first_name[0]}{patient.last_name[0]}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">{patient.first_name} {patient.last_name}</p>
          <p className="text-sm text-gray-500">Patient ID: #{patient.patient_id}</p>
        </div>
      </div>
      <div>
        {row('Date of Birth', `${formatDate(patient.date_of_birth)} (Age ${calcAge(patient.date_of_birth)})`)}
        {row('Gender', patient.gender)}
        {row('Phone', patient.phone)}
        {row('Email', patient.email)}
        {row('Blood Group', patient.blood_group)}
        {row('Emergency Contact', patient.emergency_contact)}
        {row('Address', patient.address)}
        {row('Registered At', formatDateTime(patient.registered_at))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} icon={<RiCloseLine size={15} />}>Close</Button>
        <Button onClick={onEdit} icon={<RiEditLine size={15} />}>Edit</Button>
      </div>
    </div>
  )
}

export default function Patients() {
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

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const data = await patientsApi.list({ limit: 100 })
      setPatients(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = patients.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
      || p.phone.includes(q)
      || (p.email ?? '').toLowerCase().includes(q)
  })

  async function handleCreate(payload) {
    try {
      setSaving(true); setFormError(null)
      await patientsApi.create(payload)
      setFormOpen(false)
      load()
    } catch (e) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  async function handleUpdate(payload) {
    try {
      setSaving(true); setFormError(null)
      await patientsApi.update(editTarget.patient_id, payload)
      setEditTarget(null)
      load()
    } catch (e) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    try {
      setDeleting(true)
      await patientsApi.delete(deleteTarget.patient_id)
      setDeleteTarget(null)
      load()
    } catch (e) { setError(e.message) }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search patients by name, phone, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>
          Add Patient
        </Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiUserHeartLine size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} patient${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<RiUserHeartLine size={28} />}
            title={search ? 'No matching patients' : 'No patients yet'}
            description={search ? 'Try a different search term.' : 'Add the first patient to get started.'}
            action={!search && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Add Patient</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age / Gender</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blood Group</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.patient_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">#{p.patient_id}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-semibold text-xs shrink-0">
                          {p.first_name[0]}{p.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-gray-400">{p.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{calcAge(p.date_of_birth)} yr · {p.gender}</td>
                    <td className="px-5 py-3 text-gray-600">{p.phone}</td>
                    <td className="px-5 py-3">
                      {p.blood_group
                        ? <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-xs font-medium">{p.blood_group}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(p.registered_at)}</td>
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

      {/* Add modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add New Patient" size="lg">
        <PatientForm onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Patient" size="lg">
        {editTarget && (
          <PatientForm
            initial={{ ...editTarget, date_of_birth: editTarget.date_of_birth, blood_group: editTarget.blood_group ?? '', email: editTarget.email ?? '', address: editTarget.address ?? '', emergency_contact: editTarget.emergency_contact ?? '' }}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            loading={saving}
            error={formError}
          />
        )}
      </Modal>

      {/* View modal */}
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Patient Details" size="md">
        {viewTarget && (
          <PatientDetail
            patient={viewTarget}
            onEdit={() => { setFormError(null); setEditTarget(viewTarget); setViewTarget(null) }}
            onClose={() => setViewTarget(null)}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Patient"
        message={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  )
}
