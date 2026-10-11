import { Link } from 'react-router'
import { RiHeartPulseLine } from 'react-icons/ri'

export default function PublicFooter() {
  return (
    <footer className="bg-navy-950 text-navy-200 py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
                <RiHeartPulseLine size={17} className="text-white" />
              </div>
              <span className="font-bold text-white text-lg">MediTrack</span>
            </div>
            <p className="text-sm text-navy-300 leading-relaxed">
              A hospital appointment and patient record management system. Built as a university DBMS project.
            </p>
            <p className="mt-3 text-xs text-navy-400 italic">
              This is a student demo project, not a real healthcare service.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Navigation</h4>
            <ul className="space-y-2 text-sm">
              {[['/', 'Home'], ['/services', 'Services'], ['/public/doctors', 'Doctors'], ['/public/departments', 'Departments'], ['/about', 'About']].map(([to, label]) => (
                <li key={to}><Link to={to} className="text-navy-300 hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Staff portal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Staff Portal</h4>
            <ul className="space-y-2 text-sm">
              {[['/dashboard', 'Dashboard'], ['/patients', 'Patients'], ['/appointments', 'Appointments'], ['/bills', 'Billing'], ['/medicines', 'Medicines']].map(([to, label]) => (
                <li key={to}><Link to={to} className="text-navy-300 hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact placeholder */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-navy-300">
              <li className="italic text-navy-400">Address: [placeholder]</li>
              <li className="italic text-navy-400">Phone: [placeholder]</li>
              <li className="italic text-navy-400">Email: [placeholder]</li>
            </ul>
            <p className="mt-3 text-xs text-navy-500">Contact details are placeholders for the demo.</p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-navy-500">© {new Date().getFullYear()} MediTrack. University DBMS Project.</p>
          <p className="text-xs text-navy-500">Built with FastAPI, React, Tailwind CSS, and PostgreSQL.</p>
        </div>
      </div>
    </footer>
  )
}
