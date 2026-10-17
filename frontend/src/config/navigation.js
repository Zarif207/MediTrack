/**
 * Role-aware navigation.
 *
 * Each entry is shown when `visible(auth)` is true. Visibility mirrors the
 * backend permission matrix (app/auth/permissions.py) via the permissions the
 * server returns in /auth/me — the server still enforces every request.
 */
import {
  RiDashboardLine, RiCalendarScheduleLine, RiCalendarCheckLine, RiUserHeartLine,
  RiStethoscopeLine, RiHospitalLine, RiFileList3Line, RiCapsuleLine,
  RiMedicineBottleLine, RiListCheck3, RiBillLine, RiShieldUserLine, RiUser3Line,
} from 'react-icons/ri'

import { isPatient, isStaff, staffCan as can } from './access'

export const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'Overview', icon: RiDashboardLine, visible: () => true, end: true },
    ],
  },
  {
    label: 'My care',
    items: [
      { to: '/patient/book-appointment', label: 'Book appointment', icon: RiCalendarScheduleLine, visible: isPatient },
      { to: '/appointments', label: 'My appointments', icon: RiCalendarCheckLine, visible: isPatient },
      { to: '/medical-records', label: 'Visit records', icon: RiFileList3Line, visible: isPatient },
      { to: '/prescriptions', label: 'Prescriptions', icon: RiCapsuleLine, visible: isPatient },
      { to: '/bills', label: 'Bills', icon: RiBillLine, visible: isPatient },
    ],
  },
  {
    label: 'Front desk',
    items: [
      { to: '/appointments', label: 'Appointments', icon: RiCalendarCheckLine, visible: can('appointments:read') },
      { to: '/patients', label: 'Patients', icon: RiUserHeartLine, visible: can('patients:read') },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { to: '/medical-records', label: 'Medical records', icon: RiFileList3Line, visible: can('medical_records:read') },
      { to: '/prescriptions', label: 'Prescriptions', icon: RiCapsuleLine, visible: can('prescriptions:read') },
      { to: '/prescription-items', label: 'Prescription items', icon: RiListCheck3, visible: can('prescription_items:read') },
      { to: '/medicines', label: 'Medicines', icon: RiMedicineBottleLine, visible: can('medicines:read') },
    ],
  },
  {
    label: 'Billing',
    items: [
      { to: '/bills', label: 'Bills', icon: RiBillLine, visible: can('bills:read') },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { to: '/doctors', label: 'Doctors', icon: RiStethoscopeLine, visible: isStaff },
      { to: '/departments', label: 'Departments', icon: RiHospitalLine, visible: isStaff },
      { to: '/admin/users', label: 'Users & roles', icon: RiShieldUserLine, visible: can('users:manage') },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/profile', label: 'Profile', icon: RiUser3Line, visible: () => true },
    ],
  },
]

export function visibleSections(authState) {
  return NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => i.visible(authState)) }))
    .filter((s) => s.items.length > 0)
}

export const ROLE_LABELS = {
  user: 'Awaiting access',
  patient: 'Patient',
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  receptionist: 'Receptionist',
  accountant: 'Accountant',
  admin: 'Administrator',
}
