/**
 * Route guards.
 *
 * <RequireAuth /> waits for Firebase + the server profile, redirects signed-out
 * visitors to sign-in (keeping the requested URL), and shows a recovery screen
 * if the profile cannot be loaded. It never renders protected content on a
 * guessed role.
 *
 * <RequireAccess allow={(auth) => boolean} /> renders AccessDenied inside the
 * layout when the check fails. The API enforces the same rules server-side.
 */
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/useAuth'
import { FullPageMessage, FullPageLoader } from './FullPage'
import AccessDenied from '../pages/auth/AccessDenied'
import Button from './ui/Button'

export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()

  if (!auth.configured) {
    return (
      <FullPageMessage title="Sign-in is not configured"
        body="This installation has no Firebase web configuration. Add the VITE_FIREBASE_* values to frontend/.env and restart the dev server." />
    )
  }
  if (auth.status === 'loading') return <FullPageLoader label="Loading your account" />
  if (auth.status === 'signed-out') {
    return <Navigate to="/auth/sign-in" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  if (auth.status === 'error') {
    return (
      <FullPageMessage
        title="We couldn't load your account"
        body={auth.profileError?.message ?? 'The server did not respond.'}
        actions={
          <>
            <Button onClick={auth.refreshProfile}>Try again</Button>
            <Button variant="secondary" onClick={auth.signOut}>Sign out</Button>
          </>
        }
      />
    )
  }
  return <Outlet />
}

export function RequireAccess({ allow }) {
  const auth = useAuth()
  return allow(auth) ? <Outlet /> : <AccessDenied />
}

/** Patients get their own view of a section; staff get the management view. */
export function ByRole({ patient, staff }) {
  const { role } = useAuth()
  return role === 'patient' ? patient : staff
}
