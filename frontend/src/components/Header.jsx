import { RiMenuLine, RiMenu3Line, RiUserLine, RiStethoscopeLine } from 'react-icons/ri'

export default function Header({ title, sidebarCollapsed, onToggleSidebar, onToggleMobile }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 px-4 sm:px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
      {/* Mobile menu toggle */}
      <button
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={onToggleMobile}
        aria-label="Open navigation"
      >
        <RiMenuLine size={20} />
      </button>

      {/* Desktop sidebar collapse toggle */}
      <button
        className="hidden lg:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <RiMenu3Line size={20} />
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
      </div>

      {/* Right side — demo user chip */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-navy-50 rounded-lg">
          <RiStethoscopeLine size={14} className="text-navy-600" />
          <span className="text-xs font-medium text-navy-700">Staff Portal</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-navy-800 flex items-center justify-center">
          <RiUserLine size={14} className="text-white" />
        </div>
      </div>
    </header>
  )
}
