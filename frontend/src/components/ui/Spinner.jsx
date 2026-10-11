export default function Spinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-3', lg: 'w-12 h-12 border-4' }
  return (
    <div
      className={`${s[size] ?? s.md} border-navy-200 border-t-navy-700 rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-gray-500">
      <Spinner size="lg" />
      <p className="text-sm">Loading…</p>
    </div>
  )
}
