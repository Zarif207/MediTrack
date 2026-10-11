import { useState, useEffect } from 'react'
import { departmentsApi, doctorsApi } from '../../services/api'
import { motion } from 'framer-motion'
import { RiBuildingLine, RiUserStarLine } from 'react-icons/ri'

export default function PublicDepartments() {
  const [depts, setDepts] = useState([])
  const [docCounts, setDocCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    Promise.all([departmentsApi.list({ limit: 100 }), doctorsApi.list({ limit: 100 })])
      .then(([ds, drs]) => {
        setDepts(ds)
        const counts = {}
        drs.forEach((d) => { counts[d.department_id] = (counts[d.department_id] ?? 0) + 1 })
        setDocCounts(counts)
      })
      .catch(() => setAvailable(false))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="pt-20 min-h-screen">
      <div className="bg-navy-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-3">Departments</h1>
          <p className="text-navy-200">Department data from the MediTrack database.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {!available && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-center">
            Backend not running.
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-navy-200 border-t-navy-700 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {depts.map((dept, i) => (
              <motion.div key={dept.department_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-4">
                  <RiBuildingLine size={22} className="text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg">{dept.department_name}</h3>
                {dept.description && <p className="text-sm text-gray-500 mt-1">{dept.description}</p>}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                  <RiUserStarLine size={13} />
                  <span>{docCounts[dept.department_id] ?? 0} doctor{docCounts[dept.department_id] !== 1 ? 's' : ''}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
