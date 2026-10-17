import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../context/useAuth'
import AuthShell from '../../components/AuthShell'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/States'
import { PasswordInput } from './SignIn'
import { authErrorMessage } from './firebaseErrors'

export default function SignUp() {
  const { signUp, configured, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (status === 'ready' && !busy) return <Navigate to="/dashboard" replace />

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    if (!name.trim()) return setError('Enter your name.')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    if (password !== confirm) return setError('The passwords do not match.')
    setBusy(true)
    setError(null)
    try {
      await signUp(email.trim(), password, name.trim())
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle="After you sign up, the clinic gives your account access — as a patient, or as staff."
      footer={<>Already have an account? <Link className="link" to="/auth/sign-in" state={location.state}>Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!configured && <Alert tone="warn" title="Sign-up is not configured">Add the VITE_FIREBASE_* values to frontend/.env.</Alert>}
        {error && <Alert>{error}</Alert>}
        <Input label="Full name" required autoComplete="name" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} disabled={!configured} />
        <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!configured} />
        <PasswordInput autoComplete="new-password" hint="At least 8 characters." value={password} onChange={(e) => setPassword(e.target.value)} disabled={!configured} />
        <PasswordInput label="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!configured} />
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!configured}>Create account</Button>
      </form>
    </AuthShell>
  )
}
