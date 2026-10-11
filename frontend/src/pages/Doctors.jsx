import { useState, useEffect, useCallback } from 'react'
import { doctorsApi, departmentsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import {
  RiUserStarLine, RiAddLine, RiSearchLine, RiEditLine,
  RiDeleteBinLine, RiEyeLine, RiCloseLine,
} from 'react-icons/ri'

const EMPTY_FORM = {
  department_id: '', first_name: '', last_name: '',
  specialization: '', phone: '', email: '', license_number: '',
}

function DoctorForm({ initial, onSubmit, onCancel, loading, error, departments }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function validate() {
    const e = {}
    if (!form.department_id) e.department_id = 'Department is required'
    if (!form.first_name.trim()) e.first_name = 'First name is required'
    if (!form.last_name.trim()) e.last_name = 'Last name is required'
    if (!form.specialization.trim()) e.specialization = 'Specialization is required'
    if (!form.phone.trim()) e.phone = 'Phone is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (!form.license_number.trim()) e.license_number = 'License number is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ ...form, department_id: Number(form.department_id) })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <Select label="Department" required value={form.department_id} onChange={(e) => set('department_id', e.target.value)} error={errors.department_id}>
        <option value="">Select department…</option>
        {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
      </Select>
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="First Name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} />
        <Input label="Last Name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} />
        <Input label="Specialization" required value={form.specialization} onChange={(e) => set('specialization', e.target.value)} error={errors.specialization} placeholder="e.g. Cardiologist" />
        <Input label="Phone" required value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
        <Input label="Email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
        <Input label="License Number" required value={form.license_number} onChange={(e) => set('license_number', e.target.value)} error={errors.license_number} placeholder="e.g. MD-12345" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Doctor</Button>
      </div>
    </form>
  )
}

function DoctorDetail({ doctor, deptMap, onEdit, onClose }) {
  const row = (label, val) => (
    <div key={label} className="flex flex-col sm:flex-row gap-1 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 sm:w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-800">{val ?? '—'}</span>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-xl">
        <div className="w-14 h-14 rounded-full bg-teal-200 flex items-center justify-center text-teal-700 font-bold text-xl">
          {doctor.first_name[0]}{doctor.last_name[0]}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">Dr. {doctor.first_name} {doctor.last_name}</p>
          <p className="text-sm text-teal-700">{doctor.specialization}</p>
        </div>
      </div>
      <div>
        {row('Department', deptMap[doctor.department_id] ?? `ID ${doctor.department_id}`)}
        {row('Email', doctor.email)}
        {row('Phone', doctor.phone)}
        {row('License #', doctor.license_number)}
        {row('Doctor ID', `#${doctor.doctor_id}`)}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} icon={<RiCloseLine size={15} />}>Close</Button>
        <Button onClick={onEdit} icon={<RiEditLine size={15} />}>Edit</Button>
      </div>
    </div>
  )
}

export default function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [depts, setDepts] = useState([])
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

  const deptMap = Object.fromEntries(depts.map((d) => [d.department_id, d.department_name]))

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [docData, deptData] = await Promise.all([
        doctorsApi.list({ limit: 100 }),
        departmentsApi.list({ limit: 100 }),
      ])
      setDoctors(docData); setDepts(deptData)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = doctors.filter((d) => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${d.first_name} ${d.last_name}`.toLowerCase().includes(q)
      || d.specialization.toLowerCase().includes(q)
      || d.email.toLowerCase().includes(q)
      || (deptMap[d.department_id] ?? '').toLowerCase().includes(q)
  })

  async function handleCreate(payload) {
    try { setSaving(true); setFormError(null); await doctorsApi.create(payload); setFormOpen(false); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleUpdate(payload) {
    try { setSaving(true); setFormError(null); await doctorsApi.update(editTarget.doctor_id, payload); setEditTarget(null); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleDelete() {
    try { setDeleting(true); await doctorsApi.delete(deleteTarget.doctor_id); setDeleteTarget(null); load() }
    catch (e) { setError(e.message) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search by name, specialization, or department…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>Add Doctor</Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiUserStarLine size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} doctor${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState icon={<RiUserStarLine size={28} />} title={search ? 'No matching doctors' : 'No doctors yet'}
            action={!search && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Add Doctor</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialization</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">License</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((doc) => (
                  <tr key={doc.doctor_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-xs shrink-0">
                          {doc.first_name[0]}{doc.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Dr. {doc.first_name} {doc.last_name}</p>
                          <p className="text-xs text-gray-400 font-mono">#{doc.doctor_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 bg-navy-50 text-navy-700 border border-navy-100 rounded text-xs font-medium">
                        {deptMap[doc.department_id] ?? `Dept #${doc.department_id}`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{doc.specialization}</td>
                    <td className="px-5 py-3">
                      <p className="text-gray-700">{doc.phone}</p>
                      <p className="text-xs text-gray-400">{doc.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{doc.license_number}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewTarget(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><RiEyeLine size={15} /></button>
                        <button onClick={() => { setFormError(null); setEditTarget(doc) }} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit"><RiEditLine size={15} /></button>
                        <button onClick={() => setDeleteTarget(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><RiDeleteBinLine size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add Doctor" size="lg">
        <DoctorForm departments={depts} onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Doctor" size="lg">
        {editTarget && <DoctorForm
          departments={depts}
          initial={{ ...editTarget, department_id: String(editTarget.department_id) }}
          onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving} error={formError} />}
      </Modal>
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Doctor Details">
        {viewTarget && <DoctorDetail doctor={viewTarget} deptMap={deptMap}
          onEdit={() => { setFormError(null); setEditTarget(viewTarget); setViewTarget(null) }}
          onClose={() => setViewTarget(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Doctor" danger loading={deleting}
        message={`Delete Dr. ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This cannot be undone.`}
        confirmLabel="Delete" />
    </div>
  )
}
