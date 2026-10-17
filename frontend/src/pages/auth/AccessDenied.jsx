import { RiLockLine } from 'react-icons/ri'
import { useAuth } from '../../context/useAuth'
import { ROLE_LABELS } from '../../config/navigation'
import Button from '../../components/ui/Button'

/** Rendered inside the app layout when the signed-in role may not open a page. */
export default function AccessDenied() {
  const { role } = useAuth()
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
        <RiLockLine aria-hidden size={21} />
      </div>
      <h1 className="text-lg font-semibold">This page isn’t available to your account</h1>
      <p className="mt-2 text-sm text-ink-600">
        You are signed in as <strong className="font-medium">{ROLE_LABELS[role] ?? role ?? 'an unknown role'}</strong>.
        If you need access, ask an administrator to review your role.
      </p>
      <Button className="mt-6" variant="secondary" to="/dashboard">Back to overview</Button>
    </div>
  )
}
