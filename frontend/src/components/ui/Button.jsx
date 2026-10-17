/**
 * Button
 *   variant: primary | secondary | ghost | danger
 *   size:    sm | md | lg
 * Renders a react-router <Link> when `to` is given.
 */
import { Link } from 'react-router'
import Spinner from './Spinner'

const VARIANTS = {
  primary: 'bg-pine-700 text-white hover:bg-pine-800 active:bg-pine-900 border-transparent',
  secondary: 'bg-surface text-ink-800 border-ink-200 hover:border-ink-300 hover:bg-ink-50',
  ghost: 'bg-transparent text-ink-700 border-transparent hover:bg-ink-100',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 border-transparent',
}

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  to,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  const cls = `inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border font-medium
    transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50
    ${VARIANTS[variant]} ${SIZES[size]} ${className}`
  const content = (
    <>
      {loading ? <Spinner size="sm" /> : Icon ? <Icon aria-hidden size={size === 'sm' ? 15 : 17} /> : null}
      {children}
    </>
  )
  if (to) {
    return <Link to={to} className={cls} {...props}>{content}</Link>
  }
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  )
}

/** Square icon button. `label` is required: it is the accessible name. */
export function IconButton({ icon: Icon, label, tone = 'default', className = '', ...props }) {
  const tones = {
    default: 'text-ink-500 hover:text-ink-900 hover:bg-ink-100',
    danger: 'text-ink-500 hover:text-danger-700 hover:bg-danger-50',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${tones[tone]} ${className}`}
      {...props}
    >
      <Icon aria-hidden size={17} />
    </button>
  )
}
