import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { departmentsApi } from '../../services/api'
import { RiBuildingLine, RiArrowRightLine } from 'react-icons/ri'

const DEPT_ICONS = [
  'bg-red-100 text-red-600',
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
  'bg-amber-100 text-amber-600',
  'bg-teal-100 text-teal-600',
  'bg-indigo-100 text-indigo-600',
  'bg-pink-100 text-pink-600',
]

export default function Services() {
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    departmentsApi.list({ limit: 100 }).then(setDepts).catch(() => setAvailable(false)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="pt-20 min-h-screen">
      {/* Page header */}
      <div className="bg-navy-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-3">Our Services & Departments</h1>
          <p className="text-navy-200 max-w-xl mx-auto">
            MediTrack manages hospital departments and the services they provide. Data is loaded directly from the database.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {!available && (
          <div className="mb-8 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-center">
            Backend not running. Start the FastAPI server to see live department data.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-navy-200 border-t-navy-700 rounded-full animate-spin" />
          </div>
        ) : depts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <RiBuildingLine size={40} className="mx-auto mb-3" />
            <p className="font-medium">No departments found</p>
            <p className="text-sm mt-1">Add departments via the Staff Dashboard to see them here.</p>
            <Link to="/departments" className="mt-4 inline-flex items-center gap-1.5 text-sm text-teal-600 hover:underline">
              Staff Dashboard <RiArrowRightLine size={13} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {depts.map((dept, i) => (
              <motion.div
                key={dept.department_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${DEPT_ICONS[i % DEPT_ICONS.length]}`}>
                  <RiBuildingLine size={22} />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{dept.department_name}</h3>
                {dept.description && <p className="text-sm text-gray-500 leading-relaxed">{dept.description}</p>}
                <p className="mt-3 text-xs text-gray-400 font-mono">Dept ID #{dept.department_id}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
