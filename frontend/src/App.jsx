import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'
import { ByRole, RequireAccess, RequireAuth } from './components/RequireAuth'
import { isPatient, isStaff, patientOr, staffCan } from './config/access'
import ScrollToTop from './components/ScrollToTop'
import { LoadingState } from './components/ui/States'

import SignIn from './pages/auth/SignIn'
const SignUp = lazy(() => import('./pages/auth/SignUp'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))

import Home from './pages/public/Home'
const PublicDoctors = lazy(() => import('./pages/public/PublicDoctors'))
const PublicDepartments = lazy(() => import('./pages/public/PublicDepartments'))
const About = lazy(() => import('./pages/public/About'))
const BookingEntry = lazy(() => import('./pages/public/BookingEntry'))

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const BookAppointment = lazy(() => import('./pages/patient/BookAppointment'))
const MyAppointments = lazy(() => import('./pages/patient/MyAppointments'))
const MyRecords = lazy(() => import('./pages/patient/MyRecords'))
const MyPrescriptions = lazy(() => import('./pages/patient/MyPrescriptions'))
const MyBills = lazy(() => import('./pages/patient/MyBills'))

const Appointments = lazy(() => import('./pages/Appointments'))
const Patients = lazy(() => import('./pages/Patients'))
const Doctors = lazy(() => import('./pages/Doctors'))
const Departments = lazy(() => import('./pages/Departments'))
const MedicalRecords = lazy(() => import('./pages/MedicalRecords'))
const Medicines = lazy(() => import('./pages/Medicines'))
const Prescriptions = lazy(() => import('./pages/Prescriptions'))
const PrescriptionItems = lazy(() => import('./pages/PrescriptionItems'))
const Bills = lazy(() => import('./pages/Bills'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/auth/sign-in" element={<SignIn />} />
        <Route path="/auth/sign-up" element={<SignUp />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />

        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/public/doctors" element={<PublicDoctors />} />
          <Route path="/public/departments" element={<PublicDepartments />} />
          <Route path="/about" element={<About />} />
          <Route path="/appointments/book" element={<BookingEntry />} />
          <Route path="/services" element={<Navigate to="/public/departments" replace />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />

            <Route element={<RequireAccess allow={isPatient} />}>
              <Route path="/patient/book-appointment" element={<BookAppointment />} />
            </Route>

            <Route element={<RequireAccess allow={patientOr('appointments:read')} />}>
              <Route path="/appointments" element={<ByRole patient={<MyAppointments />} staff={<Appointments />} />} />
            </Route>
            <Route element={<RequireAccess allow={patientOr('medical_records:read')} />}>
              <Route path="/medical-records" element={<ByRole patient={<MyRecords />} staff={<MedicalRecords />} />} />
            </Route>
            <Route element={<RequireAccess allow={patientOr('prescriptions:read')} />}>
              <Route path="/prescriptions" element={<ByRole patient={<MyPrescriptions />} staff={<Prescriptions />} />} />
            </Route>
            <Route element={<RequireAccess allow={patientOr('bills:read')} />}>
              <Route path="/bills" element={<ByRole patient={<MyBills />} staff={<Bills />} />} />
            </Route>
            <Route element={<RequireAccess allow={patientOr('prescription_items:read')} />}>
              <Route path="/prescription-items" element={
                <ByRole patient={<Navigate to="/prescriptions" replace />} staff={<PrescriptionItems />} />
              } />
            </Route>

            <Route element={<RequireAccess allow={staffCan('patients:read')} />}>
              <Route path="/patients" element={<Patients />} />
            </Route>
            <Route element={<RequireAccess allow={isStaff} />}>
              <Route path="/doctors" element={<Doctors />} />
              <Route path="/departments" element={<Departments />} />
            </Route>
            <Route element={<RequireAccess allow={staffCan('medicines:read')} />}>
              <Route path="/medicines" element={<Medicines />} />
            </Route>
            <Route element={<RequireAccess allow={staffCan('users:manage')} />}>
              <Route path="/admin/users" element={<AdminUsers />} />
            </Route>
            <Route path="/access-denied" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  )
}
