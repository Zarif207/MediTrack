import { Link } from 'react-router'
import Brand from './Brand'

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <div className="hidden flex-col justify-between border-r border-ink-100 bg-pine-900 p-10 text-pine-50 lg:flex">
        <Brand tone="light" />
        <div className="max-w-md">
          <p className="font-serif text-[28px] leading-snug text-white">
            Book a visit, then keep your appointments, records and bills in one place.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-pine-200">
            Patients see only their own information. Staff see what their role needs.
          </p>
        </div>
        <Link to="/" className="text-sm text-pine-200 hover:text-white">← Back to the MediTrack site</Link>
      </div>
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="lg:hidden"><Brand /></div>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-600">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink-600">{footer}</div>}
        </main>
        <Link to="/" className="text-center text-sm text-ink-500 hover:text-ink-900 lg:hidden">← Back to the site</Link>
      </div>
    </div>
  )
}
