import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import { ROLE_LABELS } from '../config/navigation'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Button from '../components/ui/Button'
import DetailList from '../components/ui/DetailList'
import { Input } from '../components/ui/Field'
import { Alert } from '../components/ui/States'

export default function Profile() {
  const { user, profile, updateDisplayName } = useAuth()
  const { notify } = useToast()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateDisplayName(name.trim() || null)
      notify('Profile updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" description="How you appear in MediTrack." />
      <div className="space-y-6">
        <Panel title="Display name" bodyClassName="p-4 sm:p-5">
          <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input label="Name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Button type="submit" loading={busy} disabled={name === (profile?.display_name ?? '')}>Save</Button>
          </form>
          {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        </Panel>
        <Panel title="Account" bodyClassName="px-4 py-1 sm:px-5">
          <DetailList items={[
            ['Email', user?.email],
            ['Role', ROLE_LABELS[profile?.role] ?? profile?.role],
            profile?.role === 'patient' && ['Patient file', profile?.patient_id ? `Linked (#${profile.patient_id})` : 'Not linked yet — the clinic links it after your first visit'],
          ]} />
        </Panel>
        <p className="text-xs text-ink-500">
          Your email and password are managed by the sign-in service. Use “Forgot password” on the sign-in page to change your password.
        </p>
      </div>
    </div>
  )
}
