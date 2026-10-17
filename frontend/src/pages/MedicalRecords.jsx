import { useMemo, useState } from 'react'
import { RiAddLine, RiDeleteBinLine, RiFileList3Line, RiPencilLine } from 'react-icons/ri'
import { appointmentsApi, medicalRecordsApi } from '../services/api'
import { optional, useAsync } from '../hooks/useAsync'
import { useForm } from '../hooks/useForm'
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
import { Select, Textarea } from '../components/ui/Field'
import { EmptyState } from '../components/ui/States'
import { formatDate, formatDateTime, formatTime, plural } from '../utils/format'

const EMPTY = { appointment_id: '', diagnosis: '', symptoms: '', treatment_notes: '' }

export default function MedicalRecords() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('medical_records:write')
  const canDelete = can('medical_records:delete')
  const { data, loading, error, reload } = useAsync(() => Promise.all([
    medicalRecordsApi.listAll(),
    can('appointments:read') ? optional(appointmentsApi.listAll()) : [],
  ]), [])
  const [records, appointments] = data ?? [[], []]

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  const withRecord = useMemo(() => new Set(records.map((r) => r.appointment_id)), [records])
  const eligible = appointments
    .filter((a) => a.patient_id != null && !['cancelled', 'no_show'].includes(a.status) && !withRecord.has(a.appointment_id))
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...records]
      .sort((a, b) => b.record_date.localeCompare(a.record_date))
      .filter((r) => !q || [r.patient_name, r.diagnosis, r.symptoms, String(r.record_id), String(r.appointment_id)]
        .some((v) => v?.toLowerCase().includes(q)))
  }, [records, search])

  function openForm(r) {
    setFormError(null)
    form.reset(r === 'new' ? EMPTY : {
      appointment_id: String(r.appointment_id), diagnosis: r.diagnosis ?? '', symptoms: r.symptoms ?? '', treatment_notes: r.treatment_notes ?? '',
    })
    setEditing(r)
  }

  async function save() {
    const v = form.values
    if (editing === 'new' && !v.appointment_id) { form.setErrors({ appointment_id: 'Choose an appointment.' }); return }
    const text = { diagnosis: v.diagnosis.trim() || null, symptoms: v.symptoms.trim() || null, treatment_notes: v.treatment_notes.trim() || null }
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') { await medicalRecordsApi.create({ appointment_id: Number(v.appointment_id), ...text }); notify('Medical record added.') }
      else { await medicalRecordsApi.update(editing.record_id, text); notify('Medical record updated.') }
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
      await medicalRecordsApi.remove(deleting.record_id)
      setDeleting(null)
      notify('Medical record deleted.')
      reload()
    } catch (err) {
      setFormError(err.status === 409 ? 'Delete this record’s prescriptions first.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Medical records" description="One record per appointment: diagnosis, symptoms and treatment notes."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>Add record</Button>} />
      <Panel>
        <Toolbar count={!loading && !error ? plural(rows.length, 'record') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Patient, diagnosis or #ID" className="sm:w-80" />
        </Toolbar>
        <DataTable
          caption="Medical records" loading={loading} error={error} onRetry={reload} rows={rows} rowKey={(r) => r.record_id}
          onRowClick={setViewing}
          empty={<EmptyState icon={RiFileList3Line} title="No medical records found" />}
          columns={[
            { key: 'patient', header: 'Patient', primary: true, render: (r) => (
              <span><span className="block font-medium text-ink-900">{r.patient_name ?? '—'}</span>
                <span className="block text-xs text-ink-500">Record #{r.record_id} · appt #{r.appointment_id}</span></span>
            ) },
            { key: 'record_date', header: 'Recorded', render: (r) => formatDate(r.record_date) },
            { key: 'diagnosis', header: 'Diagnosis', className: 'max-w-xs', render: (r) => <span className="line-clamp-2">{r.diagnosis || '—'}</span> },
            { key: 'symptoms', header: 'Symptoms', hideOnMobile: true, className: 'max-w-xs text-ink-600', render: (r) => <span className="line-clamp-2">{r.symptoms || '—'}</span> },
          ]}
          actions={(canWrite || canDelete) ? (r) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit record #${r.record_id}`} onClick={() => openForm(r)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Delete record #${r.record_id}`} onClick={() => { setFormError(null); setDeleting(r) }} />}
            </>
          ) : undefined}
        />
      </Panel>

      <FormModal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add medical record' : `Edit record #${editing?.record_id}`}
        onSubmit={save} busy={busy} error={formError} submitLabel={editing === 'new' ? 'Add record' : 'Save changes'}>
        {editing === 'new' ? (
          <Select label="Appointment" required {...form.bind('appointment_id')}
            hint="Only appointments with a patient file and no existing record are listed.">
            <option value="">Select an appointment…</option>
            {eligible.map((a) => (
              <option key={a.appointment_id} value={a.appointment_id}>
                {formatDate(a.appointment_date)} {formatTime(a.appointment_time)} · {a.patient_name} · #{a.appointment_id}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm text-ink-600">{editing?.patient_name} · appointment #{editing?.appointment_id}</p>
        )}
        <Textarea label="Diagnosis" rows={3} maxLength={5000} {...form.bind('diagnosis')} />
        <Textarea label="Symptoms" rows={3} maxLength={5000} {...form.bind('symptoms')} />
        <Textarea label="Treatment notes" rows={4} maxLength={5000} {...form.bind('treatment_notes')} />
      </FormModal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Record #${viewing?.record_id}`}
        description={viewing ? `${viewing.patient_name ?? ''} · appointment #${viewing.appointment_id}` : ''}
        footer={canWrite && <Button variant="secondary" icon={RiPencilLine} onClick={() => { const r = viewing; setViewing(null); openForm(r) }}>Edit</Button>}>
        {viewing && <DetailList items={[
          ['Recorded', formatDateTime(viewing.record_date)],
          ['Diagnosis', viewing.diagnosis], ['Symptoms', viewing.symptoms], ['Treatment notes', viewing.treatment_notes],
        ]} />}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete record #${deleting?.record_id}?`} message="Records that have prescriptions cannot be deleted."
        confirmLabel="Delete record" danger loading={busy} error={formError} />
    </>
  )
}
