import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import {
  RiUserHeartLine,
  RiUserStarLine,
  RiCalendarCheckLine,
  RiMoneyDollarCircleLine,
  RiAddCircleLine,
  RiArrowRightLine,
  RiBuildingLine,
  RiMedicineBottleLine,
  RiFileList3Line,
  RiCapsuleLine,
} from 'react-icons/ri'
import { patientsApi, doctorsApi, appointmentsApi, billsApi, medicalRecordsApi } from '../services/api'
import { useAuth } from '../context/useAuth'
import StatusBadge from '../components/ui/StatusBadge'
import { PageLoader } from '../components/ui/Spinner'
import { ConnectionError } from '../components/ui/ErrorAlert'
import { formatDate, formatTime } from '../utils/format'

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
          {loading ? (
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">{label}</p>
        </div>
      </div>
    </Link>
  )
}

function QuickAction({ icon: Icon, label, to, color }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
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
  item: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  },
}

export default function Dashboard() {
  const { profile } = useAuth()
  const isPatient = profile?.role === 'patient'

  // Patient-role: show their own health summary
  if (isPatient) return <PatientDashboard profile={profile} />
  // Staff roles: show hospital overview
  return <StaffDashboard />
}

function PatientDashboard({ profile }) {
  const [appts, setAppts]       = useState([])
  const [bills, setBills]       = useState([])
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        // All three calls are scoped to the patient's own data server-side
        const [a, b, r] = await Promise.all([
          appointmentsApi.list({ limit: 5 }),
          billsApi.list({ limit: 5 }),
          medicalRecordsApi.list({ limit: 5 }),
        ])
        setAppts(a); setBills(b); setRecords(r)
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <PageLoader />
  if (error?.includes('fetch')) return <ConnectionError />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome, {profile?.display_name ?? 'Patient'}
        </h2>
        <p className="text-gray-500 mt-1 text-sm">Your personal health overview.</p>
      </div>

      {/* Patient stat cards */}
      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {[
          { icon: RiCalendarCheckLine, label: 'My Appointments', value: appts.length, color: 'bg-indigo-500', to: '/appointments' },
          { icon: RiMoneyDollarCircleLine, label: 'My Bills', value: bills.length, color: 'bg-amber-500', to: '/bills' },
          { icon: RiFileList3Line, label: 'My Records', value: records.length, color: 'bg-teal-500', to: '/medical-records' },
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
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <RiCalendarCheckLine size={28} className="mb-2" />
            <p className="text-sm">No appointments yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appts.map((a) => (
                  <tr key={a.appointment_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-700">{formatDate(a.appointment_date)}</td>
                    <td className="px-5 py-3"><StatusBadge value={a.status} /></td>
                    <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{a.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links for patient */}
      <div className="grid sm:grid-cols-3 gap-3">
        <QuickAction icon={RiCalendarCheckLine} label="My Appointments" to="/appointments" color="bg-indigo-500" />
        <QuickAction icon={RiCapsuleLine} label="My Prescriptions" to="/prescriptions" color="bg-purple-500" />
        <QuickAction icon={RiMoneyDollarCircleLine} label="My Bills" to="/bills" color="bg-amber-500" />
      </div>
    </div>
  )
}

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
  if (error?.includes('fetch')) return <ConnectionError />

  return (
    <div className="space-y-6">
      {/* Welcome heading */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
        <p className="text-gray-500 mt-1 text-sm">Here's an overview of MediTrack hospital operations.</p>
      </div>

      {/* Stat cards */}
      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
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
        {/* Recent appointments table */}
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
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
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

        {/* Quick actions */}
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
