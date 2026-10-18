/**
 * Shown on /bills after Stripe sends the browser back.
 * "Success" in the URL proves nothing: we ask the server, which only reports a
 * bill as paid after Stripe has confirmed it.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { paymentsApi } from '../../services/api'
import { Alert } from '../ui/States'

const ATTEMPTS = 8

export default function PaymentReturnNotice({ onConfirmed }) {
  const [params, setParams] = useSearchParams()
  const outcome = params.get('payment')
  const sessionId = params.get('session_id')
  const [state, setState] = useState(outcome === 'success' && sessionId ? 'checking' : outcome)

  useEffect(() => {
    if (outcome !== 'success' || !sessionId) return undefined
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < ATTEMPTS && !cancelled; i++) {
        try {
          const s = await paymentsApi.sessionStatus(sessionId)
          if (s.bill_status === 'paid' && s.payment_status === 'paid') { setState('paid'); onConfirmed?.(); return }
          if (['failed', 'expired'].includes(s.payment_status)) { setState('failed'); return }
          if (['duplicate', 'needs_review'].includes(s.payment_status)) { setState('review'); return }
        } catch {
          setState('error'); return
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
      if (!cancelled) setState('waiting')
    })()
    return () => { cancelled = true }
  }, [outcome, sessionId, onConfirmed])

  if (!state) return null
  const dismiss = () => { setParams({}, { replace: true }); setState(null) }
  const box = (tone, title, body) => (
    <div className="mb-6"><Alert tone={tone} title={title} onDismiss={state === 'checking' ? undefined : dismiss}>{body}</Alert></div>
  )
  switch (state) {
    case 'checking': return box('info', 'Confirming your payment…', 'Waiting for Stripe to confirm. This usually takes a few seconds.')
    case 'paid': return box('success', 'Payment received', 'Stripe confirmed the payment and the bill is now marked paid.')
    case 'waiting': return box('info', 'Payment not confirmed yet', 'Stripe has not confirmed this payment yet. The bill will update automatically once it does — check back in a minute. Please do not pay again.')
    case 'failed': return box('error', 'Payment did not go through', 'Nothing was charged. The bill is still pending; you can try again.')
    case 'review': return box('warn', 'Payment needs review', 'This bill had already been paid or changed. The clinic will review the payment and refund it if needed.')
    case 'cancelled': return box('info', 'Payment cancelled', 'You left the payment page. Nothing was charged and the bill is still pending.')
    case 'error': return box('error', 'Could not check the payment', 'We could not reach the server to confirm this payment. Refresh the page in a moment.')
    default: return null
  }
}
