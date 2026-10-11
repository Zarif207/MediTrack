import { Link } from 'react-router'
import {
  RiHeartPulseLine, RiDatabaseLine, RiCodeSSlashLine,
  RiArrowRightLine, RiGitBranchLine,
} from 'react-icons/ri'

const ENTITIES = [
  { name: 'Departments', desc: 'Hospital departments with name and description.' },
  { name: 'Doctors', desc: 'Doctor profiles linked to departments.' },
  { name: 'Patients', desc: 'Patient records with medical and contact information.' },
  { name: 'Appointments', desc: 'Scheduling between patients and doctors.' },
  { name: 'Medical Records', desc: 'Diagnosis, symptoms, and treatment notes per appointment.' },
  { name: 'Prescriptions', desc: 'Prescription headers linked to medical records.' },
  { name: 'Medicines', desc: 'Medicine inventory with stock and pricing.' },
  { name: 'Prescription Items', desc: 'Medicines prescribed per prescription with dosage details.' },
  { name: 'Bills', desc: 'Financial records per appointment with payment tracking.' },
]

export default function About() {
  return (
    <div className="pt-20 min-h-screen">
      <div className="bg-navy-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-3">About MediTrack</h1>
          <p className="text-navy-200 max-w-xl mx-auto">
            A hospital management system built as a university DBMS project, demonstrating real relational database design and full-stack implementation.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Project overview */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <RiHeartPulseLine size={20} className="text-teal-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">What is MediTrack?</h2>
          </div>
          <p className="text-gray-600 leading-relaxed">
            MediTrack is a hospital appointment and patient record management system designed as a university database management systems (DBMS) semester project. The goal is to demonstrate proficiency in relational database design, SQL, backend API development, and full-stack web application building.
          </p>
          <p className="text-gray-600 leading-relaxed mt-4">
            This is an academic demonstration project, not a production healthcare system. All patient data entered is fictional and for demonstration purposes only.
          </p>
        </section>

        {/* Database design */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <RiDatabaseLine size={20} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Database Design — 9 Entities</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {ENTITIES.map((e, i) => (
              <div key={e.name} className="flex gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="w-6 h-6 rounded-full bg-navy-200 text-navy-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{e.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Relationships */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <RiGitBranchLine size={20} className="text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Entity Relationships</h2>
          </div>
          <div className="bg-gray-50 rounded-xl p-5 font-mono text-xs text-gray-600 space-y-1 border border-gray-200">
            <p>Department  ──── <span className="text-navy-600 font-semibold">1:N</span> ──── Doctor</p>
            <p>Patient     ──── <span className="text-navy-600 font-semibold">1:N</span> ──── Appointment</p>
            <p>Doctor      ──── <span className="text-navy-600 font-semibold">1:N</span> ──── Appointment</p>
            <p>Appointment ──── <span className="text-teal-600 font-semibold">1:0..1</span> ── MedicalRecord</p>
            <p>MedicalRecord─── <span className="text-navy-600 font-semibold">1:N</span> ──── Prescription</p>
            <p>Prescription ─── <span className="text-navy-600 font-semibold">1:N</span> ──── PrescriptionItem</p>
            <p>Medicine    ──── <span className="text-navy-600 font-semibold">1:N</span> ──── PrescriptionItem</p>
            <p>Patient     ──── <span className="text-navy-600 font-semibold">1:N</span> ──── Bill</p>
            <p>Appointment ──── <span className="text-teal-600 font-semibold">1:0..1</span> ── Bill</p>
          </div>
        </section>

        {/* Tech stack */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <RiCodeSSlashLine size={20} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Technology Stack</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              ['Backend', 'FastAPI (Python), SQLAlchemy ORM, Pydantic v2, psycopg3'],
              ['Database', 'PostgreSQL with proper constraints, FKs, and check constraints'],
              ['Frontend', 'React 19, Vite 8, Tailwind CSS v4, React Router, Framer Motion'],
              ['API Style', 'REST API with full CRUD — list, detail, create, update (PATCH), delete'],
            ].map(([title, desc]) => (
              <div key={title} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center pt-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-navy-800 text-white font-medium hover:bg-navy-900 transition-colors">
            Open Staff Dashboard <RiArrowRightLine size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
