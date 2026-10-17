import { useMemo, useState } from 'react'
import { RiAddLine, RiDeleteBinLine, RiListCheck3, RiPencilLine } from 'react-icons/ri'
import { medicinesApi, prescriptionItemsApi, prescriptionsApi } from '../services/api'
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
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { FieldGrid, Input, Select } from '../components/ui/Field'
import { EmptyState } from '../components/ui/States'
import { formatDate, plural } from '../utils/format'

const EMPTY = { prescription_id: '', medicine_id: '', dosage: '', frequency: '', duration: '', quantity: '' }

function validate(v, isNew) {
  const e = {}
  if (isNew && !v.prescription_id) e.prescription_id = 'Choose a prescription.'
  if (isNew && !v.medicine_id) e.medicine_id = 'Choose a medicine.'
  for (const k of ['dosage', 'frequency', 'duration']) if (!v[k].trim()) e[k] = 'Required.'
  if (!/^\d+$/.test(String(v.quantity)) || Number(v.quantity) < 1 || Number(v.quantity) > 10000) e.quantity = 'Enter a whole number from 1 to 10,000.'
  return e
}

export default function PrescriptionItems() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('prescription_items:write')
  const canDelete = can('prescription_items:delete')
  const { data, loading, error, reload } = useAsync(() => Promise.all([
    prescriptionItemsApi.listAll(),
    optional(prescriptionsApi.listAll()),
    can('medicines:read') ? optional(medicinesApi.listAll()) : [],
  ]), [])
  const [items, prescriptions, medicines] = data ?? [[], [], []]
  const rxById = useMemo(() => Object.fromEntries(prescriptions.map((p) => [p.prescription_id, p])), [prescriptions])

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => !q || [i.medicine_name, rxById[i.prescription_id]?.patient_name, String(i.prescription_id)]
      .some((v) => v?.toLowerCase().includes(q)))
  }, [items, search, rxById])

  function openForm(i) {
    setFormError(null)
    form.reset(i === 'new' ? EMPTY : Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String(i[k] ?? '')])))
    setEditing(i)
  }

  async function save() {
    const isNew = editing === 'new'
    const errs = validate(form.values, isNew)
    form.setErrors(errs)
    if (Object.keys(errs).length) return
    const v = form.values
    const common = { dosage: v.dosage.trim(), frequency: v.frequency.trim(), duration: v.duration.trim(), quantity: Number(v.quantity) }
    setBusy(true)
    setFormError(null)
    try {
      if (isNew) { await prescriptionItemsApi.create({ ...common, prescription_id: Number(v.prescription_id), medicine_id: Number(v.medicine_id) }); notify('Medicine added to prescription.') }
      else { await prescriptionItemsApi.update(editing.prescription_item_id, common); notify('Prescription item updated.') }
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(err.status === 409 ? 'This medicine is already on that prescription.' : form.applyServerErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    setFormError(null)
    try {
      await prescriptionItemsApi.remove(deleting.prescription_item_id)
      setDeleting(null)
      notify('Item removed.')
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Prescription items" description="Each medicine on a prescription, with dosage and quantity."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>Add medicine to prescription</Button>} />
      <Panel>
        <Toolbar count={!loading && !error ? plural(rows.length, 'item') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Medicine, patient or Rx #" className="sm:w-80" />
        </Toolbar>
        <DataTable
          caption="Prescription items" loading={loading} error={error} onRetry={reload} rows={rows} rowKey={(i) => i.prescription_item_id}
          empty={<EmptyState icon={RiListCheck3} title="No prescription items found" />}
          columns={[
            { key: 'medicine', header: 'Medicine', primary: true, render: (i) => (
              <span><span className="block font-medium text-ink-900">{i.medicine_name ?? `#${i.medicine_id}`}</span>
                <span className="block text-xs text-ink-500">{[i.medicine_strength, i.medicine_form].filter(Boolean).join(' · ')}</span></span>
            ) },
            { key: 'rx', header: 'Prescription', render: (i) => (
              <span><span className="block">{rxById[i.prescription_id]?.patient_name ?? '—'}</span>
                <span className="block text-xs text-ink-500">Rx #{i.prescription_id}{rxById[i.prescription_id] ? ` · ${formatDate(rxById[i.prescription_id].prescription_date)}` : ''}</span></span>
            ) },
            { key: 'dosage', header: 'Dosage' },
            { key: 'frequency', header: 'Frequency' },
            { key: 'duration', header: 'Duration' },
            { key: 'quantity', header: 'Qty', align: 'right' },
          ]}
          actions={(canWrite || canDelete) ? (i) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit ${i.medicine_name ?? 'item'}`} onClick={() => openForm(i)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Remove ${i.medicine_name ?? 'item'}`} onClick={() => { setFormError(null); setDeleting(i) }} />}
            </>
          ) : undefined}
        />
      </Panel>

      <FormModal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add medicine to prescription' : `Edit ${editing?.medicine_name ?? 'item'}`}
        onSubmit={save} busy={busy} error={formError} submitLabel={editing === 'new' ? 'Add' : 'Save changes'}>
        {editing === 'new' && (
          <FieldGrid>
            <Select label="Prescription" required {...form.bind('prescription_id')}>
              <option value="">Select…</option>
              {[...prescriptions].sort((a, b) => b.prescription_date.localeCompare(a.prescription_date)).map((p) => (
                <option key={p.prescription_id} value={p.prescription_id}>#{p.prescription_id} · {p.patient_name ?? 'Unknown'} · {formatDate(p.prescription_date)}</option>
              ))}
            </Select>
            <Select label="Medicine" required {...form.bind('medicine_id')}>
              <option value="">Select…</option>
              {medicines.map((m) => <option key={m.medicine_id} value={m.medicine_id}>{m.medicine_name} {m.strength} · {m.dosage_form}</option>)}
            </Select>
          </FieldGrid>
        )}
        <FieldGrid>
          <Input label="Dosage" required maxLength={50} placeholder="e.g. 1 tablet" {...form.bind('dosage')} />
          <Input label="Frequency" required maxLength={100} placeholder="e.g. Twice daily after meals" {...form.bind('frequency')} />
          <Input label="Duration" required maxLength={50} placeholder="e.g. 7 days" {...form.bind('duration')} />
          <Input label="Quantity" required inputMode="numeric" {...form.bind('quantity')} />
        </FieldGrid>
      </FormModal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Remove ${deleting?.medicine_name ?? 'this item'}?`} message="The medicine will be removed from the prescription."
        confirmLabel="Remove" danger loading={busy} error={formError} />
    </>
  )
}
