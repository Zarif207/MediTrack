import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../context/useAuth'
import { RiHeartPulseLine, RiMailLine, RiCheckLine } from 'react-icons/ri'

export default function ForgotPassword() {
  const { sendPasswordReset, configured } = useAuth()
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-950 to-navy-800 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 mb-4">
            <RiHeartPulseLine size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset your password</h1>
          <p className="text-navy-300 mt-1.5 text-sm">We'll send a reset link to your email.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <RiCheckLine size={24} className="text-green-600" />
              </div>
              <p className="font-semibold text-gray-900 mb-1">Check your inbox</p>
              <p className="text-sm text-gray-500">A password reset link has been sent to <strong>{email}</strong>.</p>
              <Link to="/auth/sign-in" className="mt-5 inline-block text-sm text-teal-600 hover:underline font-medium">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Email address</label>
                  <div className="relative">
                    <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 text-sm"
                      placeholder="you@example.com" disabled={!configured || loading} />
                  </div>
                </div>
                <button type="submit" disabled={!configured || loading}
                  className="w-full py-2.5 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <div className="mt-5 text-center">
                <Link to="/auth/sign-in" className="text-sm text-teal-600 hover:underline">Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
