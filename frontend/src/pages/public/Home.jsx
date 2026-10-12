/**
 * MediTrack Public Homepage
 *
 * All doctor and department data comes from the live database.
 * No invented statistics, testimonials, or fake information.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  RiCalendarCheckLine, RiUserHeartLine, RiFileList3Line,
  RiMoneyDollarCircleLine, RiUserStarLine, RiBuildingLine,
  RiArrowRightLine, RiHeartPulseLine,
  RiStethoscopeLine, RiMedicineBottleLine, RiSearchLine,
  RiCheckLine, RiArrowDownLine,
  RiLock2Line,
} from 'react-icons/ri'
import { departmentsApi, doctorsApi } from '../../services/api'

// ── Reusable animation hook ───────────────────────────────────────────────────
function useReveal(delay = 0) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return {
    ref,
    initial: { opacity: 0, y: 28 },
    animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 },
    transition: { duration: 0.5, delay },
  }
}

// ── Step component for "How it works" ────────────────────────────────────────
function Step({ number, title, description, icon: Icon }) {
  const props = useReveal(number * 0.1)
  return (
    <motion.div {...props} className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-teal-500 text-white font-bold text-sm flex items-center justify-center shrink-0">
          {number}
        </div>
        {number < 4 && <div className="w-px flex-1 bg-teal-200 my-2" />}
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={16} className="text-teal-600" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

// ── Department specialty card ─────────────────────────────────────────────────
const DEPT_ACCENT = [
  'border-l-teal-400 bg-teal-50',
  'border-l-blue-400 bg-blue-50',
  'border-l-purple-400 bg-purple-50',
  'border-l-amber-400 bg-amber-50',
  'border-l-rose-400 bg-rose-50',
  'border-l-green-400 bg-green-50',
  'border-l-indigo-400 bg-indigo-50',
  'border-l-orange-400 bg-orange-50',
]

function SpecialtyCard({ dept, index }) {
  const props = useReveal(index * 0.05)
  return (
    <motion.div {...props}>
      <Link
        to="/public/departments"
        className={`block border-l-4 ${DEPT_ACCENT[index % DEPT_ACCENT.length]} rounded-r-xl p-4 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
      >
        <div className="flex items-start gap-3">
          <RiBuildingLine size={18} className="text-gray-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-800 text-sm">{dept.department_name}</p>
            {dept.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{dept.description}</p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ── Doctor card ───────────────────────────────────────────────────────────────
function DoctorCard({ doctor, deptName, index }) {
  const props = useReveal(index * 0.07)
  const initials = `${doctor.first_name[0]}${doctor.last_name[0]}`
  const colors = [
    'bg-teal-100 text-teal-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700',
  ]
  const color = colors[doctor.doctor_id % colors.length]

  return (
    <motion.div {...props} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
      <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-xl font-bold mb-4 mx-auto`}>
        {initials}
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-900 text-sm">Dr. {doctor.first_name} {doctor.last_name}</p>
        <p className="text-xs text-teal-600 mt-0.5">{doctor.specialization}</p>
        {deptName && (
          <span className="inline-block mt-2 px-2.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
            {deptName}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Feature item ──────────────────────────────────────────────────────────────
function FeatureItem({ icon: Icon, title, description, color }) {
  return (
    <div className="flex gap-4">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [doctors, setDoctors]       = useState([])
  const [depts, setDepts]           = useState([])
  const [apiAvailable, setApiAvail] = useState(true)
  const [apiLoading, setApiLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [drs, ds] = await Promise.all([
          doctorsApi.list({ limit: 8 }),
          departmentsApi.list({ limit: 8 }),
        ])
        setDoctors(drs); setDepts(ds)
      } catch {
        setApiAvail(false)
      } finally {
        setApiLoading(false)
      }
    }
    load()
  }, [])

  const deptMap = Object.fromEntries(depts.map((d) => [d.department_id, d.department_name]))

  return (
    <div className="bg-white">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center bg-navy-950 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-teal-900/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-600/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/15 border border-teal-500/25 text-teal-300 text-xs font-medium mb-8">
                <RiHeartPulseLine size={12} />
                Hospital Management Platform
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight">
                Your health,<br />
                <span className="text-teal-400">organized.</span>
              </h1>

              <p className="mt-6 text-lg text-navy-300 leading-relaxed max-w-md">
                MediTrack connects patients with doctors, tracks appointments,
                manages prescriptions, and keeps medical records in one
                secure, organized place.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  to="/auth/sign-up"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold transition-all duration-200 shadow-lg shadow-teal-900/40 hover:shadow-teal-900/60 hover:-translate-y-0.5"
                >
                  <RiUserHeartLine size={16} />
                  Create Patient Account
                </Link>
                <Link
                  to="/public/doctors"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 text-white font-medium transition-all duration-200"
                >
                  <RiSearchLine size={16} />
                  Find a Doctor
                </Link>
              </div>

              <div className="mt-10 flex items-center gap-6">
                <div className="flex -space-x-2">
                  {['T', 'A', 'R', 'Z'].map((l, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-teal-500/30 border-2 border-navy-950 flex items-center justify-center text-teal-300 text-xs font-bold">
                      {l}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-navy-400">
                  Trusted by patients and healthcare staff
                </p>
              </div>
            </motion.div>

            {/* Right: info cards */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:grid grid-cols-2 gap-4"
            >
              {[
                { icon: RiCalendarCheckLine, label: 'Appointments', sublabel: 'Book and manage visits', color: 'bg-teal-500' },
                { icon: RiFileList3Line, label: 'Medical Records', sublabel: 'Diagnosis & treatment notes', color: 'bg-blue-500' },
                { icon: RiMedicineBottleLine, label: 'Prescriptions', sublabel: 'Medicines & dosage tracking', color: 'bg-purple-500' },
                { icon: RiMoneyDollarCircleLine, label: 'Billing', sublabel: 'Payment status & history', color: 'bg-amber-500' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-3`}>
                    <item.icon size={18} className="text-white" />
                  </div>
                  <p className="text-white font-semibold text-sm">{item.label}</p>
                  <p className="text-navy-400 text-xs mt-0.5">{item.sublabel}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-navy-500"
          >
            <p className="text-xs uppercase tracking-widest">Scroll</p>
            <RiArrowDownLine size={16} className="animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      <section className="bg-navy-900 border-y border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { value: '9', label: 'Database Tables' },
              { value: '45+', label: 'API Endpoints' },
              { value: 'FK-linked', label: 'Relationships' },
              { value: 'Full CRUD', label: 'All Resources' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-black text-teal-400">{s.value}</p>
                <p className="text-xs text-navy-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Browse by Department ─────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">Browse Care</span>
              <h2 className="text-3xl font-black text-gray-900 mt-1">Our Departments</h2>
              <p className="text-gray-500 mt-2 max-w-md text-sm leading-relaxed">
                {depts.length > 0
                  ? 'Department data from the MediTrack database.'
                  : apiAvailable ? 'Add departments via the Staff Dashboard.' : 'Backend unavailable.'}
              </p>
            </div>
            <Link to="/public/departments" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 shrink-0">
              All departments <RiArrowRightLine size={15} />
            </Link>
          </div>

          {!apiAvailable && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
              Backend is not running. Start the FastAPI server to see live data.
            </div>
          )}

          {depts.length === 0 && !apiLoading ? (
            <div className="text-center py-16 text-gray-400">
              <RiBuildingLine size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">No departments yet</p>
              <Link to="/dashboard" className="mt-2 inline-flex items-center gap-1 text-sm text-teal-600 hover:underline">
                Add via Staff Dashboard <RiArrowRightLine size={12} />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(depts.length > 0 ? depts : Array.from({ length: 4 }, (_, i) => ({
                department_id: i + 1, department_name: '—', description: null
              }))).map((dept, i) => (
                <SpecialtyCard key={dept.department_id} dept={dept} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Find a Doctor ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">Our Team</span>
              <h2 className="text-3xl font-black text-gray-900 mt-1">Meet Our Doctors</h2>
              <p className="text-gray-500 mt-2 text-sm">
                {doctors.length > 0 ? 'Live data from the MediTrack database.' : apiAvailable ? 'No doctors added yet.' : 'Backend unavailable.'}
              </p>
            </div>
            <Link to="/public/doctors" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 shrink-0">
              All doctors <RiArrowRightLine size={15} />
            </Link>
          </div>

          {doctors.length === 0 && !apiLoading ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
              <RiUserStarLine size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No doctors in the database yet</p>
              <Link to="/dashboard" className="mt-2 inline-flex items-center gap-1 text-sm text-teal-600 hover:underline">
                Add doctors via Staff Dashboard <RiArrowRightLine size={12} />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {doctors.map((doc, i) => (
                <DoctorCard key={doc.doctor_id} doctor={doc} deptName={deptMap[doc.department_id]} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">Patient Journey</span>
              <h2 className="text-3xl font-black text-gray-900 mt-1 mb-8">How appointment booking works</h2>
              <div>
                <Step number={1} icon={RiUserHeartLine} title="Create your account"
                  description="Sign up with your email. Your account is secured with Firebase Authentication. A staff member will verify and link your patient record." />
                <Step number={2} icon={RiSearchLine} title="Find the right doctor"
                  description="Browse by department or search for a specialist. Doctor information is pulled directly from our database." />
                <Step number={3} icon={RiCalendarCheckLine} title="Book your appointment"
                  description="Select a date and time, provide a brief reason for your visit, and confirm. The system validates availability in real time." />
                <Step number={4} icon={RiFileList3Line} title="Access your health information"
                  description="After verification, view your appointments, medical records, prescriptions, and bills from your patient dashboard." />
              </div>
            </div>

            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="bg-navy-900 text-white rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
                    <RiLock2Line size={15} className="text-white" />
                  </div>
                  <h3 className="font-semibold">Secure by design</h3>
                </div>
                <div className="space-y-3">
                  {[
                    'Firebase Authentication — no passwords stored in our database',
                    'Role-based access — patients only see their own records',
                    'Server-side authorization on every API request',
                    'Patient identity verified by staff before record access',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-sm text-navy-300">
                      <RiCheckLine size={14} className="text-teal-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <RiCalendarCheckLine size={18} className="text-teal-600" />
                  <h3 className="font-semibold text-gray-900">Ready to get started?</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Create a patient account and book your first appointment.
                </p>
                <Link
                  to="/auth/sign-up"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
                >
                  Create Account <RiArrowRightLine size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Patient portal features ───────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">Patient Portal</span>
              <h2 className="text-3xl font-black text-gray-900 mt-1 mb-6">Your complete health picture</h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Once your patient record is verified and linked, your personal dashboard gives you
                secure access to your health information without needing to call the hospital.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <FeatureItem icon={RiCalendarCheckLine} color="bg-teal-500" title="Appointment history" description="See all upcoming and past appointments in one place." />
                <FeatureItem icon={RiFileList3Line} color="bg-blue-500" title="Medical records" description="Diagnosis notes and treatment plans from your visits." />
                <FeatureItem icon={RiMedicineBottleLine} color="bg-purple-500" title="Prescriptions" description="Current and past prescriptions with dosage details." />
                <FeatureItem icon={RiMoneyDollarCircleLine} color="bg-amber-500" title="Billing history" description="Track payment status and outstanding balances." />
              </div>
              <div className="mt-8">
                <Link
                  to="/auth/sign-in"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-navy-900 text-navy-900 font-semibold hover:bg-navy-900 hover:text-white transition-all duration-200"
                >
                  Sign in to Patient Portal <RiArrowRightLine size={15} />
                </Link>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="bg-gray-50 rounded-3xl p-6 border border-gray-200 shadow-sm">
                {/* Mock dashboard preview */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">P</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Patient Dashboard</p>
                    <p className="text-xs text-gray-400">Your personal health portal</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Appointments', n: '—', color: 'bg-indigo-100 text-indigo-700' },
                    { label: 'Bills', n: '—', color: 'bg-amber-100 text-amber-700' },
                    { label: 'Records', n: '—', color: 'bg-teal-100 text-teal-700' },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                      <p className="text-xl font-bold">{s.n}</p>
                      <p className="text-xs mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {['Book Appointment', 'My Prescriptions', 'My Bills'].map((item) => (
                    <div key={item} className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 font-medium">
                      <RiArrowRightLine size={13} className="text-gray-400" />
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center mt-4">Actual data shown after account verification</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── About MediTrack ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-navy-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">About the Platform</span>
              <h2 className="text-3xl font-black text-white mt-1 mb-4">What is MediTrack?</h2>
              <p className="text-navy-300 leading-relaxed mb-4">
                MediTrack is a hospital appointment and patient record management system built as a
                university DBMS semester project. It is designed to demonstrate a complete relational
                database implementation with 9 interconnected tables, proper foreign-key constraints,
                and a full-stack web interface.
              </p>
              <p className="text-navy-400 text-sm leading-relaxed mb-6">
                This platform is an academic demonstration project, not a licensed healthcare service.
                Patient data used during development is fictional. The system is intended to show how
                a hospital information system can be structured, secured, and operated.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['FastAPI + Python', 'REST API backend'],
                  ['PostgreSQL', 'Relational database'],
                  ['Firebase Auth', 'Secure authentication'],
                  ['React + Tailwind', 'Modern frontend'],
                ].map(([name, desc]) => (
                  <div key={name} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-sm font-semibold text-white">{name}</p>
                    <p className="text-xs text-navy-400 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">FAQ</span>
              <h2 className="text-3xl font-black text-white mt-1 mb-6">Common questions</h2>
              <div className="space-y-4">
                {[
                  {
                    q: 'Is this a real hospital?',
                    a: 'No. MediTrack is an academic DBMS project demonstrating hospital management system design. It is not affiliated with any real medical institution.',
                  },
                  {
                    q: 'Can I book a real appointment?',
                    a: 'The booking functionality demonstrates the system design. Appointments created here are stored in our demo database and are not real medical consultations.',
                  },
                  {
                    q: 'How is my data protected?',
                    a: 'Accounts are secured with Firebase Authentication. Patient records are scoped per user and enforced server-side. No clinical data is shared across accounts.',
                  },
                  {
                    q: 'Why do I need staff verification?',
                    a: 'Staff must verify your identity and link your patient record before granting access to health data. This prevents unauthorized access to medical information.',
                  },
                ].map(({ q, a }) => (
                  <div key={q} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                    <p className="font-semibold text-white text-sm mb-1.5">{q}</p>
                    <p className="text-navy-400 text-sm leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...useReveal()}>
            <h2 className="text-3xl font-black text-white mb-3">Start using MediTrack today</h2>
            <p className="text-teal-100 mb-8 text-lg">Create a patient account or explore the staff dashboard.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/auth/sign-up"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-white text-teal-700 font-bold hover:bg-teal-50 transition-colors shadow-lg">
                <RiUserHeartLine size={17} /> Create Account
              </Link>
              <Link to="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border-2 border-white/30 hover:border-white/60 text-white font-semibold transition-colors">
                <RiStethoscopeLine size={17} /> Staff Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  )
}
