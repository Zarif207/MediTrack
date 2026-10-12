import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import {
  RiUserHeartLine, RiUserStarLine, RiCalendarCheckLine,
  RiMoneyDollarCircleLine, RiAddCircleLine, RiArrowRightLine,
  RiBuildingLine, RiMedicineBottleLine, RiFileList3Line,
  RiCapsuleLine, RiShieldLine, RiCheckLine, RiTimeLine,
  RiRefreshLine, RiStethoscopeLine,
} from 'react-icons/ri'
import { appointmentsApi, patientsApi, doctorsApi, billsApi, medicalRecordsApi } from '../services/api'
import { useAuth } from '../context/useAuth'
import StatusBadge from '../components/ui/StatusBadge'
import { PageLoader } from '../components/ui/Spinner'
import { ConnectionError } from '../components/ui/ErrorAlert'
import { formatDate, formatTime, formatCurrency } from '../utils/format'

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, loading, color, to }) {
  return (
    <Link to={to} className="block group">
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group-hover:-translate-y-0.5">
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={20} className="text-white" />
          </div>
          <RiArrowRightLine size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
        </div>
        <div className="mt-4">
          {loading
            ? <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
            : <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>}
          <p className="text-sm text-gray-500 mt-1">{label}</p>
        </div>
      </div>
    </Link>
  )
}

function QuickAction({ icon: Icon, label, to, color }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={17} className="text-white" />
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <RiArrowRightLine size={14} className="text-gray-300 ml-auto" />
    </Link>
  )
}

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.07 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } } },
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { profile } = useAuth()
  if (profile?.role === 'patient') return <PatientDashboard profile={profile} />
  if (profile?.role === 'user' || !profile?.role) return <UserDashboard profile={profile} />
  return <StaffDashboard />
}

/**
 * Dashboard for accounts with role='user' — no patient or staff permissions yet.
 * Shows onboarding info and available public actions.
 */
function UserDashboard({ profile }) {
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'there'
  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-gray-900">Welcome to MediTrack, {displayName}!</h2>
        <p className="text-gray-500 mt-1 text-sm">Your account has been created successfully.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-blue-50 border border-blue-200 rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <RiTimeLine size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">Account Setup in Progress</h3>
            <p className="text-sm text-blue-800 mt-1 leading-relaxed">
              Your account has been created with the default <strong>user</strong> role.
              An administrator needs to assign you the appropriate role (patient, doctor, etc.)
              before you can access clinical features.
            </p>
            <div className="mt-3 space-y-1.5">
              {[
                { done: true,  text: 'Account registered' },
                { done: true,  text: 'Email verified' },
                { done: false, text: 'Role assigned by administrator' },
                { done: false, text: 'Access to features enabled' },
              ].map(({ done, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm text-blue-700">
                  {done
                    ? <RiCheckLine size={15} className="text-green-500 shrink-0" />
                    : <RiTimeLine size={15} className="text-blue-400 shrink-0" />}
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-semibold text-gray-800 mb-3">While you wait</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link to="/public/doctors" className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all">
            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <RiUserStarLine size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Find a Doctor</p>
              <p className="text-xs text-gray-500 mt-0.5">Browse our specialist doctors</p>
            </div>
          </Link>
          <Link to="/public/departments" className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all">
            <div className="w-9 h-9 rounded-lg bg-purple-500 flex items-center justify-center shrink-0">
              <RiBuildingLine size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Departments</p>
              <p className="text-xs text-gray-500 mt-0.5">Explore medical departments</p>
            </div>
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
      >
        <h3 className="font-semibold text-gray-800 mb-3">Your Account</h3>
        <div className="space-y-2 text-sm">
          {profile?.display_name && (
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-800">{profile.display_name}</span>
            </div>
          )}
          {profile?.email && (
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-800">{profile.email}</span>
            </div>
          )}
          <div className="flex justify-between py-1">
            <span className="text-gray-500">Role</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">User (default)</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Patient dashboard ─────────────────────────────────────────────────────────

function PatientDashboard({ profile }) {
  const isLinked = profile?.patient_id != null

  if (!isLinked) return <UnlinkedPatientDashboard profile={profile} />
  return <LinkedPatientDashboard profile={profile} />
}

/**
 * Onboarding dashboard for patients who have registered but have not yet
 * been linked to a patient record by staff.
 */
function UnlinkedPatientDashboard({ profile }) {
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'there'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="text-2xl font-bold text-gray-900">Welcome to MediTrack, {displayName}!</h2>
        <p className="text-gray-500 mt-1 text-sm">Your patient account has been created successfully.</p>
      </motion.div>

      {/* Account status card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-amber-50 border border-amber-200 rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <RiTimeLine size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">Account Verification Pending</h3>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Your account has been registered and is ready. A staff member will verify your identity
              and link your patient record shortly. Once linked, you will have full access to your
              medical records, prescriptions, and bills.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2.5 text-sm text-amber-700">
                <RiCheckLine size={16} className="text-green-600 shrink-0" />
                <span>Account created and secured with Firebase Authentication</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-amber-700">
                <RiCheckLine size={16} className="text-green-600 shrink-0" />
                <span>Role assigned: Patient</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-amber-700">
                <RiTimeLine size={16} className="text-amber-500 shrink-0" />
                <span>Awaiting staff verification and patient record link</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Available actions while unlinked */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h3 className="font-semibold text-gray-800 mb-3">What you can do now</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            to="/appointments/book"
            className="flex items-start gap-3 p-4 bg-white border border-teal-200 rounded-xl hover:border-teal-400 hover:shadow-md transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-lg bg-teal-500 flex items-center justify-center shrink-0 group-hover:bg-teal-600 transition-colors">
              <RiCalendarCheckLine size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Book an Appointment</p>
              <p className="text-xs text-gray-500 mt-0.5">Schedule a visit with one of our doctors</p>
            </div>
          </Link>

          <Link
            to="/public/doctors"
            className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <RiStethoscopeLine size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Find a Doctor</p>
              <p className="text-xs text-gray-500 mt-0.5">Browse our specialist doctors</p>
            </div>
          </Link>

          <Link
            to="/public/departments"
            className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-500 flex items-center justify-center shrink-0">
              <RiBuildingLine size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Browse Departments</p>
              <p className="text-xs text-gray-500 mt-0.5">Explore our medical departments</p>
            </div>
          </Link>

          <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl opacity-60 cursor-not-allowed">
            <div className="w-9 h-9 rounded-lg bg-gray-300 flex items-center justify-center shrink-0">
              <RiShieldLine size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">My Health Records</p>
              <p className="text-xs text-gray-400 mt-0.5">Available after account verification</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Profile info */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
      >
        <h3 className="font-semibold text-gray-800 mb-3">Your Account</h3>
        <div className="space-y-2 text-sm">
          {profile?.display_name && (
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-800">{profile.display_name}</span>
            </div>
          )}
          {profile?.email && (
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-800">{profile.email}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Role</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium capitalize">{profile?.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Patient Record</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pending verification</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Full health dashboard for patients with a linked patient record.
 */
function LinkedPatientDashboard({ profile }) {
  const [appts, setAppts]     = useState([])
  const [bills, setBills]     = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [a, b, r] = await Promise.all([
        appointmentsApi.list({ limit: 5 }),
        billsApi.list({ limit: 5 }),
        medicalRecordsApi.list({ limit: 5 }),
      ])
      setAppts(a); setBills(b); setRecords(r)
    } catch (e) {
      if (e.message?.includes('fetch') || e.message?.includes('Cannot reach')) {
        setError('connection')
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'Patient'

  if (loading) return <PageLoader />
  if (error === 'connection') return <ConnectionError />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back, {displayName}</h2>
          <p className="text-gray-500 mt-1 text-sm">Here is your personal health overview.</p>
        </div>
        <Link
          to="/appointments/book"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors shadow-sm shrink-0"
        >
          <RiCalendarCheckLine size={15} />
          Book Appointment
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <span>{error}</span>
          <button onClick={load} className="ml-auto flex items-center gap-1 text-xs font-medium hover:underline">
            <RiRefreshLine size={13} /> Retry
          </button>
        </div>
      )}

      {/* Stat cards */}
      <motion.div variants={stagger.container} initial="initial" animate="animate" className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: RiCalendarCheckLine, label: 'My Appointments', value: appts.length, color: 'bg-indigo-500', to: '/appointments' },
          { icon: RiMoneyDollarCircleLine, label: 'My Bills', value: bills.length, color: 'bg-amber-500', to: '/bills' },
          { icon: RiFileList3Line, label: 'Medical Records', value: records.length, color: 'bg-teal-500', to: '/medical-records' },
        ].map((card) => (
          <motion.div key={card.label} variants={stagger.item}>
            <StatCard {...card} loading={loading} />
          </motion.div>
        ))}
      </motion.div>

      {/* Recent appointments */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Recent Appointments</h3>
          <Link to="/appointments" className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
            View all <RiArrowRightLine size={13} />
          </Link>
        </div>
        {appts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <RiCalendarCheckLine size={28} className="mb-2" />
            <p className="text-sm mb-3">No appointments yet</p>
            <Link to="/appointments/book" className="text-xs text-teal-600 hover:underline font-medium">
              Book your first appointment →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appts.map((a) => (
                  <tr key={a.appointment_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-gray-800">{formatDate(a.appointment_date)}</p>
                      <p className="text-xs text-gray-400">{formatTime(a.appointment_time)}</p>
                    </td>
                    <td className="px-5 py-3"><StatusBadge value={a.status} /></td>
                    <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{a.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent bills */}
      {bills.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Recent Bills</h3>
            <Link to="/bills" className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              View all <RiArrowRightLine size={13} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map((b) => (
                  <tr key={b.bill_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">#{b.bill_id}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{formatCurrency(b.amount)}</td>
                    <td className="px-5 py-3"><StatusBadge type="payment" value={b.payment_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-3">
        <QuickAction icon={RiCalendarCheckLine} label="My Appointments" to="/appointments" color="bg-indigo-500" />
        <QuickAction icon={RiCapsuleLine} label="My Prescriptions" to="/prescriptions" color="bg-purple-500" />
        <QuickAction icon={RiMoneyDollarCircleLine} label="My Bills" to="/bills" color="bg-amber-500" />
      </div>
    </div>
  )
}

// ── Staff dashboard ───────────────────────────────────────────────────────────

function StaffDashboard() {
  const [stats, setStats] = useState({ patients: null, doctors: null, appointments: null, pending: null })
  const [recentAppts, setRecentAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [recentApptData, allPts, allDrs, allBills] = await Promise.all([
          appointmentsApi.list({ limit: 8 }),
          patientsApi.list({ limit: 100 }),
          doctorsApi.list({ limit: 100 }),
          billsApi.list({ payment_status: 'pending', limit: 100 }),
        ])
        setStats({
          patients: allPts.length,
          doctors: allDrs.length,
          appointments: recentApptData.length,
          pending: allBills.length,
        })
        setRecentAppts(recentApptData)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <PageLoader />
  if (error?.includes('fetch') || error?.includes('Cannot reach')) return <ConnectionError />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
        <p className="text-gray-500 mt-1 text-sm">Here's an overview of MediTrack hospital operations.</p>
      </div>

      <motion.div variants={stagger.container} initial="initial" animate="animate" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: RiUserHeartLine, label: 'Total Patients', value: stats.patients, color: 'bg-blue-500', to: '/patients' },
          { icon: RiUserStarLine, label: 'Total Doctors', value: stats.doctors, color: 'bg-teal-500', to: '/doctors' },
          { icon: RiCalendarCheckLine, label: 'Recent Appts', value: stats.appointments, color: 'bg-indigo-500', to: '/appointments' },
          { icon: RiMoneyDollarCircleLine, label: 'Pending Bills', value: stats.pending, color: 'bg-amber-500', to: '/bills' },
        ].map((card) => (
          <motion.div key={card.label} variants={stagger.item}>
            <StatCard {...card} loading={loading} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Recent Appointments</h3>
            <Link to="/appointments" className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              View all <RiArrowRightLine size={13} />
            </Link>
          </div>
          {recentAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <RiCalendarCheckLine size={32} className="mb-2" />
              <p className="text-sm">No appointments yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentAppts.map((appt) => (
                    <tr key={appt.appointment_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">#{appt.appointment_id}</td>
                      <td className="px-5 py-3 text-gray-700">{formatDate(appt.appointment_date)}</td>
                      <td className="px-5 py-3 text-gray-600">{formatTime(appt.appointment_time)}</td>
                      <td className="px-5 py-3"><StatusBadge value={appt.status} /></td>
                      <td className="px-5 py-3 text-gray-500 max-w-[160px] truncate">{appt.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800">Quick Actions</h3>
          <div className="space-y-2">
            <QuickAction icon={RiAddCircleLine} label="Add New Patient" to="/patients" color="bg-blue-500" />
            <QuickAction icon={RiUserStarLine} label="Add New Doctor" to="/doctors" color="bg-teal-500" />
            <QuickAction icon={RiCalendarCheckLine} label="Schedule Appointment" to="/appointments" color="bg-indigo-500" />
            <QuickAction icon={RiBuildingLine} label="Manage Departments" to="/departments" color="bg-purple-500" />
            <QuickAction icon={RiMedicineBottleLine} label="Medicine Inventory" to="/medicines" color="bg-green-500" />
            <QuickAction icon={RiMoneyDollarCircleLine} label="Manage Bills" to="/bills" color="bg-amber-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
