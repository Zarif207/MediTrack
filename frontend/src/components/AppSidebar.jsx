import { NavLink } from 'react-router'
import { useAuth } from '../context/useAuth'
import { visibleSections } from '../config/navigation'
import Brand from './Brand'

function NavItem({ to, label, icon: Icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] transition-colors ${
          isActive
            ? 'bg-pine-50 font-medium text-pine-800'
            : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden size={17} className={isActive ? 'text-pine-600' : 'text-ink-400 group-hover:text-ink-600'} />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function AppSidebar({ onNavigate }) {
  const auth = useAuth()
  const sections = visibleSections(auth)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Brand to="/dashboard" />
      </div>
      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-2.5 pb-6 pt-2">
        {sections.map((section) => (
          <div key={section.label ?? 'root'}>
            {section.label && <p className="eyebrow mb-1.5 px-2.5 text-[10.5px]">{section.label}</p>}
            <ul className="space-y-px">
              {section.items.map((item) => (
                <li key={`${section.label}-${item.to}`}>
                  <NavItem {...item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}
