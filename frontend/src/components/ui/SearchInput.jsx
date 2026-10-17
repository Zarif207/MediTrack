import { RiSearchLine } from 'react-icons/ri'

export default function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <RiSearchLine aria-hidden size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="control h-9 pl-9"
      />
    </div>
  )
}
