import { Routes, Route } from 'react-router'

// Layouts
import PublicLayout    from './layouts/PublicLayout'
import DashboardLayout from './layouts/DashboardLayout'

// Auth
import ProtectedRoute from './components/ProtectedRoute'
import SignIn         from './pages/auth/SignIn'
import SignUp         from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import AccessDenied   from './pages/auth/AccessDenied'

// Public pages
import Home               from './pages/public/Home'
import Services           from './pages/public/Services'
import PublicDoctors      from './pages/public/PublicDoctors'
import PublicDepartments  from './pages/public/PublicDepartments'
import About              from './pages/public/About'
import BookAppointment    from './pages/public/BookAppointment'

// Staff / management pages
import Dashboard          from './pages/Dashboard'
import Patients           from './pages/Patients'
import Doctors            from './pages/Doctors'
import Departments        from './pages/Departments'
import Appointments       from './pages/Appointments'
import MedicalRecords     from './pages/MedicalRecords'
import Medicines          from './pages/Medicines'
import Prescriptions      from './pages/Prescriptions'
import PrescriptionItems  from './pages/PrescriptionItems'
import Bills              from './pages/Bills'
import AdminUsers         from './pages/AdminUsers'
import PatientBooking     from './pages/PatientBooking'

import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      {/* ── Auth pages (no layout wrapper needed — they have their own full-page design) ── */}
      <Route path="/auth/sign-in"        element={<SignIn />} />
      <Route path="/auth/sign-up"        element={<SignUp />} />
      <Route path="/auth/forgot-password" element={<ForgotPassword />} />
      <Route path="/access-denied"       element={<AccessDenied />} />

      {/* ── Public website ── */}
      <Route element={<PublicLayout />}>
        <Route path="/"                   element={<Home />} />
        <Route path="/services"           element={<Services />} />
        <Route path="/public/doctors"     element={<PublicDoctors />} />
        <Route path="/public/departments" element={<PublicDepartments />} />
        <Route path="/about"              element={<About />} />
        {/* Public appointment booking — open to all; submits through real API */}
        <Route path="/appointments/book"  element={<BookAppointment />} />
      </Route>

      {/* ── Staff dashboard — requires authentication ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {/* Dashboard — visible to all authenticated users; content is role-scoped */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Patient-only pages */}
          <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
            <Route path="/patient/book-appointment" element={<PatientBooking />} />
          </Route>

          {/* Shared: patient + staff can view (server enforces ownership scoping) */}
          <Route
            element={<ProtectedRoute allowedRoles={['admin', 'receptionist', 'doctor', 'pharmacist', 'accountant', 'patient']} />}
          >
            <Route path="/appointments"       element={<Appointments />} />
            <Route path="/medical-records"    element={<MedicalRecords />} />
            <Route path="/prescriptions"      element={<Prescriptions />} />
            <Route path="/prescription-items" element={<PrescriptionItems />} />
            <Route path="/bills"              element={<Bills />} />
          </Route>

          {/* Staff-only pages — patients get AccessDenied if they navigate directly */}
          <Route
            element={<ProtectedRoute allowedRoles={['admin', 'receptionist', 'doctor', 'pharmacist', 'accountant']} />}
          >
            <Route path="/patients"    element={<Patients />} />
            <Route path="/doctors"     element={<Doctors />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/medicines"   element={<Medicines />} />
          </Route>

          {/* Admin-only */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/users" element={<AdminUsers />} />
          </Route>
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
