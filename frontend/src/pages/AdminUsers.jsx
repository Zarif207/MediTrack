/**
 * Admin Users page — list all user profiles, assign roles, and link patient records.
 * Only accessible to users with the 'admin' role.
 */
import { useState, useEffect, useCallback } from 'react'
import { authApi, patientsApi } from '../services/api'
import { PageLoader } from '../components/ui/Spinner'
import ErrorAlert from '../components/ui/ErrorAlert'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { RiUserSettingsLine, RiCheckLine, RiLinkM, RiLinkUnlinkM } from 'react-icons/ri'

const ROLES = ['admin', 'receptionist', 'doctor', 'pharmacist', 'accountant', 'patient']

const ROLE_COLORS = {
  admin:        'bg-red-100 text-red-700 border-red-200',
  receptionist: 'bg-blue-100 text-blue-700 border-blue-200',
  doctor:       'bg-teal-100 text-teal-700 border-teal-200',
  pharmacist:   'bg-green-100 text-green-700 border-green-200',
  accountant:   'bg-amber-100 text-amber-700 border-amber-200',
  patient:      'bg-gray-100 text-gray-600 border-gray-200',
}

export default function AdminUsers() {
  const [users, setUsers]             = useState([])
  const [patients, setPatients]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [saving, setSaving]           = useState(null)
  const [pending, setPending]         = useState({})
  const [confirm, setConfirm]         = useState(null)
  const [linkModal, setLinkModal]     = useState(null) // { uid, displayName, currentPatientId }
  const [linkPatientId, setLinkPatientId] = useState('')
  const [linkSaving, setLinkSaving]   = useState(false)
  const [linkError, setLinkError]     = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [u, p] = await Promise.all([authApi.listUsers(), patientsApi.list({ limit: 100 })])
      setUsers(u); setPatients(p)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function setLocalRole(uid, role) {
    setPending((p) => ({ ...p, [uid]: role }))
  }

  async function applyRole(uid, role) {
    try {
      setSaving(uid)
      await authApi.setRole(uid, role)
      setPending((p) => { const copy = { ...p }; delete copy[uid]; return copy })
      load()
    } catch (e) { setError(e.message) }
    finally { setSaving(null); setConfirm(null) }
  }

  function openLinkModal(u) {
    setLinkError(null)
    setLinkPatientId(u.patient_id ? String(u.patient_id) : '')
    setLinkModal({ uid: u.firebase_uid, displayName: u.display_name ?? u.email ?? u.firebase_uid, currentPatientId: u.patient_id })
  }

  async function applyLink() {
    try {
      setLinkSaving(true); setLinkError(null)
      const patientId = linkPatientId === '' ? null : Number(linkPatientId)
      await authApi.linkPatient(linkModal.uid, patientId)
      setLinkModal(null)
      load()
    } catch (e) { setLinkError(e.message) }
    finally { setLinkSaving(false) }
  }

  const patientMap = Object.fromEntries(patients.map((p) => [p.patient_id, `${p.first_name} ${p.last_name} (#${p.patient_id})`]))

  return (
    <div className="space-y-5">
      <div className="px-1">
        <p className="text-sm text-gray-500">
          Assign roles to Firebase accounts and link patient-role users to their patient record.
          Only linked patients can access their own health data.
        </p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <RiUserSettingsLine size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Loading…' : `${users.length} registered user${users.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? <PageLoader /> : users.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No users yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">UID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Linked Patient</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change Role</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Apply</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const selectedRole = pending[u.firebase_uid] ?? u.role
                  const changed = selectedRole !== u.role
                  return (
                    <tr key={u.firebase_uid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{u.display_name ?? '(no name)'}</p>
                        <p className="text-xs text-gray-400">{u.email ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-400 max-w-[110px] truncate" title={u.firebase_uid}>
                        {u.firebase_uid.slice(0, 12)}…
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {u.patient_id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-teal-700 font-medium">{patientMap[u.patient_id] ?? `#${u.patient_id}`}</span>
                            <button onClick={() => openLinkModal(u)} className="p-1 text-gray-400 hover:text-teal-600 transition-colors" title="Change link">
                              <RiLinkM size={13} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => openLinkModal(u)}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors">
                            <RiLinkUnlinkM size={13} /> Unlinked
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3 w-36">
                        <select
                          value={selectedRole}
                          onChange={(e) => setLocalRole(u.firebase_uid, e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant={changed ? 'secondary' : 'outline'}
                          disabled={!changed}
                          loading={saving === u.firebase_uid}
                          icon={!changed ? <RiCheckLine size={13} /> : null}
                          onClick={() => setConfirm({ uid: u.firebase_uid, role: selectedRole, displayName: u.display_name ?? u.email ?? u.firebase_uid })}
                        >
                          {changed ? 'Apply' : 'Saved'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role change confirmation */}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => applyRole(confirm.uid, confirm.role)}
        title="Change User Role"
        message={`Set role for "${confirm?.displayName}" to "${confirm?.role}"?`}
        confirmLabel="Apply role"
        loading={!!saving}
      />

      {/* Link patient modal */}
      <Modal open={!!linkModal} onClose={() => setLinkModal(null)} title="Link Patient Record" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Link <strong>{linkModal?.displayName}</strong> to a patient record.
            Patients can only access their own data once linked. Only admins can do this.
          </p>
          {linkError && <ErrorAlert message={linkError} onDismiss={() => setLinkError(null)} />}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Patient record</label>
            <select
              value={linkPatientId}
              onChange={(e) => setLinkPatientId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
            >
              <option value="">— Unlink (no patient) —</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.first_name} {p.last_name} — #{p.patient_id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setLinkModal(null)} disabled={linkSaving}>Cancel</Button>
            <Button onClick={applyLink} loading={linkSaving}>Save Link</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
