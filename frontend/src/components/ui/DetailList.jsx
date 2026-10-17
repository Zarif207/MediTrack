/** Label / value pairs for detail views. `items`: [[label, value], ...] */
export default function DetailList({ items, columns = 1 }) {
  return (
    <dl className={`grid gap-x-6 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label} className="border-b border-ink-100 py-2.5 last:border-0">
          <dt className="text-xs text-ink-500">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink-900">
            {value === null || value === undefined || value === '' ? <span className="text-ink-400">—</span> : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
