import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri'
import { useAuth } from '../../context/useAuth'
import AuthShell from '../../components/AuthShell'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/States'
import { authErrorMessage } from './firebaseErrors'

export function PasswordInput({ label = 'Password', autoComplete, hint, ...props }) {
  const [shown, setShown] = useState(false)
  return (
    <Field label={label} required hint={hint}>
      {(a11y) => (
        <div className="relative">
          <input type={shown ? 'text' : 'password'} autoComplete={autoComplete} className="control h-9 pr-10" {...a11y} {...props} />
          <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-500 hover:text-ink-900">
            {shown ? <RiEyeOffLine aria-hidden size={17} /> : <RiEyeLine aria-hidden size={17} />}
          </button>
        </div>
      )}
    </Field>
  )
}

export default function SignIn() {
  const { signIn, configured, status, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from ?? '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (status === 'ready') return <Navigate to={from} replace />

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Patients and staff use the same sign-in."
      footer={<>New to MediTrack? <Link className="link" to="/auth/sign-up" state={location.state}>Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!configured && <Alert tone="warn" title="Sign-in is not configured">Add the VITE_FIREBASE_* values to frontend/.env.</Alert>}
        {sessionExpired && !error && <Alert tone="info">Your session ended. Please sign in again.</Alert>}
        {error && <Alert>{error}</Alert>}
        <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!configured} />
        <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!configured} />
        <div className="flex justify-end">
          <Link to="/auth/forgot-password" className="text-[13px] text-ink-600 hover:text-ink-900">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!configured || !email || !password}>Sign in</Button>
      </form>
    </AuthShell>
  )
}
