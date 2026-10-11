import { Link } from 'react-router'
import { useAuth } from '../../context/useAuth'
import { RiShieldLine, RiArrowLeftLine, RiLogoutBoxLine } from 'react-icons/ri'

export default function AccessDenied() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
          <RiShieldLine size={36} className="text-red-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-2">
          You don't have permission to view this page.
        </p>
        {profile && (
          <p className="text-sm text-gray-400 mb-6">
            Signed in as <span className="font-medium text-gray-600">{profile.email ?? profile.display_name}</span>{' '}
            with role <span className="font-semibold text-navy-700">{profile.role}</span>.
            Contact an administrator to have your role updated.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-navy-800 text-white font-medium hover:bg-navy-900 transition-colors text-sm">
            <RiArrowLeftLine size={15} /> Dashboard
          </Link>
          <button onClick={signOut}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors text-sm">
            <RiLogoutBoxLine size={15} /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
