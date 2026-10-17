import { useMemo, useState } from 'react'
import { RiAddLine, RiDeleteBinLine, RiPencilLine, RiUserHeartLine } from 'react-icons/ri'
import { patientsApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { blankToNull, useForm } from '../hooks/useForm'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Button, { IconButton } from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import SearchInput from '../components/ui/SearchInput'
import Toolbar from '../components/ui/Toolbar'
import FormModal from '../components/ui/FormModal'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import DetailList from '../components/ui/DetailList'
import { FieldGrid, Input, Select, Textarea } from '../components/ui/Field'
import { EmptyState } from '../components/ui/States'
import { calcAge, formatDate, formatDateTime, fullName, plural, todayISO } from '../utils/format'

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const EMPTY = {
  first_name: '', last_name: '', date_of_birth: '', gender: '', phone: '',
  email: '', address: '', blood_group: '', emergency_contact: '',
}
const PHONE = /^\+?[0-9()\-.\s]{6,20}$/

function validate(v) {
  const e = {}
  if (!v.first_name.trim()) e.first_name = 'Enter a first name.'
  if (!v.last_name.trim()) e.last_name = 'Enter a last name.'
  if (!v.date_of_birth) e.date_of_birth = 'Enter a date of birth.'
  else if (v.date_of_birth > todayISO()) e.date_of_birth = 'Date of birth cannot be in the future.'
  if (!v.gender) e.gender = 'Choose an option.'
  if (!PHONE.test(v.phone.trim())) e.phone = 'Enter a phone number (digits, spaces, + - ( ) only).'
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address.'
  if (v.emergency_contact && !PHONE.test(v.emergency_contact.trim())) e.emergency_contact = 'Enter a phone number.'
  return e
}

export default function Patients() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('patients:write')
  const canDelete = can('patients:delete')

  const { data, loading, error, reload } = useAsync(() => patientsApi.listAll(), [])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter((p) => !q || [fullName(p), p.phone, p.email, String(p.patient_id)]
      .some((v) => v?.toLowerCase().includes(q)))
  }, [data, search])

  function openForm(p) {
    setFormError(null)
    form.reset(p === 'new' ? EMPTY : Object.fromEntries(Object.keys(EMPTY).map((k) => [k, p[k] ?? ''])))
    setEditing(p)
  }

  async function save() {
    const errs = validate(form.values)
    form.setErrors(errs)
    if (Object.keys(errs).length) return
    const body = blankToNull(form.values)
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') {
        await patientsApi.create(body)
        notify('Patient added.')
      } else {
        await patientsApi.update(editing.patient_id, body)
        notify('Patient updated.')
      }
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(form.applyServerErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    setFormError(null)
    try {
      await patientsApi.remove(deleting.patient_id)
      setDeleting(null)
      notify('Patient deleted.')
      reload()
    } catch (err) {
      setFormError(err.status === 409
        ? 'This patient has appointments or bills on file, so the record cannot be deleted.'
        : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Patients"
        description="Clinical patient files. Online bookings can exist before a file is created."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>Add patient</Button>}
      />
      <Panel>
        <Toolbar count={!loading && !error ? plural(rows.length, 'patient') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, phone, email or #ID" className="sm:w-80" />
        </Toolbar>
        <DataTable
          caption="Patients"
          loading={loading}
          error={error}
          onRetry={reload}
          rows={rows}
          rowKey={(p) => p.patient_id}
          onRowClick={setViewing}
          empty={<EmptyState icon={RiUserHeartLine} title={search ? 'No patients match your search' : 'No patient files yet'}
            action={canWrite && !search && <Button size="sm" onClick={() => openForm('new')}>Add patient</Button>} />}
          columns={[
            { key: 'name', header: 'Name', primary: true, render: (p) => (
              <span>
                <span className="block font-medium text-ink-900">{fullName(p)}</span>
                <span className="block text-xs text-ink-500">#{p.patient_id}{p.email ? ` · ${p.email}` : ''}</span>
              </span>
            ) },
            { key: 'age', header: 'Age', render: (p) => calcAge(p.date_of_birth) ?? '—' },
            { key: 'gender', header: 'Gender' },
            { key: 'phone', header: 'Phone', className: 'whitespace-nowrap' },
            { key: 'blood_group', header: 'Blood group', render: (p) => p.blood_group ?? '—' },
            { key: 'registered_at', header: 'Registered', hideOnMobile: true, render: (p) => formatDate(p.registered_at) },
          ]}
          actions={(canWrite || canDelete) ? (p) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit ${fullName(p)}`} onClick={() => openForm(p)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Delete ${fullName(p)}`} onClick={() => { setFormError(null); setDeleting(p) }} />}
            </>
          ) : undefined}
        />
      </Panel>

      <FormModal open={!!editing} onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add patient' : `Edit ${fullName(editing)}`}
        onSubmit={save} busy={busy} error={formError} submitLabel={editing === 'new' ? 'Add patient' : 'Save changes'}>
        <FieldGrid>
          <Input label="First name" required maxLength={50} autoComplete="off" {...form.bind('first_name')} />
          <Input label="Last name" required maxLength={50} autoComplete="off" {...form.bind('last_name')} />
          <Input label="Date of birth" type="date" required max={todayISO()} {...form.bind('date_of_birth')} />
          <Select label="Gender" required {...form.bind('gender')}>
            <option value="">Select…</option>
            {GENDERS.map((g) => <option key={g}>{g}</option>)}
            {form.values.gender && !GENDERS.includes(form.values.gender) && <option>{form.values.gender}</option>}
          </Select>
          <Input label="Phone" type="tel" required maxLength={20} {...form.bind('phone')} />
          <Input label="Email" type="email" maxLength={150} {...form.bind('email')} />
          <Select label="Blood group" {...form.bind('blood_group')}>
            <option value="">Unknown</option>
            {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
          </Select>
          <Input label="Emergency contact" type="tel" maxLength={20} hint="Phone number" {...form.bind('emergency_contact')} />
        </FieldGrid>
        <Textarea label="Address" maxLength={500} {...form.bind('address')} />
      </FormModal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? fullName(viewing) : ''}
        description={viewing ? `Patient #${viewing.patient_id}` : ''}
        footer={canWrite && <Button variant="secondary" icon={RiPencilLine} onClick={() => { const p = viewing; setViewing(null); openForm(p) }}>Edit</Button>}>
        {viewing && (
          <DetailList columns={2} items={[
            ['Date of birth', `${formatDate(viewing.date_of_birth)} (age ${calcAge(viewing.date_of_birth)})`],
            ['Gender', viewing.gender],
            ['Phone', viewing.phone],
            ['Email', viewing.email],
            ['Blood group', viewing.blood_group],
            ['Emergency contact', viewing.emergency_contact],
            ['Address', viewing.address],
            ['Registered', formatDateTime(viewing.registered_at)],
          ]} />
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting ? fullName(deleting) : ''}?`}
        message="The patient file will be removed permanently. Files with appointments or bills cannot be deleted."
        confirmLabel="Delete patient" danger loading={busy} error={formError} />
    </>
  )
}
