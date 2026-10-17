import Modal from './Modal'
import Button from './Button'
import { Alert } from './States'

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm',
  danger = false, loading = false, error,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-700">{message}</p>
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  )
}
