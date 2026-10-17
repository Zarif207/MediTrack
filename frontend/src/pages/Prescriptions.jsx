import { useMemo, useState } from 'react'
import { RiAddLine, RiCapsuleLine, RiDeleteBinLine, RiPencilLine } from 'react-icons/ri'
import { medicalRecordsApi, prescriptionItemsApi, prescriptionsApi } from '../services/api'
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
import { Select, Textarea } from '../components/ui/Field'
import { EmptyState } from '../components/ui/States'
import { formatDate, plural, truncate } from '../utils/format'

const EMPTY = { record_id: '', instructions: '' }

export default function Prescriptions() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('prescriptions:write')
  const canDelete = can('prescriptions:delete')
  const { data, loading, error, reload } = useAsync(() => Promise.all([
    prescriptionsApi.listAll(),
    optional(prescriptionItemsApi.listAll()),
    can('medical_records:read') ? optional(medicalRecordsApi.listAll()) : [],
  ]), [])
  const [prescriptions, items, records] = data ?? [[], [], []]

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  const itemsByRx = useMemo(() => items.reduce((m, i) => ({ ...m, [i.prescription_id]: [...(m[i.prescription_id] ?? []), i] }), {}), [items])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...prescriptions]
      .sort((a, b) => b.prescription_date.localeCompare(a.prescription_date))
      .filter((p) => !q || [p.patient_name, p.instructions, String(p.prescription_id)].some((v) => v?.toLowerCase().includes(q)))
  }, [prescriptions, search])

  function openForm(p) {
    setFormError(null)
    form.reset(p === 'new' ? EMPTY : { record_id: String(p.record_id), instructions: p.instructions ?? '' })
    setEditing(p)
  }

  async function save() {
    const v = form.values
    if (editing === 'new' && !v.record_id) { form.setErrors({ record_id: 'Choose a medical record.' }); return }
    setBusy(true)
    setFormError(null)
    try {
      const instructions = v.instructions.trim() || null
      if (editing === 'new') { await prescriptionsApi.create({ record_id: Number(v.record_id), instructions }); notify('Prescription created. Add medicines under Prescription items.') }
      else { await prescriptionsApi.update(editing.prescription_id, { instructions }); notify('Prescription updated.') }
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
      await prescriptionsApi.remove(deleting.prescription_id)
      setDeleting(null)
      notify('Prescription deleted.')
      reload()
    } catch (err) {
      setFormError(err.status === 409 ? 'Remove the medicines on this prescription first.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const viewingItems = viewing ? itemsByRx[viewing.prescription_id] ?? [] : []

  return (
    <>
      <PageHeader title="Prescriptions" description="Prescriptions issued against medical records."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>New prescription</Button>} />
      <Panel>
        <Toolbar count={!loading && !error ? plural(rows.length, 'prescription') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Patient, instructions or #ID" className="sm:w-80" />
        </Toolbar>
        <DataTable
          caption="Prescriptions" loading={loading} error={error} onRetry={reload} rows={rows} rowKey={(p) => p.prescription_id}
          onRowClick={setViewing}
          empty={<EmptyState icon={RiCapsuleLine} title="No prescriptions found" />}
          columns={[
            { key: 'patient', header: 'Patient', primary: true, render: (p) => (
              <span><span className="block font-medium text-ink-900">{p.patient_name ?? '—'}</span>
                <span className="block text-xs text-ink-500">Rx #{p.prescription_id} · record #{p.record_id}</span></span>
            ) },
            { key: 'date', header: 'Issued', render: (p) => formatDate(p.prescription_date) },
            { key: 'items', header: 'Medicines', render: (p) => (itemsByRx[p.prescription_id]?.length ?? 0) },
            { key: 'instructions', header: 'Instructions', hideOnMobile: true, className: 'max-w-sm text-ink-600', render: (p) => truncate(p.instructions, 80) },
          ]}
          actions={(canWrite || canDelete) ? (p) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit prescription #${p.prescription_id}`} onClick={() => openForm(p)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Delete prescription #${p.prescription_id}`} onClick={() => { setFormError(null); setDeleting(p) }} />}
            </>
          ) : undefined}
        />
      </Panel>

      <FormModal open={!!editing} onClose={() => setEditing(null)} size="md"
        title={editing === 'new' ? 'New prescription' : `Edit prescription #${editing?.prescription_id}`}
        onSubmit={save} busy={busy} error={formError} submitLabel={editing === 'new' ? 'Create' : 'Save changes'}>
        {editing === 'new' && (
          <Select label="Medical record" required {...form.bind('record_id')}>
            <option value="">Select a record…</option>
            {[...records].sort((a, b) => b.record_date.localeCompare(a.record_date)).map((r) => (
              <option key={r.record_id} value={r.record_id}>
                {formatDate(r.record_date)} · {r.patient_name ?? 'Unknown'} · {truncate(r.diagnosis, 40)}
              </option>
            ))}
          </Select>
        )}
        <Textarea label="Instructions" maxLength={2000} rows={4} {...form.bind('instructions')} />
      </FormModal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Prescription #${viewing?.prescription_id}`}
        description={viewing ? `${viewing.patient_name ?? ''} · issued ${formatDate(viewing.prescription_date)}` : ''}>
        {viewing && (
          <div className="space-y-4">
            {viewing.instructions && <p className="whitespace-pre-wrap text-sm text-ink-800">{viewing.instructions}</p>}
            {viewingItems.length ? (
              <ul className="divide-y divide-ink-100 rounded-md border border-ink-100">
                {viewingItems.map((i) => (
                  <li key={i.prescription_item_id} className="flex justify-between gap-4 px-3.5 py-2.5 text-sm">
                    <span><span className="font-medium">{i.medicine_name} {i.medicine_strength}</span>
                      <span className="block text-[13px] text-ink-600">{i.dosage} · {i.frequency} · {i.duration}</span></span>
                    <span className="shrink-0 text-ink-500">Qty {i.quantity}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-500">No medicines on this prescription yet.</p>}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete prescription #${deleting?.prescription_id}?`} message="Prescriptions that still list medicines cannot be deleted."
        confirmLabel="Delete prescription" danger loading={busy} error={formError} />
    </>
  )
}
