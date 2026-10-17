import { useMemo, useState } from 'react'
import { RiAddLine, RiDeleteBinLine, RiPencilLine, RiStethoscopeLine } from 'react-icons/ri'
import { departmentsApi, doctorsApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useForm } from '../hooks/useForm'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Button, { IconButton } from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import SearchInput from '../components/ui/SearchInput'
import Toolbar, { FilterSelect } from '../components/ui/Toolbar'
import FormModal from '../components/ui/FormModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { FieldGrid, Input, Select } from '../components/ui/Field'
import { EmptyState } from '../components/ui/States'
import { doctorName, plural } from '../utils/format'

const EMPTY = { department_id: '', first_name: '', last_name: '', specialization: '', phone: '', email: '', license_number: '' }

function validate(v) {
  const e = {}
  if (!v.department_id) e.department_id = 'Choose a department.'
  for (const [k, label] of [['first_name', 'a first name'], ['last_name', 'a last name'],
    ['specialization', 'a specialization'], ['license_number', 'a license number']]) {
    if (!v[k].trim()) e[k] = `Enter ${label}.`
  }
  if (!/^\+?[0-9()\-.\s]{6,20}$/.test(v.phone.trim())) e.phone = 'Enter a phone number.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address.'
  return e
}

export default function Doctors() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('doctors:write')
  const canDelete = can('doctors:delete')
  const { data, loading, error, reload } = useAsync(() => Promise.all([doctorsApi.listAll(), departmentsApi.listAll()]), [])
  const [doctors, departments] = data ?? [[], []]
  const deptName = useMemo(() => Object.fromEntries(departments.map((d) => [d.department_id, d.department_name])), [departments])

  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return doctors
      .filter((d) => !dept || String(d.department_id) === dept)
      .filter((d) => !q || [doctorName(d), d.specialization, d.email, deptName[d.department_id]]
        .some((v) => v?.toLowerCase().includes(q)))
  }, [doctors, dept, search, deptName])

  function openForm(d) {
    setFormError(null)
    form.reset(d === 'new' ? EMPTY : { ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, d[k] ?? ''])), department_id: String(d.department_id) })
    setEditing(d)
  }

  async function save() {
    const errs = validate(form.values)
    form.setErrors(errs)
    if (Object.keys(errs).length) return
    const body = { ...form.values, department_id: Number(form.values.department_id) }
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') { await doctorsApi.create(body); notify('Doctor added.') }
      else { await doctorsApi.update(editing.doctor_id, body); notify('Doctor updated.') }
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(err.status === 409 ? 'Another doctor already uses this email or license number.' : form.applyServerErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    setFormError(null)
    try {
      await doctorsApi.remove(deleting.doctor_id)
      setDeleting(null)
      notify('Doctor removed.')
      reload()
    } catch (err) {
      setFormError(err.status === 409 ? 'This doctor has appointments on record and cannot be removed.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Doctors" description="Clinicians, their departments and contact details."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>Add doctor</Button>} />
      <Panel>
        <Toolbar count={!loading && !error ? plural(rows.length, 'doctor') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, specialization or email" className="sm:w-72" />
          <FilterSelect label="Department" value={dept} onChange={setDept}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
          </FilterSelect>
        </Toolbar>
        <DataTable
          caption="Doctors" loading={loading} error={error} onRetry={reload} rows={rows} rowKey={(d) => d.doctor_id}
          empty={<EmptyState icon={RiStethoscopeLine} title="No doctors found" />}
          columns={[
            { key: 'name', header: 'Doctor', primary: true, render: (d) => (
              <span><span className="block font-medium text-ink-900">{doctorName(d)}</span>
                <span className="block text-xs text-ink-500">{d.specialization}</span></span>
            ) },
            { key: 'dept', header: 'Department', render: (d) => deptName[d.department_id] ?? `#${d.department_id}` },
            { key: 'phone', header: 'Phone', className: 'whitespace-nowrap', render: (d) => d.phone ?? '—' },
            { key: 'email', header: 'Email', render: (d) => d.email ?? '—' },
            { key: 'license', header: 'License', hideOnMobile: true, render: (d) => <span className="font-mono text-[13px]">{d.license_number ?? '—'}</span> },
          ]}
          actions={(canWrite || canDelete) ? (d) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit ${doctorName(d)}`} onClick={() => openForm(d)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Remove ${doctorName(d)}`} onClick={() => { setFormError(null); setDeleting(d) }} />}
            </>
          ) : undefined}
        />
      </Panel>

      <FormModal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add doctor' : `Edit ${doctorName(editing)}`}
        onSubmit={save} busy={busy} error={formError} submitLabel={editing === 'new' ? 'Add doctor' : 'Save changes'}>
        <Select label="Department" required {...form.bind('department_id')}>
          <option value="">Select a department…</option>
          {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
        </Select>
        <FieldGrid>
          <Input label="First name" required maxLength={50} {...form.bind('first_name')} />
          <Input label="Last name" required maxLength={50} {...form.bind('last_name')} />
          <Input label="Specialization" required maxLength={100} {...form.bind('specialization')} />
          <Input label="License number" required maxLength={50} {...form.bind('license_number')} />
          <Input label="Phone" type="tel" required maxLength={20} {...form.bind('phone')} />
          <Input label="Email" type="email" required maxLength={150} {...form.bind('email')} />
        </FieldGrid>
      </FormModal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Remove ${deleting ? doctorName(deleting) : ''}?`}
        message="The doctor will be removed from the directory and booking. Doctors with appointments on record cannot be removed."
        confirmLabel="Remove doctor" danger loading={busy} error={formError} />
    </>
  )
}
