import { Link } from 'react-router'
import { RiArrowLeftLine, RiHeartPulseLine } from 'react-icons/ri'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-navy-100 flex items-center justify-center mx-auto mb-6">
          <RiHeartPulseLine size={36} className="text-navy-600" />
        </div>
        <h1 className="text-7xl font-black text-navy-900 mb-2">404</h1>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Page Not Found</h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          This page doesn't exist in MediTrack. Head back to the dashboard or the public home page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-navy-800 text-white font-medium hover:bg-navy-900 transition-colors"
          >
            <RiArrowLeftLine size={16} />
            Dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            Home Page
          </Link>
        </div>
      </div>
    </div>
  )
}
