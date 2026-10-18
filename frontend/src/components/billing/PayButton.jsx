import { useState } from 'react'
import { RiBankCardLine } from 'react-icons/ri'
import { billsApi } from '../../services/api'
import Button from '../ui/Button'

/**
 * Sends the browser to Stripe Checkout for a pending bill. The server decides
 * the amount and creates the session; this button only follows the URL it
 * returns. Repeat clicks are ignored while a request is in flight.
 */
export default function PayButton({ billId, size = 'sm', variant = 'primary', onError, label = 'Pay with Stripe' }) {
  const [busy, setBusy] = useState(false)

  async function pay() {
    if (busy) return
    setBusy(true)
    onError?.(null)
    try {
      const { checkout_url: url } = await billsApi.checkout(billId)
      if (!/^https:\/\/checkout\.stripe\.com\//.test(url)) throw new Error('Unexpected payment page address.')
      window.location.assign(url)
    } catch (err) {
      onError?.(err.message)
      setBusy(false)
    }
  }

  return (
    <Button size={size} variant={variant} icon={RiBankCardLine} loading={busy} onClick={pay}>
      {label}
    </Button>
  )
}
