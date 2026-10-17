/**
 * DataTable — client-side paginated table.
 *
 * columns: [{ key, header, render?(row), align?: 'right', className?, primary?: bool, hideOnMobile?: bool }]
 * On screens narrower than `md` each row renders as a compact card (primary
 * column as the heading, other columns as label/value pairs), so wide tables
 * never force the page to scroll sideways.
 */
import { useEffect, useState } from 'react'
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri'
import { EmptyState, ErrorState, LoadingState } from './States'

const PAGE_SIZE = 25

function cell(col, row) {
  return col.render ? col.render(row) : (row[col.key] ?? '—')
}

export default function DataTable({
  columns, rows, rowKey, loading, error, onRetry, empty, actions, onRowClick, caption,
}) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE))
  useEffect(() => { if (page > pages - 1) setPage(0) }, [page, pages])

  if (loading) return <LoadingState rows={6} label="Loading records" />
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (!rows?.length) return empty ?? <EmptyState title="Nothing here yet" />

  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const primary = columns.find((c) => c.primary) ?? columns[0]
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile)

  return (
    <div>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-ink-100">
              {columns.map((c) => (
                <th key={c.key} scope="col"
                  className={`whitespace-nowrap px-4 py-2.5 text-xs font-medium text-ink-500 first:pl-5 last:pr-5 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.header}
                </th>
              ))}
              {actions && <th scope="col" className="px-4 py-2.5 pr-5 text-right text-xs font-medium text-ink-500"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {visible.map((row) => (
              <tr key={rowKey(row)}
                className={`align-top ${onRowClick ? 'cursor-pointer hover:bg-ink-50' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 first:pl-5 last:pr-5 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className ?? ''}`}>
                    {cell(c, row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-2 pr-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-0.5">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="divide-y divide-ink-100 md:hidden">
        {visible.map((row) => (
          <li key={rowKey(row)} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <button type="button" disabled={!onRowClick} onClick={onRowClick ? () => onRowClick(row) : undefined}
                className="min-w-0 text-left text-sm font-medium text-ink-900 disabled:cursor-default">
                {cell(primary, row)}
              </button>
              {actions && <div className="-mr-2 -mt-1 flex shrink-0">{actions(row)}</div>}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {secondary.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-[11px] text-ink-500">{c.header}</dt>
                  <dd className="truncate text-[13px] text-ink-800">{cell(c, row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500 sm:px-5">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0}
              aria-label="Previous page" className="rounded-md p-1.5 hover:bg-ink-100 disabled:opacity-40">
              <RiArrowLeftSLine aria-hidden size={18} />
            </button>
            <span className="px-1 tabular-nums">{page + 1} / {pages}</span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1}
              aria-label="Next page" className="rounded-md p-1.5 hover:bg-ink-100 disabled:opacity-40">
              <RiArrowRightSLine aria-hidden size={18} />
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
