/**
 * Accessible dialog: labelled, modal, traps Tab focus, closes on Escape and
 * backdrop click (unless `busy`), and returns focus to the opener on close.
 */
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { RiCloseLine } from 'react-icons/ri'

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function DialogBody({ onClose, title, description, size, busy, children, footer }) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    const panel = panelRef.current
    const first = panel?.querySelector('[data-autofocus]') ?? panel?.querySelector(FOCUSABLE)
    first?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  function onKeyDown(e) {
    if (e.key === 'Escape' && !busy) {
      e.stopPropagation()
      onClose()
    }
    if (e.key !== 'Tab') return
    const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)]
    if (!nodes.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onKeyDown={onKeyDown}>
      <motion.div
        className="absolute inset-0 bg-ink-900/35"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={() => !busy && onClose()}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-lg bg-surface shadow-float sm:rounded-lg ${SIZES[size]}`}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            {description && <p id={descId} className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="-mr-1.5 rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-40"
          >
            <RiCloseLine aria-hidden size={19} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3.5">{footer}</div>}
      </motion.div>
    </div>
  )
}

export default function Modal({ open, size = 'md', ...props }) {
  return createPortal(
    <AnimatePresence>{open && <DialogBody key="dialog" size={size} {...props} />}</AnimatePresence>,
    document.body,
  )
}
