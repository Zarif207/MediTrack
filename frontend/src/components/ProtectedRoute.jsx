/**
 * ProtectedRoute — guards staff dashboard routes.
 *
 * Behaviour:
 * - While auth is loading: show a full-screen spinner (prevents flash).
 * - If Firebase is not configured: show a warning but still allow access
 *   (so the demo works without Firebase — backend endpoints will return 503).
 * - If signed out: redirect to /auth/sign-in, preserving the intended URL.
 * - If signed in but wrong role: render <AccessDenied />.
 * - If signed in and role matches: render the outlet.
 *
 * allowedRoles: optional array; if omitted, any authenticated user may enter.
 */
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/useAuth'
import Spinner from './ui/Spinner'
import AccessDenied from '../pages/auth/AccessDenied'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, loading, configured } = useAuth()
  const location = useLocation()

  // Still resolving Firebase auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500 mt-3">Checking authentication…</p>
        </div>
      </div>
    )
  }

  // Firebase not configured — allow access with a banner (demo mode)
  if (!configured) {
    return <Outlet />
  }

  // Not signed in — redirect to login preserving the intended destination
  if (!user) {
    return <Navigate to="/auth/sign-in" state={{ from: location.pathname }} replace />
  }

  // Signed in but role check fails
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <AccessDenied />
  }

  return <Outlet />
}
