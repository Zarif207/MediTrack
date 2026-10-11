import { useState, useEffect, useCallback } from 'react'
import { departmentsApi, doctorsApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import { RiBuildingLine, RiAddLine, RiSearchLine, RiEditLine, RiDeleteBinLine, RiUserStarLine } from 'react-icons/ri'

const EMPTY_FORM = { department_name: '', description: '' }

function DeptForm({ initial, onSubmit, onCancel, loading, error }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.department_name.trim()) { setErrors({ department_name: 'Department name is required' }); return }
    const payload = { department_name: form.department_name, description: form.description || null }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <Input label="Department Name" required value={form.department_name} onChange={(e) => set('department_name', e.target.value)} error={errors.department_name} placeholder="e.g. Cardiology" />
      <Input label="Description" type="textarea" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Brief description of this department…" />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Department</Button>
      </div>
    </form>
  )
}

export default function Departments() {
  const [depts, setDepts] = useState([])
  const [docCounts, setDocCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [deptData, docData] = await Promise.all([
        departmentsApi.list({ limit: 100 }),
        doctorsApi.list({ limit: 100 }),
      ])
      setDepts(deptData)
      // Count doctors per department
      const counts = {}
      docData.forEach((d) => { counts[d.department_id] = (counts[d.department_id] ?? 0) + 1 })
      setDocCounts(counts)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = depts.filter((d) =>
    !search || d.department_name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(payload) {
    try { setSaving(true); setFormError(null); await departmentsApi.create(payload); setFormOpen(false); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleUpdate(payload) {
    try { setSaving(true); setFormError(null); await departmentsApi.update(editTarget.department_id, payload); setEditTarget(null); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleDelete() {
    try { setDeleting(true); await departmentsApi.delete(deleteTarget.department_id); setDeleteTarget(null); load() }
    catch (e) { setError(e.message) } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search departments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>
          Add Department
        </Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {loading ? <PageLoader /> : filtered.length === 0 ? (
        <EmptyState
          icon={<RiBuildingLine size={28} />}
          title={search ? 'No matching departments' : 'No departments yet'}
          action={!search && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Add Department</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((dept) => (
            <div key={dept.department_id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <RiBuildingLine size={18} className="text-teal-600" />
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setFormError(null); setEditTarget(dept) }} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"><RiEditLine size={15} /></button>
                  <button onClick={() => setDeleteTarget(dept)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><RiDeleteBinLine size={15} /></button>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="font-semibold text-gray-900">{dept.department_name}</h3>
                {dept.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{dept.description}</p>}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                <RiUserStarLine size={13} />
                <span>{docCounts[dept.department_id] ?? 0} doctor{docCounts[dept.department_id] !== 1 ? 's' : ''}</span>
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="font-mono text-gray-400">ID #{dept.department_id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add Department">
        <DeptForm onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Department">
        {editTarget && <DeptForm initial={{ department_name: editTarget.department_name, description: editTarget.description ?? '' }} onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving} error={formError} />}
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Department" danger loading={deleting}
        message={`Delete "${deleteTarget?.department_name}"? This may fail if doctors are still assigned to it.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
