/**
 * AuthContext — provides Firebase authentication state + UserProfile role
 * throughout the React tree.
 *
 * Context value shape:
 *   {
 *     user:        FirebaseUser | null,  // Firebase auth user
 *     profile:     UserProfile | null,   // { role, display_name, email } from PostgreSQL
 *     loading:     boolean,              // true while auth state is being resolved
 *     configured:  boolean,              // false if VITE_FIREBASE_* env vars are missing
 *     signIn:      (email, password) => Promise<void>,
 *     signUp:      (email, password, displayName?) => Promise<void>,
 *     signOut:     () => Promise<void>,
 *     sendPasswordReset: (email) => Promise<void>,
 *     getIdToken:  () => Promise<string | null>,  // fresh Firebase ID token
 *   }
 */
import { useEffect, useState, useCallback } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../services/firebase'
import { AuthContext } from './useAuth'

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
const REGISTER_URL = `${BASE}/auth/register`
const ME_URL       = `${BASE}/auth/me`

/** Sync the PostgreSQL UserProfile after Firebase sign-in */
async function syncProfile(firebaseUser) {
  if (!firebaseUser) return null
  const token = await firebaseUser.getIdToken()

  // Try GET /auth/me first (profile already exists)
  try {
    const res = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return await res.json()
  } catch {
    // Backend not running — return minimal stub so UI still renders
    return {
      firebase_uid: firebaseUser.uid,
      role: 'patient',
      display_name: firebaseUser.displayName,
      email: firebaseUser.email,
    }
  }

  // Profile not found — create it (first sign-in)
  try {
    const res = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firebase_uid: firebaseUser.uid,
        display_name: firebaseUser.displayName,
        email: firebaseUser.email,
      }),
    })
    if (res.ok) return await res.json()
  } catch {
    // Backend not running
  }

  return {
    firebase_uid: firebaseUser.uid,
    role: 'patient',
    display_name: firebaseUser.displayName,
    email: firebaseUser.email,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const p = await syncProfile(firebaseUser)
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const getIdToken = useCallback(async () => {
    if (!user) return null
    try {
      return await user.getIdToken(false)
    } catch {
      return null
    }
  }, [user])

  const signIn = useCallback(async (email, password) => {
    if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* variables to frontend/.env')
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signUp = useCallback(async (email, password, displayName) => {
    if (!auth) throw new Error('Firebase is not configured.')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) await updateProfile(cred.user, { displayName })
    const p = await syncProfile(cred.user)
    setProfile(p)
  }, [])

  const signOutFn = useCallback(async () => {
    if (!auth) return
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
  }, [])

  const sendPasswordReset = useCallback(async (email) => {
    if (!auth) throw new Error('Firebase is not configured.')
    await sendPasswordResetEmail(auth, email)
  }, [])

  const value = {
    user,
    profile,
    loading,
    configured: isFirebaseConfigured,
    signIn,
    signUp,
    signOut: signOutFn,
    sendPasswordReset,
    getIdToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
