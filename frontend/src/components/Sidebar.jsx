import { NavLink, Link } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiDashboardLine,
  RiUserHeartLine,
  RiUserStarLine,
  RiBuildingLine,
  RiCalendarCheckLine,
  RiFileList3Line,
  RiCapsuleLine,
  RiMedicineBottleLine,
  RiListCheck3,
  RiMoneyDollarCircleLine,
  RiCloseLine,
  RiHeartPulseLine,
  RiHomeLine,
} from 'react-icons/ri'

const NAV_ITEMS = [
  { to: '/dashboard', icon: RiDashboardLine, label: 'Dashboard' },
  { to: '/patients', icon: RiUserHeartLine, label: 'Patients' },
  { to: '/doctors', icon: RiUserStarLine, label: 'Doctors' },
  { to: '/departments', icon: RiBuildingLine, label: 'Departments' },
  { to: '/appointments', icon: RiCalendarCheckLine, label: 'Appointments' },
  { to: '/medical-records', icon: RiFileList3Line, label: 'Medical Records' },
  { to: '/prescriptions', icon: RiCapsuleLine, label: 'Prescriptions' },
  { to: '/medicines', icon: RiMedicineBottleLine, label: 'Medicines' },
  { to: '/prescription-items', icon: RiListCheck3, label: 'Rx Items' },
  { to: '/bills', icon: RiMoneyDollarCircleLine, label: 'Bills' },
]

function NavItem({ to, icon: Icon, label, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group
         ${isActive
           ? 'bg-white/15 text-white'
           : 'text-navy-200 hover:bg-white/10 hover:text-white'}`
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

export default function Sidebar({ collapsed, mobileOpen, onMobileClose }) {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 flex flex-col
          bg-navy-900 select-none transition-all duration-300
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        aria-label="Sidebar navigation"
      >
        {/* Brand */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
            <RiHeartPulseLine size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-white font-bold text-base leading-none">MediTrack</p>
              <p className="text-navy-300 text-xs mt-0.5">Hospital Management</p>
            </div>
          )}
          {/* Mobile close */}
          <button
            className="ml-auto text-navy-300 hover:text-white lg:hidden"
            onClick={onMobileClose}
            aria-label="Close navigation"
          >
            <RiCloseLine size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              collapsed={collapsed}
              onClick={onMobileClose}
            />
          ))}
        </nav>

        {/* Footer link — back to public home */}
        <div className="px-2 py-3 border-t border-white/10">
          <Link
            to="/"
            onClick={onMobileClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <RiHomeLine size={18} className="shrink-0" />
            {!collapsed && <span>Public Home</span>}
          </Link>
        </div>
      </aside>
    </>
  )
}
