/** Filter row above a table: search and filters on the left, a count on the right. */
export default function Toolbar({ children, count }) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-ink-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
      {children}
      {count !== undefined && <p className="text-xs text-ink-500 sm:ml-auto">{count}</p>}
    </div>
  )
}

export function FilterSelect({ label, value, onChange, children }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="control h-9 sm:w-auto sm:min-w-[9rem]">
      {children}
    </select>
  )
}
