/** Reusable select with label and error */
export default function Select({
  label,
  error,
  required,
  id,
  className = '',
  children,
  ...props
}) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full rounded-lg border px-3 py-2 text-sm text-gray-900 bg-white
          border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200
          ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}
          transition-colors duration-150 ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
