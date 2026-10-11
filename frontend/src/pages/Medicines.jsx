import { useState, useEffect, useCallback } from 'react'
import { medicinesApi } from '../services/api'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Input from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/ui/ErrorAlert'
import { formatCurrency } from '../utils/format'
import {
  RiMedicineBottleLine, RiAddLine, RiSearchLine,
  RiEditLine, RiDeleteBinLine, RiEyeLine, RiCloseLine, RiAlertLine,
} from 'react-icons/ri'

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Patch', 'Suppository', 'Other']
const LOW_STOCK = 10

const EMPTY_FORM = {
  medicine_name: '', generic_name: '', dosage_form: '', strength: '',
  manufacturer: '', unit_price: '', stock_quantity: '',
}

function MedForm({ initial, onSubmit, onCancel, loading, error }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function validate() {
    const e = {}
    if (!form.medicine_name.trim()) e.medicine_name = 'Medicine name is required'
    if (!form.generic_name.trim()) e.generic_name = 'Generic name is required'
    if (!form.dosage_form.trim()) e.dosage_form = 'Dosage form is required'
    if (!form.strength.trim()) e.strength = 'Strength is required'
    if (!form.manufacturer.trim()) e.manufacturer = 'Manufacturer is required'
    if (form.unit_price === '' || isNaN(Number(form.unit_price)) || Number(form.unit_price) < 0) e.unit_price = 'Valid price required (≥ 0)'
    if (form.stock_quantity === '' || !Number.isInteger(Number(form.stock_quantity)) || Number(form.stock_quantity) < 0) e.stock_quantity = 'Valid stock quantity required (≥ 0)'
    setErrors(e); return !Object.keys(e).length
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      medicine_name: form.medicine_name,
      generic_name: form.generic_name,
      dosage_form: form.dosage_form,
      strength: form.strength,
      manufacturer: form.manufacturer,
      unit_price: form.unit_price,
      stock_quantity: Number(form.stock_quantity),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Medicine Name" required value={form.medicine_name} onChange={(e) => set('medicine_name', e.target.value)} error={errors.medicine_name} />
        <Input label="Generic Name" required value={form.generic_name} onChange={(e) => set('generic_name', e.target.value)} error={errors.generic_name} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Dosage Form <span className="text-red-500">*</span></label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            value={form.dosage_form}
            onChange={(e) => set('dosage_form', e.target.value)}
          >
            <option value="">Select form…</option>
            {DOSAGE_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {errors.dosage_form && <p className="text-xs text-red-600">{errors.dosage_form}</p>}
        </div>
        <Input label="Strength" required value={form.strength} onChange={(e) => set('strength', e.target.value)} error={errors.strength} placeholder="e.g. 500mg" />
        <Input label="Manufacturer" required value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} error={errors.manufacturer} />
        <Input label="Unit Price" type="number" required value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} error={errors.unit_price} min="0" step="0.01" placeholder="0.00" />
        <Input label="Stock Quantity" type="number" required value={form.stock_quantity} onChange={(e) => set('stock_quantity', e.target.value)} error={errors.stock_quantity} min="0" step="1" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Medicine</Button>
      </div>
    </form>
  )
}

function MedDetail({ med, onEdit, onClose }) {
  const row = (label, val) => (
    <div key={label} className="flex flex-col sm:flex-row gap-1 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 sm:w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-800">{val ?? '—'}</span>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-green-200 flex items-center justify-center text-green-700">
          <RiMedicineBottleLine size={18} />
        </div>
        <div>
          <p className="font-bold text-gray-900">{med.medicine_name}</p>
          <p className="text-sm text-gray-500">{med.generic_name}</p>
        </div>
      </div>
      {row('Dosage Form', med.dosage_form)}
      {row('Strength', med.strength)}
      {row('Manufacturer', med.manufacturer)}
      {row('Unit Price', formatCurrency(med.unit_price))}
      {row('Stock Quantity', med.stock_quantity)}
      {row('Medicine ID', `#${med.medicine_id}`)}
      {Number(med.stock_quantity) <= LOW_STOCK && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <RiAlertLine size={15} /> <span>Low stock warning</span>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} icon={<RiCloseLine size={15} />}>Close</Button>
        <Button onClick={onEdit} icon={<RiEditLine size={15} />}>Edit</Button>
      </div>
    </div>
  )
}

export default function Medicines() {
  const [meds, setMeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); setMeds(await medicinesApi.list({ limit: 100 })) }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = meds.filter((m) => {
    if (lowStockOnly && Number(m.stock_quantity) > LOW_STOCK) return false
    if (!search) return true
    const q = search.toLowerCase()
    return m.medicine_name.toLowerCase().includes(q)
      || m.generic_name.toLowerCase().includes(q)
      || m.manufacturer.toLowerCase().includes(q)
  })

  async function handleCreate(payload) {
    try { setSaving(true); setFormError(null); await medicinesApi.create(payload); setFormOpen(false); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleUpdate(payload) {
    try { setSaving(true); setFormError(null); await medicinesApi.update(editTarget.medicine_id, payload); setEditTarget(null); load() }
    catch (e) { setFormError(e.message) } finally { setSaving(false) }
  }
  async function handleDelete() {
    try { setDeleting(true); await medicinesApi.delete(deleteTarget.medicine_id); setDeleteTarget(null); load() }
    catch (e) { setError(e.message) } finally { setDeleting(false) }
  }

  const lowCount = meds.filter((m) => Number(m.stock_quantity) <= LOW_STOCK).length

  return (
    <div className="space-y-5">
      {lowCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <RiAlertLine size={16} className="shrink-0" />
          <span><strong>{lowCount}</strong> medicine{lowCount !== 1 ? 's' : ''} with low stock (≤{LOW_STOCK} units)</span>
          <button onClick={() => setLowStockOnly((v) => !v)} className="ml-auto text-xs underline font-medium">
            {lowStockOnly ? 'Show all' : 'Show low stock'}
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            placeholder="Search medicines…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button icon={<RiAddLine size={16} />} onClick={() => { setFormError(null); setFormOpen(true) }}>Add Medicine</Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiMedicineBottleLine size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${filtered.length} medicine${filtered.length !== 1 ? 's' : ''}`}
            {lowStockOnly && ' (low stock)'}
          </span>
        </div>
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState icon={<RiMedicineBottleLine size={28} />} title="No medicines found"
            action={!search && !lowStockOnly && <Button icon={<RiAddLine size={15} />} onClick={() => setFormOpen(true)}>Add Medicine</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Generic Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Form / Strength</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manufacturer</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((m) => (
                  <tr key={m.medicine_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{m.medicine_name}</td>
                    <td className="px-5 py-3 text-gray-500 italic">{m.generic_name}</td>
                    <td className="px-5 py-3 text-gray-600">{m.dosage_form} · {m.strength}</td>
                    <td className="px-5 py-3 text-gray-600">{m.manufacturer}</td>
                    <td className="px-5 py-3 text-right text-gray-700 font-medium">{formatCurrency(m.unit_price)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-medium ${Number(m.stock_quantity) <= LOW_STOCK ? 'text-amber-600' : 'text-gray-700'}`}>
                        {m.stock_quantity}
                        {Number(m.stock_quantity) <= LOW_STOCK && <RiAlertLine className="inline ml-1 mb-0.5" size={12} />}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewTarget(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><RiEyeLine size={15} /></button>
                        <button onClick={() => { setFormError(null); setEditTarget(m) }} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit"><RiEditLine size={15} /></button>
                        <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><RiDeleteBinLine size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add Medicine" size="lg">
        <MedForm onSubmit={handleCreate} onCancel={() => setFormOpen(false)} loading={saving} error={formError} />
      </Modal>
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Medicine" size="lg">
        {editTarget && <MedForm
          initial={{ ...editTarget, unit_price: String(editTarget.unit_price), stock_quantity: String(editTarget.stock_quantity) }}
          onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving} error={formError} />}
      </Modal>
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Medicine Details">
        {viewTarget && <MedDetail med={viewTarget}
          onEdit={() => { setFormError(null); setEditTarget(viewTarget); setViewTarget(null) }}
          onClose={() => setViewTarget(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Medicine" danger loading={deleting}
        message={`Delete "${deleteTarget?.medicine_name}"? This cannot be undone.`}
        confirmLabel="Delete" />
    </div>
  )
}
