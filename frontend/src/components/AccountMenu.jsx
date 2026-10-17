import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { RiArrowDownSLine, RiLogoutBoxRLine, RiUser3Line } from 'react-icons/ri'
import { useAuth } from '../context/useAuth'
import { ROLE_LABELS } from '../config/navigation'
import { initials } from '../utils/format'

export default function AccountMenu() {
  const { user, profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const name = profile?.display_name || user?.displayName || user?.email?.split('@')[0] || 'Account'

  async function handleSignOut() {
    setOpen(false)
    // Leave the protected area first; otherwise the route guard reacts to the
    // signed-out state and sends the user to the sign-in page instead of home.
    navigate('/', { replace: true })
    await signOut()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 hover:bg-ink-100"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-[11px] font-semibold text-white">
          {initials(name)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-[13px] font-medium text-ink-800 sm:block">{name}</span>
        <RiArrowDownSLine aria-hidden size={16} className="text-ink-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-lg border border-ink-100 bg-surface py-1.5 shadow-float">
          <div className="border-b border-ink-100 px-3.5 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-medium text-ink-900">{name}</p>
            <p className="truncate text-xs text-ink-500">{user?.email}</p>
            {profile?.role && <p className="mt-1.5 text-xs text-ink-600">{ROLE_LABELS[profile.role] ?? profile.role}</p>}
          </div>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-50">
            <RiUser3Line aria-hidden size={16} /> Profile
          </Link>
          <button role="menuitem" type="button" onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-50">
            <RiLogoutBoxRLine aria-hidden size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
