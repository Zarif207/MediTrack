import { useCallback, useState } from 'react'

/**
 * Wrap a create/update/delete call: tracks `busy`, keeps the last error, and
 * ignores repeat submissions while a request is in flight.
 */
export function useMutation(fn) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (...args) => {
    if (busy) return undefined
    setBusy(true)
    setError(null)
    try {
      return await fn(...args)
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setBusy(false)
    }
  }, [fn, busy])

  return { run, busy, error, setError, reset: () => setError(null) }
}
