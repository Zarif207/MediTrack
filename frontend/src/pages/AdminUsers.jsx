/**
 * Users & roles (admin). Assign roles and link patient accounts to patient
 * files. Linking is always a deliberate admin action — nothing is matched
 * automatically by name or email.
 */
import { useMemo, useState } from 'react'
import { RiLink, RiShieldUserLine } from 'react-icons/ri'
import { authApi, patientsApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import { ROLE_LABELS } from '../config/navigation'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import DataTable from '../components/ui/DataTable'
import SearchInput from '../components/ui/SearchInput'
import Toolbar, { FilterSelect } from '../components/ui/Toolbar'
import FormModal from '../components/ui/FormModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Select } from '../components/ui/Field'
import { Badge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/States'
import { formatDate, fullName, plural } from '../utils/format'

const ROLES = ['user', 'patient', 'receptionist', 'doctor', 'pharmacist', 'accountant', 'admin']

export default function AdminUsers() {
  const { profile: me, refreshProfile } = useAuth()
  const { notify } = useToast()
  const { data, loading, error, reload } = useAsync(() => Promise.all([authApi.listUsers(), patientsApi.listAll()]), [])
  const [users, patients] = data ?? [[], []]
  const patientById = useMemo(() => Object.fromEntries(patients.map((p) => [p.patient_id, p])), [patients])
  const linkedTo = useMemo(() => Object.fromEntries(users.filter((u) => u.patient_id).map((u) => [u.patient_id, u.firebase_uid])), [users])

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [roleChange, setRoleChange] = useState(null) // { user, role }
  const [linking, setLinking] = useState(null)
  const [linkValue, setLinkValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => !roleFilter || u.role === roleFilter)
      .filter((u) => !q || [u.display_name, u.email, u.firebase_uid].some((v) => v?.toLowerCase().includes(q)))
  }, [users, roleFilter, search])

  async function applyRole() {
    setBusy(true)
    setActionError(null)
    try {
      await authApi.setRole(roleChange.user.firebase_uid, roleChange.role)
      notify(`Role updated to ${ROLE_LABELS[roleChange.role]}.`)
      if (roleChange.user.firebase_uid === me?.firebase_uid) await refreshProfile()
      setRoleChange(null)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function applyLink() {
    setBusy(true)
    setActionError(null)
    try {
      await authApi.linkPatient(linking.firebase_uid, linkValue ? Number(linkValue) : null)
      notify(linkValue ? 'Account linked to patient file.' : 'Patient file unlinked.')
      setLinking(null)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const label = (u) => u.display_name || u.email || `${u.firebase_uid.slice(0, 8)}…`

  return (
    <>
      <PageHeader title="Users & roles"
        description="New accounts start as “Awaiting access”. Assign a role, and link patient accounts to their patient file so they can see their records and bills." />
      <Panel>
        <Toolbar count={!loading && !error ? plural(rows.length, 'account') : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, email or UID" className="sm:w-72" />
          <FilterSelect label="Role" value={roleFilter} onChange={setRoleFilter}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </FilterSelect>
        </Toolbar>
        <DataTable
          caption="User accounts" loading={loading} error={error} onRetry={reload} rows={rows} rowKey={(u) => u.firebase_uid}
          empty={<EmptyState icon={RiShieldUserLine} title="No accounts found" />}
          columns={[
            { key: 'user', header: 'Account', primary: true, render: (u) => (
              <span><span className="block font-medium text-ink-900">{label(u)}{u.firebase_uid === me?.firebase_uid && <span className="font-normal text-ink-500"> (you)</span>}</span>
                <span className="block text-xs text-ink-500">{u.email ?? 'No email'}</span></span>
            ) },
            { key: 'role', header: 'Role', render: (u) => (
              <select aria-label={`Role for ${label(u)}`} value={u.role} disabled={u.firebase_uid === me?.firebase_uid}
                onChange={(e) => { setActionError(null); setRoleChange({ user: u, role: e.target.value }) }}
                className="control h-8 w-40 py-1 text-[13px]">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            ) },
            { key: 'patient', header: 'Patient file', render: (u) => (u.role !== 'patient' && !u.patient_id ? <span className="text-ink-400">—</span> : (
              <button type="button" onClick={() => { setActionError(null); setLinkValue(u.patient_id ? String(u.patient_id) : ''); setLinking(u) }}
                className="inline-flex items-center gap-1.5 text-[13px] hover:underline">
                {u.patient_id
                  ? <><RiLink aria-hidden size={14} className="text-pine-600" />{fullName(patientById[u.patient_id]) || `#${u.patient_id}`}</>
                  : <Badge tone="warn">Not linked</Badge>}
              </button>
            )) },
            { key: 'created', header: 'Joined', hideOnMobile: true, render: (u) => formatDate(u.created_at) },
          ]}
        />
      </Panel>

      <ConfirmDialog open={!!roleChange} onClose={() => setRoleChange(null)} onConfirm={applyRole}
        title="Change role?"
        message={roleChange ? `${label(roleChange.user)} will become ${ROLE_LABELS[roleChange.role]}. The change applies to their next request.` : ''}
        confirmLabel="Change role" loading={busy} error={actionError} />

      <FormModal open={!!linking} onClose={() => setLinking(null)} size="md" title="Link patient file"
        description={linking ? label(linking) : ''} onSubmit={applyLink} busy={busy} error={actionError} submitLabel="Save link">
        <p className="text-sm text-ink-600">
          Only link a file after confirming the person’s identity. Their online bookings will be attached to the file,
          and they will see its visit records, prescriptions and bills.
        </p>
        <Select label="Patient file" value={linkValue} onChange={(e) => setLinkValue(e.target.value)}>
          <option value="">Not linked</option>
          {patients.map((p) => {
            const taken = linkedTo[p.patient_id] && linkedTo[p.patient_id] !== linking?.firebase_uid
            return <option key={p.patient_id} value={p.patient_id} disabled={taken}>{fullName(p)} · #{p.patient_id}{taken ? ' (linked to another account)' : ''}</option>
          })}
        </Select>
        {linking?.role !== 'patient' && <p className="text-xs text-warn-700">This account does not have the patient role, so a link has no effect until it does.</p>}
      </FormModal>
    </>
  )
}
