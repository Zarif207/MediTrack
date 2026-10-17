/**
 * Minimal toast notifications for confirming completed actions.
 * Errors are shown inline next to the thing that failed, not as toasts.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { RiCheckLine, RiCloseLine } from 'react-icons/ri'
import { ToastContext } from './useToast'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const notify = useCallback((message) => {
    const id = nextId.current++
    setToasts((t) => [...t.slice(-2), { id, message }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-md bg-ink-900 px-3.5 py-2.5 text-sm text-white shadow-float">
            <RiCheckLine aria-hidden size={17} className="shrink-0 text-pine-300" />
            <span className="min-w-0 flex-1">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-ink-300 hover:text-white">
              <RiCloseLine aria-hidden size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
