import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../context/useAuth'
import AuthShell from '../../components/AuthShell'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/States'
import { authErrorMessage } from './firebaseErrors'

export default function ForgotPassword() {
  const { sendPasswordReset, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      // Do not reveal whether an account exists for this address.
      if (err?.code === 'auth/user-not-found') setSent(true)
      else setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We’ll email you a link to choose a new password."
      footer={<Link className="link" to="/auth/sign-in">Back to sign in</Link>}>
      {sent ? (
        <Alert tone="success" title="Check your inbox">
          If an account exists for {email}, a reset link is on its way.
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!configured} />
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!configured || !email}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  )
}
