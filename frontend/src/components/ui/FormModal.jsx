import { useId } from 'react'
import Modal from './Modal'
import Button from './Button'
import { Alert } from './States'

/**
 * A dialog containing a form. The submit button lives in the footer and is
 * tied to the form by id, so Enter submits and the button shows progress.
 */
export default function FormModal({
  open, onClose, title, description, onSubmit, busy, error, submitLabel = 'Save', size = 'lg', children,
}) {
  const formId = useId()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form={formId} loading={busy}>{submitLabel}</Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit() }} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {children}
      </form>
    </Modal>
  )
}
