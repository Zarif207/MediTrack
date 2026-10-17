/**
 * useAuth — hook to consume the AuthContext.
 * Kept in a separate file so Vite fast-refresh works correctly.
 */
import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
