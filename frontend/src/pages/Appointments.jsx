/**
 * Staff appointment schedule. Read: appointments:read. Edit: appointments:write.
 * Bookings made by patient accounts that are not yet linked to a patient file
 * show "No patient file"; staff with write access can attach one here.
 */
import { useMemo, useState } from 'react'
import { RiAddLine, RiCalendarCheckLine, RiDeleteBinLine, RiPencilLine } from 'react-icons/ri'
import { appointmentsApi, doctorsApi, patientsApi } from '../services/api'
import { optional, useAsync } from '../hooks/useAsync'
import { blankToNull, useForm } from '../hooks/useForm'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Button, { IconButton } from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import StatusBadge, { Badge } from '../components/ui/StatusBadge'
import SearchInput from '../components/ui/SearchInput'
import Toolbar, { FilterSelect } from '../components/ui/Toolbar'
import FormModal from '../components/ui/FormModal'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import DetailList from '../components/ui/DetailList'
import { FieldGrid, Input, Select, Textarea } from '../components/ui/Field'
import { EmptyState } from '../components/ui/States'
import { doctorName, formatDate, formatDateTime, formatTime, fullName, plural, todayISO } from '../utils/format'

const STATUS_LABELS = {
  scheduled: 'Scheduled', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show',
}
// Mirrors ALLOWED_TRANSITIONS in backend/app/services/appointment_service.py
const TRANSITIONS = {
  scheduled: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'],
  confirmed: ['confirmed', 'scheduled', 'completed', 'cancelled', 'no_show'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  no_show: ['no_show'],
}
const FINAL = ['completed', 'cancelled', 'no_show']
const EMPTY = { patient_id: '', doctor_id: '', appointment_date: '', appointment_time: '', status: 'scheduled', reason: '' }

function PatientCell({ appt }) {
  if (appt.patient_id != null) return <span className="font-medium text-ink-900">{appt.patient_name ?? `Patient #${appt.patient_id}`}</span>
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium text-ink-900">{appt.patient_name ?? 'Patient account'}</span>
      <span><Badge tone="warn">No patient file</Badge></span>
    </span>
  )
}

function AppointmentForm({ form, patients, doctors, editing }) {
  const status = editing?.status ?? 'scheduled'
  const locked = editing && FINAL.includes(editing.status)
  const allowedStatuses = editing ? TRANSITIONS[status] : ['scheduled', 'confirmed']
  return (
    <>
      {locked && (
        <p className="rounded-md bg-ink-50 px-3 py-2.5 text-[13px] text-ink-600">
          This appointment is {STATUS_LABELS[status].toLowerCase()}; only the reason can be changed.
        </p>
      )}
      <FieldGrid>
        <Select label="Patient file" required={!editing?.firebase_uid} {...form.bind('patient_id')} disabled={locked}
          hint={editing?.firebase_uid && editing.patient_id == null ? 'Booked from a patient account. Attach their patient file when you have identified it.' : undefined}>
          <option value="">{editing?.firebase_uid ? 'No patient file yet' : 'Select a patient…'}</option>
          {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{fullName(p)} · #{p.patient_id}</option>)}
        </Select>
        <Select label="Doctor" required {...form.bind('doctor_id')} disabled={locked}>
          <option value="">Select a doctor…</option>
          {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>{doctorName(d)} · {d.specialization}</option>)}
        </Select>
        <Input label="Date" type="date" required {...form.bind('appointment_date')} disabled={locked} />
        <Input label="Time" type="time" required step={300} {...form.bind('appointment_time')} disabled={locked} />
        <Select label="Status" {...form.bind('status')} disabled={locked}>
          {allowedStatuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </Select>
      </FieldGrid>
      <Textarea label="Reason" maxLength={1000} {...form.bind('reason')} />
    </>
  )
}

export default function Appointments() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('appointments:write')
  const canDelete = can('appointments:delete')

  const { data, loading, error, reload } = useAsync(() => Promise.all([
    appointmentsApi.listAll(),
    optional(doctorsApi.listAll()),
    can('patients:read') ? optional(patientsApi.listAll()) : [],
  ]), [])
  const [appointments, doctors, patients] = data ?? [[], [], []]
  const doctorById = useMemo(() => Object.fromEntries(doctors.map((d) => [d.doctor_id, d])), [doctors])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [range, setRange] = useState('upcoming')
  const [doctorFilter, setDoctorFilter] = useState('')

  const [editing, setEditing] = useState(null) // null | 'new' | appointment
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  const today = todayISO()
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return appointments
      .filter((a) => !status || a.status === status)
      .filter((a) => !doctorFilter || String(a.doctor_id) === doctorFilter)
      .filter((a) => range === 'all'
        || (range === 'today' && a.appointment_date === today)
        || (range === 'upcoming' && a.appointment_date >= today)
        || (range === 'past' && a.appointment_date < today))
      .filter((a) => !q || [
        a.patient_name, a.booked_by_email, a.reason, String(a.appointment_id),
        doctorName(doctorById[a.doctor_id]),
      ].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        const k = `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`)
        return range === 'past' ? -k : k
      })
  }, [appointments, status, doctorFilter, range, search, today, doctorById])

  function openForm(appt) {
    setFormError(null)
    form.reset(appt === 'new' ? EMPTY : {
      patient_id: appt.patient_id ? String(appt.patient_id) : '',
      doctor_id: String(appt.doctor_id),
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time.slice(0, 5),
      status: appt.status,
      reason: appt.reason ?? '',
    })
    setEditing(appt)
  }

  function validate(v) {
    const e = {}
    const needsPatient = editing === 'new' || !editing.firebase_uid
    if (needsPatient && !v.patient_id) e.patient_id = 'Choose a patient file.'
    if (!v.doctor_id) e.doctor_id = 'Choose a doctor.'
    if (!v.appointment_date) e.appointment_date = 'Choose a date.'
    if (!v.appointment_time) e.appointment_time = 'Choose a time.'
    form.setErrors(e)
    return !Object.keys(e).length
  }

  async function save() {
    const v = form.values
    if (!validate(v)) return
    const body = blankToNull({
      ...v,
      patient_id: v.patient_id ? Number(v.patient_id) : '',
      doctor_id: Number(v.doctor_id),
      reason: v.reason.trim(),
    })
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') {
        await appointmentsApi.create(body)
        notify('Appointment scheduled.')
      } else {
        // Send only what changed, so final-state appointments accept reason edits.
        const original = {
          patient_id: editing.patient_id, doctor_id: editing.doctor_id, appointment_date: editing.appointment_date,
          appointment_time: editing.appointment_time.slice(0, 5), status: editing.status, reason: editing.reason ?? null,
        }
        const changes = Object.fromEntries(Object.entries(body).filter(([k, val]) => original[k] !== val))
        if (Object.keys(changes).length) await appointmentsApi.update(editing.appointment_id, changes)
        notify('Appointment updated.')
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
      await appointmentsApi.remove(deleting.appointment_id)
      setDeleting(null)
      notify('Appointment deleted.')
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        description="The clinic schedule, including bookings patients made online."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>Schedule appointment</Button>}
      />
      <Panel>
        <Toolbar count={!loading && !error ? plural(rows.length, 'appointment') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Patient, doctor, reason or #ID" className="sm:w-72" />
          <FilterSelect label="Date range" value={range} onChange={setRange}>
            <option value="upcoming">Today and later</option>
            <option value="today">Today</option>
            <option value="past">Past</option>
            <option value="all">All dates</option>
          </FilterSelect>
          <FilterSelect label="Status" value={status} onChange={setStatus}>
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </FilterSelect>
          <FilterSelect label="Doctor" value={doctorFilter} onChange={setDoctorFilter}>
            <option value="">All doctors</option>
            {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>{doctorName(d)}</option>)}
          </FilterSelect>
        </Toolbar>
        <DataTable
          caption="Appointments"
          loading={loading}
          error={error}
          onRetry={reload}
          rows={rows}
          rowKey={(a) => a.appointment_id}
          onRowClick={setViewing}
          empty={<EmptyState icon={RiCalendarCheckLine} title="No appointments match these filters" />}
          columns={[
            { key: 'when', header: 'When', primary: true, render: (a) => (
              <span className="whitespace-nowrap">
                <span className="font-medium text-ink-900">{formatDate(a.appointment_date)}</span>
                <span className="text-ink-500"> · {formatTime(a.appointment_time)}</span>
              </span>
            ) },
            { key: 'patient', header: 'Patient', render: (a) => <PatientCell appt={a} /> },
            { key: 'doctor', header: 'Doctor', render: (a) => (doctorById[a.doctor_id] ? doctorName(doctorById[a.doctor_id]) : `#${a.doctor_id}`) },
            { key: 'status', header: 'Status', render: (a) => <StatusBadge value={a.status} /> },
            { key: 'reason', header: 'Reason', hideOnMobile: true, className: 'max-w-[16rem] text-ink-600', render: (a) => <span className="line-clamp-2">{a.reason || '—'}</span> },
          ]}
          actions={(canWrite || canDelete) ? (a) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit appointment #${a.appointment_id}`} onClick={() => openForm(a)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Delete appointment #${a.appointment_id}`} onClick={() => { setFormError(null); setDeleting(a) }} />}
            </>
          ) : undefined}
        />
      </Panel>

      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Schedule appointment' : `Edit appointment #${editing?.appointment_id}`}
        onSubmit={save}
        busy={busy}
        error={formError}
        submitLabel={editing === 'new' ? 'Schedule' : 'Save changes'}
      >
        <AppointmentForm form={form} patients={patients} doctors={doctors} editing={editing === 'new' ? null : editing} />
      </FormModal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Appointment #${viewing?.appointment_id}`}
        footer={canWrite && <Button variant="secondary" icon={RiPencilLine} onClick={() => { const a = viewing; setViewing(null); openForm(a) }}>Edit</Button>}>
        {viewing && (
          <DetailList items={[
            ['Status', <StatusBadge value={viewing.status} />],
            ['Date and time', `${formatDate(viewing.appointment_date, { weekday: 'long' })} at ${formatTime(viewing.appointment_time)}`],
            ['Doctor', doctorById[viewing.doctor_id] ? `${doctorName(doctorById[viewing.doctor_id])} · ${doctorById[viewing.doctor_id].specialization}` : `#${viewing.doctor_id}`],
            ['Patient file', viewing.patient_id != null ? `${viewing.patient_name} · #${viewing.patient_id}` : 'Not linked yet'],
            viewing.firebase_uid && ['Booked online by', [viewing.booked_by_name, viewing.booked_by_email].filter(Boolean).join(' · ')],
            ['Reason', viewing.reason],
            ['Created', formatDateTime(viewing.created_at)],
          ]} />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this appointment?"
        message="The appointment will be removed permanently. Appointments with a medical record or bill cannot be deleted — cancel them instead."
        confirmLabel="Delete"
        danger
        loading={busy}
        error={formError}
      />
    </>
  )
}
