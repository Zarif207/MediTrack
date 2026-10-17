import { useMemo, useState } from 'react'
import { RiAddLine, RiDeleteBinLine, RiMedicineBottleLine, RiPencilLine } from 'react-icons/ri'
import { medicinesApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
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
import { Badge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/States'
import { formatCurrency, plural } from '../utils/format'

const LOW_STOCK = 10
const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Patch', 'Suppository', 'Other']
const EMPTY = { medicine_name: '', generic_name: '', dosage_form: '', strength: '', manufacturer: '', unit_price: '', stock_quantity: '' }

function validate(v) {
  const e = {}
  for (const k of ['medicine_name', 'generic_name', 'dosage_form', 'strength', 'manufacturer']) {
    if (!String(v[k]).trim()) e[k] = 'Required.'
  }
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(v.unit_price))) e.unit_price = 'Enter a price such as 12.50.'
  if (!/^\d+$/.test(String(v.stock_quantity)) || Number(v.stock_quantity) > 1_000_000) e.stock_quantity = 'Enter a whole number from 0 to 1,000,000.'
  return e
}

export default function Medicines() {
  const { can } = useAuth()
  const { notify } = useToast()
  const canWrite = can('medicines:write')
  const canDelete = can('medicines:delete')
  const { data, loading, error, reload } = useAsync(() => medicinesApi.listAll(), [])
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const form = useForm(EMPTY)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? [])
      .filter((m) => !lowOnly || m.stock_quantity <= LOW_STOCK)
      .filter((m) => !q || [m.medicine_name, m.generic_name, m.manufacturer].some((v) => v.toLowerCase().includes(q)))
  }, [data, search, lowOnly])

  function openForm(m) {
    setFormError(null)
    form.reset(m === 'new' ? EMPTY : Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String(m[k] ?? '')])))
    setEditing(m)
  }

  async function save() {
    const errs = validate(form.values)
    form.setErrors(errs)
    if (Object.keys(errs).length) return
    const body = { ...form.values, stock_quantity: Number(form.values.stock_quantity) }
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') { await medicinesApi.create(body); notify('Medicine added.') }
      else { await medicinesApi.update(editing.medicine_id, body); notify('Medicine updated.') }
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
      await medicinesApi.remove(deleting.medicine_id)
      setDeleting(null)
      notify('Medicine deleted.')
      reload()
    } catch (err) {
      setFormError(err.status === 409 ? 'This medicine appears on a prescription and cannot be deleted.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Medicines" description="Formulary and stock levels."
        actions={canWrite && <Button icon={RiAddLine} onClick={() => openForm('new')}>Add medicine</Button>} />
      <Panel>
        <Toolbar count={!loading && !error ? plural(rows.length, 'medicine') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, generic name or manufacturer" className="sm:w-80" />
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="accent-pine-700" />
            Low stock only (≤ {LOW_STOCK})
          </label>
        </Toolbar>
        <DataTable
          caption="Medicines" loading={loading} error={error} onRetry={reload} rows={rows} rowKey={(m) => m.medicine_id}
          empty={<EmptyState icon={RiMedicineBottleLine} title="No medicines found" />}
          columns={[
            { key: 'medicine_name', header: 'Medicine', primary: true, render: (m) => (
              <span><span className="block font-medium text-ink-900">{m.medicine_name}</span>
                <span className="block text-xs text-ink-500">{m.generic_name}</span></span>
            ) },
            { key: 'form', header: 'Form', render: (m) => `${m.dosage_form} · ${m.strength}` },
            { key: 'manufacturer', header: 'Manufacturer', hideOnMobile: true },
            { key: 'unit_price', header: 'Unit price', align: 'right', render: (m) => formatCurrency(m.unit_price) },
            { key: 'stock', header: 'Stock', align: 'right', render: (m) => (
              m.stock_quantity <= LOW_STOCK ? <Badge tone="warn">{m.stock_quantity} low</Badge> : m.stock_quantity
            ) },
          ]}
          actions={(canWrite || canDelete) ? (m) => (
            <>
              {canWrite && <IconButton icon={RiPencilLine} label={`Edit ${m.medicine_name}`} onClick={() => openForm(m)} />}
              {canDelete && <IconButton icon={RiDeleteBinLine} tone="danger" label={`Delete ${m.medicine_name}`} onClick={() => { setFormError(null); setDeleting(m) }} />}
            </>
          ) : undefined}
        />
      </Panel>

      <FormModal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add medicine' : `Edit ${editing?.medicine_name}`}
        onSubmit={save} busy={busy} error={formError} submitLabel={editing === 'new' ? 'Add medicine' : 'Save changes'}>
        <FieldGrid>
          <Input label="Brand name" required maxLength={150} {...form.bind('medicine_name')} />
          <Input label="Generic name" required maxLength={150} {...form.bind('generic_name')} />
          <Select label="Dosage form" required {...form.bind('dosage_form')}>
            <option value="">Select…</option>
            {FORMS.map((f) => <option key={f}>{f}</option>)}
            {form.values.dosage_form && !FORMS.includes(form.values.dosage_form) && <option>{form.values.dosage_form}</option>}
          </Select>
          <Input label="Strength" required maxLength={50} placeholder="e.g. 500 mg" {...form.bind('strength')} />
          <Input label="Manufacturer" required maxLength={150} {...form.bind('manufacturer')} />
          <Input label="Unit price" required inputMode="decimal" {...form.bind('unit_price')} />
          <Input label="Units in stock" required inputMode="numeric" {...form.bind('stock_quantity')} />
        </FieldGrid>
      </FormModal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete}
        title={`Delete ${deleting?.medicine_name}?`} message="Medicines that appear on a prescription cannot be deleted."
        confirmLabel="Delete medicine" danger loading={busy} error={formError} />
    </>
  )
}
