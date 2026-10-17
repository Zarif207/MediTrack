import { RiErrorWarningLine, RiInformationLine, RiCheckboxCircleLine, RiCloseLine } from 'react-icons/ri'
import Button from './Button'
import Spinner from './Spinner'
import { ApiError } from '../../services/api'

export function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}>
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-ink-400">
          <Icon aria-hidden size={20} />
        </div>
      )}
      <p className="text-sm font-medium text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Loading…', rows = 0 }) {
  if (rows) {
    return (
      <div role="status" aria-label={label} className="divide-y divide-ink-100">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-3 w-1/4 animate-pulse rounded-sm bg-ink-100" />
            <div className="h-3 w-1/3 animate-pulse rounded-sm bg-ink-100" />
            <div className="ml-auto h-3 w-16 animate-pulse rounded-sm bg-ink-100" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div role="status" className="flex items-center justify-center gap-2.5 py-14 text-sm text-ink-500">
      <Spinner /> {label}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'This could not be loaded' }) {
  // Only API errors carry user-facing text; anything else is a client bug.
  const message = typeof error === 'string' ? error
    : error instanceof ApiError ? error.message
      : error ? 'Something went wrong while showing this page. Reload and try again.' : null
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-danger-50 text-danger-600">
        <RiErrorWarningLine aria-hidden size={20} />
      </div>
      <p className="text-sm font-medium text-ink-900">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm text-ink-500">{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

const ALERT_TONES = {
  error: ['border-danger-600/25 bg-danger-50 text-danger-700', RiErrorWarningLine],
  info: ['border-info-700/20 bg-info-50 text-info-700', RiInformationLine],
  success: ['border-pine-600/25 bg-pine-50 text-pine-800', RiCheckboxCircleLine],
  warn: ['border-warn-700/25 bg-warn-50 text-warn-700', RiErrorWarningLine],
}

export function Alert({ tone = 'error', title, children, onDismiss }) {
  if (!children && !title) return null
  const [cls, Icon] = ALERT_TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-md border px-3.5 py-3 text-sm ${cls}`}>
      <Icon aria-hidden size={18} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          <RiCloseLine aria-hidden size={17} />
        </button>
      )}
    </div>
  )
}
