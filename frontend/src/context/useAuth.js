/**
 * useAuth — hook to consume the AuthContext.
 * Kept in a separate file so Vite fast-refresh works correctly.
 * The context object itself lives here to avoid circular imports.
 */
import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Returns true if the signed-in user has ANY of the supplied roles. */
export function useHasRole(...roles) {
  const { profile } = useAuth()
  return roles.includes(profile?.role)
}
