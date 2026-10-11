/**
 * Admin Users page — list all user profiles and assign roles.
 * Only accessible to users with the 'admin' role.
 */
import { useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'
import { PageLoader } from '../components/ui/Spinner'
import ErrorAlert from '../components/ui/ErrorAlert'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Button from '../components/ui/Button'
import { RiUserSettingsLine, RiCheckLine } from 'react-icons/ri'

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
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [saving, setSaving]     = useState(null) // uid being saved
  const [pending, setPending]   = useState({})   // { uid: newRole }
  const [confirm, setConfirm]   = useState(null) // { uid, role, name }

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); setUsers(await authApi.listUsers()) }
    catch (e) { setError(e.message) } finally { setLoading(false) }
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
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(null)
      setConfirm(null)
    }
  }

  return (
    <div className="space-y-5">
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
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Firebase UID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Role</th>
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
                      <td className="px-5 py-3 font-mono text-xs text-gray-400 max-w-[120px] truncate" title={u.firebase_uid}>
                        {u.firebase_uid.slice(0, 16)}…
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 w-40">
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

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => applyRole(confirm.uid, confirm.role)}
        title="Change User Role"
        message={`Set role for "${confirm?.displayName}" to "${confirm?.role}"? This affects what API endpoints they can access.`}
        confirmLabel="Apply role"
        loading={!!saving}
      />
    </div>
  )
}
