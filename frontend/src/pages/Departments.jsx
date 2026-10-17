import { useMemo, useState } from 'react'
import { RiAddLine, RiDeleteBinLine, RiHospitalLine, RiPencilLine } from 'react-icons/ri'
import { departmentsApi, doctorsApi } from '../services/api'
import { optional, useAsync } from '../hooks/useAsync'
import { useForm } from '../hooks/useForm'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Button, { IconButton } from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import FormModal from '../components/ui/FormModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Input, Textarea } from '../components/ui/Field'
import { EmptyState } from '../components/ui/States'
import { plural } from '../utils/format'

const EMPTY = { department_name: '', description: '' }

export default function Departments() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('departments:write')
  const canDelete = can('departments:delete')
  const { data, loading, error, reload } = useAsync(() => Promise.all([departmentsApi.listAll(), optional(doctorsApi.listAll())]), [])
  const [departments, doctors] = data ?? [[], []]
  const counts = useMemo(() => doctors.reduce((m, d) => ({ ...m, [d.department_id]: (m[d.department_id] ?? 0) + 1 }), {}), [doctors])

  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  function openForm(d) {
    setFormError(null)
    form.reset(d === 'new' ? EMPTY : { department_name: d.department_name, description: d.description ?? '' })
    setEditing(d)
  }

  async function save() {
    if (!form.values.department_name.trim()) { form.setErrors({ department_name: 'Enter a name.' }); return }
    const body = { department_name: form.values.department_name.trim(), description: form.values.description.trim() || null }
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') { await departmentsApi.create(body); notify('Department added.') }
      else { await departmentsApi.update(editing.department_id, body); notify('Department updated.') }
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(err.status === 409 ? 'A department with this name already exists.' : form.applyServerErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    setFormError(null)
    try {
      await departmentsApi.remove(deleting.department_id)
      setDeleting(null)
      notify('Department deleted.')
      reload()
    } catch (err) {
      setFormError(err.status === 409 ? 'Move or remove this department’s doctors first.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Departments" description="Departments shown on the public site and used to group doctors."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>Add department</Button>} />
      <Panel>
        <DataTable
          caption="Departments" loading={loading} error={error} onRetry={reload} rows={departments} rowKey={(d) => d.department_id}
          empty={<EmptyState icon={RiHospitalLine} title="No departments yet" />}
          columns={[
            { key: 'department_name', header: 'Department', primary: true, render: (d) => <span className="font-medium text-ink-900">{d.department_name}</span> },
            { key: 'description', header: 'Description', className: 'max-w-md text-ink-600', render: (d) => <span className="line-clamp-2">{d.description || '—'}</span> },
            { key: 'doctors', header: 'Doctors', align: 'right', render: (d) => counts[d.department_id] ?? 0 },
          ]}
          actions={(canWrite || canDelete) ? (d) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit ${d.department_name}`} onClick={() => openForm(d)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Delete ${d.department_name}`} onClick={() => { setFormError(null); setDeleting(d) }} />}
            </>
          ) : undefined}
        />
        {!loading && !error && departments.length > 0 && (
          <p className="border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">{plural(departments.length, 'department')}</p>
        )}
      </Panel>

      <FormModal open={!!editing} onClose={() => setEditing(null)} size="md"
        title={editing === 'new' ? 'Add department' : `Edit ${editing?.department_name}`}
        onSubmit={save} busy={busy} error={formError} submitLabel={editing === 'new' ? 'Add department' : 'Save changes'}>
        <Input label="Name" required maxLength={100} {...form.bind('department_name')} />
        <Textarea label="Description" maxLength={2000} hint="Shown on the public departments page." {...form.bind('description')} />
      </FormModal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting?.department_name}?`}
        message="Departments that still have doctors cannot be deleted."
        confirmLabel="Delete department" danger loading={busy} error={formError} />
    </>
  )
}
