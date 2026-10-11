/** Reusable input with label, error, and hint support */
export default function Input({
  label,
  error,
  hint,
  required,
  id,
  className = '',
  type = 'text',
  ...props
}) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea
          id={inputId}
          rows={3}
          className={`
            w-full rounded-lg border px-3 py-2 text-sm text-gray-900
            placeholder-gray-400 bg-white
            border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200
            ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}
            transition-colors duration-150 resize-none ${className}
          `}
          {...props}
        />
      ) : (
        <input
          id={inputId}
          type={type}
          className={`
            w-full rounded-lg border px-3 py-2 text-sm text-gray-900
            placeholder-gray-400 bg-white
            border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200
            ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}
            transition-colors duration-150 ${className}
          `}
          {...props}
        />
      )}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
