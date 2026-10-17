/**
 * Form controls with visible labels, hints and errors wired up for assistive
 * technology (aria-invalid / aria-describedby).
 */
import { useId } from 'react'

export function Field({ label, hint, error, required, children, className = '' }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink-800">
          {label}
          {required && <span className="ml-0.5 text-danger-600" aria-hidden>*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {hint && !error && <p id={hintId} className="text-xs text-ink-500">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium text-danger-700">{error}</p>}
    </div>
  )
}

export function Input({ label, hint, error, required, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => <input className="control h-9" {...a11y} {...props} />}
    </Field>
  )
}

export function Textarea({ label, hint, error, required, className, rows = 3, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => <textarea rows={rows} className="control resize-y leading-relaxed" {...a11y} {...props} />}
    </Field>
  )
}

export function Select({ label, hint, error, required, className, children, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => (
        <select className="control h-9 pr-8" {...a11y} {...props}>
          {children}
        </select>
      )}
    </Field>
  )
}

/** Uniform grid for form fields: one column on phones, two from `sm`. */
export function FieldGrid({ children }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
}
