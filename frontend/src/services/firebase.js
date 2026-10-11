/**
 * Firebase client SDK initialisation.
 *
 * All VITE_FIREBASE_* environment variables are PUBLIC Firebase web-app
 * configuration values.  They are not secret.  They identify the Firebase
 * project but do not grant any elevated access by themselves.
 *
 * Set them in frontend/.env (copy frontend/.env.example and fill in the
 * values from Firebase Console → Project Settings → Your apps).
 *
 * NEVER put a Firebase service-account private key or any other secret in a
 * VITE_* variable — Vite exposes these to browser code.
 */
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True when at least the apiKey is configured */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey)

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null

/** Firebase Auth instance — null if Firebase is not configured */
export const auth = app ? getAuth(app) : null

export default app
