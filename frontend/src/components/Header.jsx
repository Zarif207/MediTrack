import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { RiMenuLine, RiMenu3Line, RiUserLine, RiLogoutBoxLine, RiShieldCheckLine } from 'react-icons/ri'
import { useAuth } from '../context/useAuth'

const ROLE_COLORS = {
  admin:        'bg-red-100 text-red-700',
  receptionist: 'bg-blue-100 text-blue-700',
  doctor:       'bg-teal-100 text-teal-700',
  pharmacist:   'bg-green-100 text-green-700',
  accountant:   'bg-amber-100 text-amber-700',
  patient:      'bg-gray-100 text-gray-600',
}

export default function Header({ title, sidebarCollapsed, onToggleSidebar, onToggleMobile }) {
  const { user, profile, signOut, configured } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const displayName  = profile?.display_name ?? user?.displayName ?? user?.email ?? 'User'
  const initials     = displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  const roleLabel    = profile?.role ?? (configured ? null : 'demo mode')
  const roleColor    = ROLE_COLORS[profile?.role] ?? 'bg-gray-100 text-gray-600'

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 px-4 sm:px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
      {/* Mobile menu toggle */}
      <button className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={onToggleMobile} aria-label="Open navigation">
        <RiMenuLine size={20} />
      </button>

      {/* Desktop sidebar collapse toggle */}
      <button className="hidden lg:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <RiMenu3Line size={20} />
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
      </div>

      {/* Right side — user menu */}
      <div className="flex items-center gap-2 shrink-0" ref={menuRef}>
        {roleLabel && (
          <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleColor}`}>
            <RiShieldCheckLine size={11} />
            {roleLabel}
          </span>
        )}

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-navy-800 flex items-center justify-center hover:bg-navy-700 transition-colors text-white text-xs font-bold"
            aria-label="User menu"
          >
            {user ? initials : <RiUserLine size={14} />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-50">
              {user ? (
                <>
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="font-medium text-gray-900 text-sm truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    {roleLabel && (
                      <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roleColor}`}>
                        {roleLabel}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); signOut() }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <RiLogoutBoxLine size={15} /> Sign out
                  </button>
                </>
              ) : (
                <Link to="/auth/sign-in" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <RiUserLine size={15} /> Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
