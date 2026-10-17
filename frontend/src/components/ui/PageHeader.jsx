import { Link } from 'react-router'
import { RiArrowRightSLine } from 'react-icons/ri'

/**
 * Page title block. `breadcrumbs` is an optional array of { label, to }.
 */
export default function PageHeader({ title, description, actions, breadcrumbs }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs?.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-500">
              {breadcrumbs.map((b, i) => (
                <li key={b.label} className="flex items-center gap-1">
                  {i > 0 && <RiArrowRightSLine aria-hidden size={14} className="text-ink-300" />}
                  {b.to ? <Link to={b.to} className="hover:text-ink-900">{b.label}</Link> : <span aria-current="page">{b.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-[-0.01em] sm:text-[22px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
