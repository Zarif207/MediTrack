/** Route-level access rules. They mirror app/auth/permissions.py on the server. */
export const STAFF_ROLES = ['admin', 'receptionist', 'doctor', 'pharmacist', 'accountant']

export const isPatient = (a) => a.role === 'patient'
export const isStaff = (a) => STAFF_ROLES.includes(a.role)
export const staffCan = (perm) => (a) => isStaff(a) && a.can(perm)
export const patientOr = (perm) => (a) => isPatient(a) || staffCan(perm)(a)
