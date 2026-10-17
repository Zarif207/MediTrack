/**
 * AuthContext — Firebase sign-in state plus the server-side MediTrack profile.
 *
 * The profile (role, permissions, linked patient record) always comes from the
 * backend. If it cannot be loaded, `profile` stays null and `profileError` is
 * set; the UI never guesses a role.
 *
 * Context value:
 *   user          FirebaseUser | null
 *   profile       { firebase_uid, role, permissions[], display_name, email, patient_id } | null
 *   status        'loading' | 'signed-out' | 'ready' | 'error'
 *   profileError  ApiError | null
 *   can(perm)     true if the profile holds the permission
 *   signIn, signUp, signOut, sendPasswordReset, refreshProfile, updateDisplayName
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../services/firebase'
import { authApi, SESSION_EXPIRED_EVENT } from '../services/api'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState(isFirebaseConfigured ? 'loading' : 'signed-out')
  const [profileError, setProfileError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  // Display name chosen at sign-up, sent with the first /auth/register call.
  const pendingName = useRef(null)

  const loadProfile = useCallback(async () => {
    setProfileError(null)
    try {
      const p = await authApi.register(pendingName.current)
      pendingName.current = null
      setProfile(p)
      setStatus('ready')
      return p
    } catch (err) {
      setProfile(null)
      setProfileError(err)
      setStatus('error')
      return null
    }
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return undefined
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        setStatus('loading')
        setSessionExpired(false)
        await loadProfile()
      } else {
        setProfile(null)
        setProfileError(null)
        setStatus('signed-out')
      }
    })
  }, [loadProfile])

  useEffect(() => {
    const onExpired = () => {
      setSessionExpired(true)
      if (auth) firebaseSignOut(auth)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!auth) throw new Error('Sign-in is not configured for this installation.')
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signUp = useCallback(async (email, password, displayName) => {
    if (!auth) throw new Error('Sign-up is not configured for this installation.')
    pendingName.current = displayName || null
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) await updateProfile(cred.user, { displayName })
  }, [])

  const signOut = useCallback(async () => {
    if (auth) await firebaseSignOut(auth)
  }, [])

  const sendPasswordReset = useCallback(async (email) => {
    if (!auth) throw new Error('Password reset is not configured for this installation.')
    await sendPasswordResetEmail(auth, email)
  }, [])

  const updateDisplayName = useCallback(async (displayName) => {
    const p = await authApi.updateMe({ display_name: displayName })
    setProfile(p)
    return p
  }, [])

  const value = useMemo(() => {
    const permissions = new Set(profile?.permissions ?? [])
    return {
      user,
      profile,
      role: profile?.role ?? null,
      status,
      loading: status === 'loading',
      profileError,
      sessionExpired,
      configured: isFirebaseConfigured,
      can: (perm) => permissions.has(perm),
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      refreshProfile: loadProfile,
      updateDisplayName,
    }
  }, [user, profile, status, profileError, sessionExpired, signIn, signUp, signOut,
    sendPasswordReset, loadProfile, updateDisplayName])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
