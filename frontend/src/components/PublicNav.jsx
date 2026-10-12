import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiHeartPulseLine, RiMenuLine, RiCloseLine,
  RiLogoutBoxLine, RiDashboardLine, RiCalendarCheckLine,
  RiArrowDownSLine,
} from 'react-icons/ri'
import { useAuth } from '../context/useAuth'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/public/doctors', label: 'Doctors' },
  { to: '/public/departments', label: 'Departments' },
  { to: '/about', label: 'About' },
]

/** Map role → dashboard destination */
function dashboardRoute(role) {
  if (!role) return '/dashboard'
  if (role === 'user') return '/dashboard'
  if (role === 'patient') return '/dashboard'
  return '/dashboard'  // all roles use the same layout
}

/** Map role → short display label */
function roleLabel(role) {
  if (!role || role === 'user') return 'Account'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user, profile, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const userMenuRef = useRef(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e) => {
      if (!userMenuRef.current?.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  // Close mobile menu on navigation
  function handleNavClick() {
    setMobileOpen(false)
    setUserMenuOpen(false)
  }

  async function handleSignOut() {
    setUserMenuOpen(false)
    setMobileOpen(false)
    await signOut()
    navigate('/')
  }

  const isLoggedIn = !!user
  const displayName = profile?.display_name || user?.displayName || user?.email?.split('@')[0] || 'Account'
  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/97 backdrop-blur-sm shadow-sm' : 'bg-white border-b border-gray-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0" onClick={handleNavClick}>
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <RiHeartPulseLine size={17} className="text-white" />
            </div>
            <span className="font-bold text-navy-900 text-lg">MediTrack</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'text-teal-600 bg-teal-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop right side — auth-aware */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
            ) : isLoggedIn ? (
              <>
                {/* Book appointment — only for patient role */}
                {profile?.role === 'patient' && (
                  <Link
                    to="/patient/book-appointment"
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <RiCalendarCheckLine size={14} />
                    Book Appointment
                  </Link>
                )}

                {/* User menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    aria-haspopup="true"
                    aria-expanded={userMenuOpen}
                  >
                    <div className="w-6 h-6 rounded-full bg-navy-800 flex items-center justify-center text-white text-xs font-bold">
                      {initials}
                    </div>
                    <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
                      {displayName}
                    </span>
                    <RiArrowDownSLine size={14} className={`text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-11 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-50"
                      >
                        <div className="px-3 py-2 border-b border-gray-100 mb-1">
                          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                          <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            profile?.role === 'admin' ? 'bg-red-100 text-red-700' :
                            profile?.role === 'patient' ? 'bg-teal-100 text-teal-700' :
                            profile?.role === 'doctor' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {roleLabel(profile?.role)}
                          </span>
                        </div>
                        <Link
                          to={dashboardRoute(profile?.role)}
                          onClick={handleNavClick}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <RiDashboardLine size={15} className="text-gray-400" />
                          Dashboard
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <RiLogoutBoxLine size={15} />
                          Sign out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/auth/sign-in"
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/auth/sign-up"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          >
            {mobileOpen ? <RiCloseLine size={22} /> : <RiMenuLine size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 shadow-lg overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {NAV_LINKS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'text-teal-600 bg-teal-50' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}

              <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                {loading ? (
                  <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ) : isLoggedIn ? (
                  <>
                    <div className="px-3 py-2 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-navy-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
                        <p className="text-xs text-gray-400 capitalize">{roleLabel(profile?.role)}</p>
                      </div>
                    </div>
                    <Link
                      to={dashboardRoute(profile?.role)}
                      onClick={handleNavClick}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      <RiDashboardLine size={15} /> Dashboard
                    </Link>
                    {profile?.role === 'patient' && (
                      <Link
                        to="/patient/book-appointment"
                        onClick={handleNavClick}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                      >
                        <RiCalendarCheckLine size={15} /> Book Appointment
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <RiLogoutBoxLine size={15} /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/auth/sign-in"
                      onClick={handleNavClick}
                      className="block text-center px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Log In
                    </Link>
                    <Link
                      to="/auth/sign-up"
                      onClick={handleNavClick}
                      className="block text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
