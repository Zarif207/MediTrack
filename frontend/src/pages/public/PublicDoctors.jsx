import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { doctorsApi, departmentsApi } from '../../services/api'
import { RiUserStarLine, RiSearchLine } from 'react-icons/ri'

export default function PublicDoctors() {
  const [doctors, setDoctors] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([doctorsApi.list({ limit: 100 }), departmentsApi.list({ limit: 100 })])
      .then(([drs, ds]) => { setDoctors(drs); setDepts(ds) })
      .catch(() => setAvailable(false))
      .finally(() => setLoading(false))
  }, [])

  const deptMap = Object.fromEntries(depts.map((d) => [d.department_id, d.department_name]))

  const filtered = doctors.filter((d) => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${d.first_name} ${d.last_name}`.toLowerCase().includes(q)
      || d.specialization.toLowerCase().includes(q)
      || (deptMap[d.department_id] ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="pt-20 min-h-screen">
      <div className="bg-navy-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-3">Our Doctors</h1>
          <p className="text-navy-200">Doctor information from the MediTrack database.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!available && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-center">
            Backend not running. Start the FastAPI server to see live data.
          </div>
        )}
        <div className="relative max-w-md mx-auto mb-10">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white shadow-sm"
            placeholder="Search by name, specialization, or department…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-navy-200 border-t-navy-700 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <RiUserStarLine size={40} className="mx-auto mb-3" />
            <p>{search ? 'No matching doctors' : 'No doctors found. Add them via the Staff Dashboard.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((doc, i) => (
              <motion.div
                key={doc.doctor_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xl mx-auto mb-4">
                  {doc.first_name[0]}{doc.last_name[0]}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Dr. {doc.first_name} {doc.last_name}</p>
                  <p className="text-sm text-teal-600 mt-0.5">{doc.specialization}</p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 text-xs bg-navy-50 text-navy-700 border border-navy-100 rounded-full">
                    {deptMap[doc.department_id] ?? 'General'}
                  </span>
                  <p className="text-xs text-gray-400 mt-2">{doc.email}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
