import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import {
  RiCalendarCheckLine, RiUserHeartLine, RiFileList3Line,
  RiMoneyDollarCircleLine, RiUserStarLine, RiBuildingLine,
  RiArrowRightLine, RiHeartPulseLine, RiShieldCheckLine,
  RiStethoscopeLine, RiMedicineBottleLine,
} from 'react-icons/ri'
import { departmentsApi, doctorsApi } from '../../services/api'

const stagger = {
  container: { initial: {}, animate: { transition: { staggerChildren: 0.1 } } },
  item: { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } },
}

const FEATURES = [
  { icon: RiCalendarCheckLine, title: 'Appointment Management', desc: 'Schedule, track, and manage patient appointments across all departments.', color: 'bg-teal-500' },
  { icon: RiUserHeartLine, title: 'Patient Records', desc: 'Maintain complete patient profiles with medical history and contact information.', color: 'bg-blue-500' },
  { icon: RiFileList3Line, title: 'Medical Records', desc: 'Organized diagnosis, symptoms, and treatment notes linked to appointments.', color: 'bg-indigo-500' },
  { icon: RiMoneyDollarCircleLine, title: 'Billing System', desc: 'Track bills, payment statuses, and financial records for all patient visits.', color: 'bg-amber-500' },
  { icon: RiMedicineBottleLine, title: 'Medicine Inventory', desc: 'Manage medicine stock, pricing, and prescriptions across departments.', color: 'bg-green-500' },
  { icon: RiBuildingLine, title: 'Department Administration', desc: 'Organize hospital departments and assign doctors with ease.', color: 'bg-purple-500' },
]

function SectionHeading({ tag, title, subtitle }) {
  return (
    <div className="text-center mb-12">
      {tag && <span className="inline-block px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-100 rounded-full mb-3">{tag}</span>}
      <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-gray-500 mt-3 max-w-xl mx-auto leading-relaxed">{subtitle}</p>}
    </div>
  )
}

function DoctorCard({ doctor, deptMap }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-200">
      <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xl mb-4 mx-auto">
        {doctor.first_name[0]}{doctor.last_name[0]}
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-900">Dr. {doctor.first_name} {doctor.last_name}</p>
        <p className="text-sm text-teal-600 mt-0.5">{doctor.specialization}</p>
        <span className="inline-block mt-2 px-2.5 py-0.5 text-xs bg-navy-50 text-navy-700 border border-navy-100 rounded-full">
          {deptMap[doctor.department_id] ?? 'General'}
        </span>
      </div>
    </div>
  )
}

function DeptCard({ dept }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
        <RiBuildingLine size={18} />
      </div>
      <div>
        <p className="font-semibold text-gray-800">{dept.department_name}</p>
        {dept.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{dept.description}</p>}
      </div>
    </div>
  )
}

export default function Home() {
  const [doctors, setDoctors] = useState([])
  const [depts, setDepts] = useState([])
  const [apiAvailable, setApiAvailable] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [drs, ds] = await Promise.all([
          doctorsApi.list({ limit: 6 }),
          departmentsApi.list({ limit: 8 }),
        ])
        setDoctors(drs); setDepts(ds)
      } catch {
        setApiAvailable(false)
      }
    }
    load()
  }, [])

  const deptMap = Object.fromEntries(depts.map((d) => [d.department_id, d.department_name]))

  return (
    <div>
      {/* Hero */}
      <section className="pt-28 pb-20 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white overflow-hidden relative">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' stroke=\'white\' stroke-width=\'0.5\'%3E%3Cpath d=\'M0 0h40v40H0z\'/%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-500/20 border border-teal-500/30 rounded-full text-teal-300 text-xs font-medium mb-6">
                <RiHeartPulseLine size={13} />
                Hospital Management System
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Better Care,<br />
                <span className="text-teal-400">Closer to You</span>
              </h1>
              <p className="mt-5 text-lg text-navy-200 leading-relaxed max-w-lg">
                MediTrack organizes hospital appointments, patient records, prescriptions, and billing in one connected system — built to demonstrate real-world healthcare database design.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/appointments/book"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold transition-colors shadow-lg shadow-teal-900/30"
                >
                  <RiCalendarCheckLine size={17} />
                  Book an Appointment
                </Link>
                <Link
                  to="/services"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 text-white font-medium transition-colors"
                >
                  Explore Our Services
                  <RiArrowRightLine size={16} />
                </Link>
              </div>
            </motion.div>

            {/* Visual card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="hidden lg:flex justify-center"
            >
              <div className="relative">
                <div className="w-80 h-80 rounded-3xl bg-gradient-to-br from-teal-500/30 to-navy-700/30 border border-white/10 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-2xl bg-teal-500/30 border border-teal-400/30 flex items-center justify-center mx-auto">
                      <RiStethoscopeLine size={36} className="text-teal-300" />
                    </div>
                    <p className="text-teal-200 font-semibold text-lg">Organized Healthcare</p>
                    <p className="text-navy-300 text-sm px-6">9 interconnected database entities powering complete hospital administration</p>
                  </div>
                </div>
                {/* Floating stats */}
                <div className="absolute -top-4 -right-4 bg-white rounded-xl px-3 py-2 shadow-xl">
                  <p className="text-xs text-gray-500">Entities</p>
                  <p className="text-2xl font-bold text-navy-900">9</p>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-teal-500 rounded-xl px-3 py-2 shadow-xl">
                  <p className="text-xs text-teal-100">Full CRUD</p>
                  <p className="text-sm font-bold text-white">All Tables</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Database Tables', value: '9' },
              { label: 'API Endpoints', value: '45+' },
              { label: 'Relationships', value: 'FK-linked' },
              { label: 'Operations', value: 'Full CRUD' },
            ].map((s) => (
              <div key={s.label} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-navy-300 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hospital highlights */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            tag="System Features"
            title="Complete Hospital Administration"
            subtitle="MediTrack covers every aspect of day-to-day hospital operations with clean, organized data management."
          />
          <motion.div
            variants={stagger.container}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={stagger.item}
                className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-11 h-11 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon size={20} className="text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Departments from API */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            tag="Departments"
            title="Hospital Departments"
            subtitle={apiAvailable ? 'Department data loaded from the MediTrack database.' : 'Backend unavailable — showing illustrative content.'}
          />
          {!apiAvailable && (
            <div className="mb-8 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-center">
              Backend server not running. Start the FastAPI server to see live department data.
            </div>
          )}
          {depts.length === 0 && apiAvailable ? (
            <div className="text-center py-12 text-gray-400">
              <RiBuildingLine size={32} className="mx-auto mb-2" />
              <p>No departments found. Add departments via the Staff Dashboard.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(depts.length > 0 ? depts : [
                { department_id: 1, department_name: 'Cardiology', description: 'Heart and vascular care' },
                { department_id: 2, department_name: 'Neurology', description: 'Brain and nervous system' },
                { department_id: 3, department_name: 'Orthopedics', description: 'Bone and joint care' },
                { department_id: 4, department_name: 'Pediatrics', description: 'Children\'s health services' },
              ]).map((dept) => (
                <DeptCard key={dept.department_id} dept={dept} />
              ))}
            </div>
          )}
          <div className="text-center mt-8">
            <Link to="/public/departments"
              className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium text-sm">
              View all departments <RiArrowRightLine size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Doctors from API */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            tag="Our Team"
            title="Meet Our Doctors"
            subtitle={doctors.length > 0 ? 'Doctor information from the MediTrack database.' : apiAvailable ? 'Add doctors via the Staff Dashboard to see them here.' : 'Backend unavailable — start FastAPI to see live data.'}
          />
          {doctors.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <RiUserStarLine size={32} className="mx-auto mb-2" />
              <p className="text-sm">{apiAvailable ? 'No doctors yet. Add doctors from the Staff Dashboard.' : 'Backend not running.'}</p>
              <Link to="/dashboard" className="mt-3 inline-flex items-center gap-1.5 text-sm text-teal-600 hover:underline">
                Go to Staff Dashboard <RiArrowRightLine size={13} />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {doctors.map((doc) => (
                  <DoctorCard key={doc.doctor_id} doctor={doc} deptMap={deptMap} />
                ))}
              </div>
              <div className="text-center mt-8">
                <Link to="/public/doctors"
                  className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium text-sm">
                  View all doctors <RiArrowRightLine size={15} />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Book appointment CTA */}
      <section className="py-20 bg-navy-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/30 mb-6">
              <RiCalendarCheckLine size={28} className="text-teal-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Schedule an Appointment?</h2>
            <p className="text-navy-200 text-lg max-w-xl mx-auto mb-8">
              Use the appointment booking form to schedule a visit. Patient and doctor information are loaded directly from the database.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/appointments/book"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-semibold transition-colors shadow-lg"
              >
                <RiCalendarCheckLine size={18} />
                Book an Appointment
              </Link>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/20 hover:bg-white/10 text-white font-medium transition-colors"
              >
                Staff Dashboard
                <RiArrowRightLine size={16} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About section */}
      <section className="py-20 bg-white" id="about">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-3 py-1 text-xs font-semibold text-navy-700 bg-navy-100 rounded-full mb-4">About MediTrack</span>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">A Hospital System Built on Real Data</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                MediTrack is a hospital appointment and patient record management system designed as a university DBMS semester project. It demonstrates the design and implementation of a relational database with 9 interconnected tables, REST API endpoints, and a full-stack web interface.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                The system covers the complete patient journey: from registration and appointment scheduling through medical records, prescriptions, medicine management, and billing — all enforced by proper foreign-key relationships and database constraints.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  [RiShieldCheckLine, 'PostgreSQL database with FK constraints'],
                  [RiStethoscopeLine, 'FastAPI REST backend with Pydantic validation'],
                  [RiFileList3Line, 'Full CRUD for all 9 entities'],
                  [RiHeartPulseLine, 'React + Tailwind frontend'],
                ].map(([Icon, text]) => (
                  <div key={text} className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <Icon size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative w-72 h-72 rounded-3xl overflow-hidden bg-gradient-to-br from-navy-100 to-teal-100 flex items-center justify-center">
                <RiHeartPulseLine size={80} className="text-navy-300" />
                <div className="absolute bottom-6 left-6 right-6 bg-white rounded-xl p-4 shadow-lg">
                  <p className="text-xs text-gray-500 mb-1">Tech Stack</p>
                  <p className="font-semibold text-gray-900 text-sm">FastAPI · React · PostgreSQL</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tailwind CSS · SQLAlchemy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
