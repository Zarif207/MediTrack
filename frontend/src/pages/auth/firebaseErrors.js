/** Human-readable messages for Firebase Auth error codes. */
const MESSAGES = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes or reset your password.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
  'auth/operation-not-allowed': 'Email sign-in is not enabled for this project.',
}

export function authErrorMessage(err) {
  return MESSAGES[err?.code] ?? err?.message?.replace(/^Firebase: /, '') ?? 'Something went wrong. Please try again.'
}
