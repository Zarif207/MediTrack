import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { RiCloseLine, RiMenuLine } from 'react-icons/ri'
import AppSidebar from '../components/AppSidebar'
import AccountMenu from '../components/AccountMenu'
import Brand from '../components/Brand'

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="min-h-screen bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-float">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-ink-100 bg-surface lg:block">
        <AppSidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink-900/30" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-ink-100 bg-surface">
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation"
              className="absolute right-2 top-3 rounded-md p-1.5 text-ink-500 hover:bg-ink-100">
              <RiCloseLine aria-hidden size={20} />
            </button>
            <AppSidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-100 bg-paper/90 px-4 backdrop-blur-sm sm:px-6">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"
            className="-ml-1.5 rounded-md p-1.5 text-ink-600 hover:bg-ink-100 lg:hidden">
            <RiMenuLine aria-hidden size={20} />
          </button>
          <div className="lg:hidden"><Brand to="/dashboard" /></div>
          <div className="ml-auto"><AccountMenu /></div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 focus:outline-none sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
