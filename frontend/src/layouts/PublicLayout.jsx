import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { RiCloseLine, RiMenuLine } from 'react-icons/ri'
import { useAuth } from '../context/useAuth'
import Brand from '../components/Brand'
import Button from '../components/ui/Button'
import AccountMenu from '../components/AccountMenu'

const LINKS = [
  { to: '/public/departments', label: 'Departments' },
  { to: '/public/doctors', label: 'Doctors' },
  { to: '/#how-it-works', label: 'How booking works' },
  { to: '/about', label: 'About' },
]

function PublicNav() {
  const { status } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { setOpen(false) }, [location.pathname, location.hash])
  const signedIn = status === 'ready' || status === 'error'

  const linkCls = ({ isActive }) =>
    `text-[13.5px] transition-colors ${isActive ? 'text-ink-900 font-medium' : 'text-ink-600 hover:text-ink-900'}`

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Brand />
        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (l.to.includes('#')
            ? <Link key={l.to} to={l.to} className={linkCls({ isActive: false })}>{l.label}</Link>
            : <NavLink key={l.to} to={l.to} className={linkCls} end>{l.label}</NavLink>))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {status === 'loading' ? null : signedIn ? (
            <>
              <Button size="sm" variant="secondary" to="/dashboard">Open MediTrack</Button>
              <Button size="sm" to="/appointments/book">Book appointment</Button>
              <AccountMenu />
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" to="/auth/sign-in">Sign in</Button>
              <Button size="sm" variant="secondary" to="/auth/sign-up">Create account</Button>
              <Button size="sm" to="/appointments/book">Book appointment</Button>
            </>
          )}
        </div>
        <span className="ml-auto lg:hidden"><Button size="sm" to="/appointments/book">Book</Button></span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'} className="-mr-1.5 rounded-md p-1.5 text-ink-700 hover:bg-ink-100 lg:hidden">
          {open ? <RiCloseLine aria-hidden size={21} /> : <RiMenuLine aria-hidden size={21} />}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="border-t border-ink-100 bg-paper px-4 pb-4 pt-2 lg:hidden">
          <nav aria-label="Primary" className="flex flex-col">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="border-b border-ink-100 py-3 text-sm text-ink-800">{l.label}</Link>
            ))}
          </nav>
          <Button className="mt-4 w-full" size="lg" to="/appointments/book">Book an appointment</Button>
          <div className="mt-2 flex gap-2">
            {signedIn ? (
              <Button className="flex-1" variant="secondary" to="/dashboard">Open MediTrack</Button>
            ) : (
              <>
                <Button className="flex-1" variant="secondary" to="/auth/sign-in">Sign in</Button>
                <Button className="flex-1" variant="secondary" to="/auth/sign-up">Create account</Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function PublicFooter() {
  return (
    <footer className="border-t border-ink-100 bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Brand />
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            Hospital appointment and patient record management, built as a university database systems project.
            It is not a real clinic and must not be used for medical care or emergencies.
          </p>
        </div>
        <div>
          <p className="eyebrow">Explore</p>
          <ul className="mt-3 space-y-2 text-sm">
            {LINKS.map((l) => <li key={l.to}><Link to={l.to} className="text-ink-700 hover:text-ink-900">{l.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Account</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/appointments/book" className="text-ink-700 hover:text-ink-900">Book an appointment</Link></li>
            <li><Link to="/auth/sign-in" className="text-ink-700 hover:text-ink-900">Sign in</Link></li>
            <li><Link to="/auth/sign-up" className="text-ink-700 hover:text-ink-900">Create account</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-500 sm:px-6">MediTrack · academic project</p>
      </div>
    </footer>
  )
}

export default function PublicLayout() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-float">
        Skip to content
      </a>
      <PublicNav />
      <main id="main" className="flex-1"><Outlet /></main>
      <PublicFooter />
    </div>
  )
}
