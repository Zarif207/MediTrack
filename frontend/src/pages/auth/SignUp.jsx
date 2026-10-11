import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../context/useAuth'
import { RiHeartPulseLine, RiMailLine, RiLockLine, RiUserLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri'

export default function SignUp() {
  const { signUp, configured } = useAuth()
  const navigate = useNavigate()

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await signUp(email, password, name.trim() || undefined)
      // New accounts get 'patient' role. An admin must promote via /auth/users.
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(friendlyFirebaseError(err.code ?? err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-950 to-navy-800 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 mb-4">
            <RiHeartPulseLine size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create an account</h1>
          <p className="text-navy-300 mt-1.5 text-sm">
            New accounts start with the <strong className="text-teal-300">patient</strong> role.
            An admin can promote your account after you sign up.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!configured && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              Firebase is not configured. See <code>frontend/.env.example</code>.
            </div>
          )}
          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Display name</label>
              <div className="relative">
                <RiUserLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 text-sm"
                  placeholder="Your name (optional)" disabled={!configured || loading} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Email address <span className="text-red-500">*</span></label>
              <div className="relative">
                <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 text-sm"
                  placeholder="you@example.com" disabled={!configured || loading} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type={showPwd ? 'text' : 'password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 text-sm"
                  placeholder="Min 8 characters" disabled={!configured || loading} />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showPwd ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Confirm password <span className="text-red-500">*</span></label>
              <div className="relative">
                <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type={showPwd ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 text-sm"
                  placeholder="Repeat password" disabled={!configured || loading} />
              </div>
            </div>

            <button type="submit" disabled={!configured || loading}
              className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/auth/sign-in" className="text-teal-600 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-navy-300 hover:text-white transition-colors">← Back to public website</Link>
        </div>
      </div>
    </div>
  )
}

function friendlyFirebaseError(code) {
  const map = {
    'auth/email-already-in-use':  'An account with this email already exists.',
    'auth/invalid-email':         'Invalid email address.',
    'auth/weak-password':         'Password is too weak. Use at least 8 characters.',
    'auth/network-request-failed':'Network error. Check your connection.',
  }
  return map[code] ?? `Sign-up failed: ${code}`
}
