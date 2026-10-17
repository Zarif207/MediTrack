import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Run an async loader and track { data, loading, error }.
 * Stale responses (from an older call or after unmount) are ignored.
 */
export function useAsync(loader, deps = []) {
  // `source` records which loader produced `data`, so a render that happens
  // after the dependencies change (but before the new request starts) reports
  // loading instead of showing data for the old dependencies.
  const [state, setState] = useState({ data: undefined, loading: true, error: null, source: null })
  const callId = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  const reload = useCallback(async () => {
    const id = ++callId.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await run()
      if (id === callId.current) setState({ data, loading: false, error: null, source: run })
    } catch (error) {
      if (id === callId.current) setState((s) => ({ ...s, loading: false, error, source: run }))
    }
  }, [run])

  useEffect(() => {
    reload()
    // Invalidate in-flight calls when deps change or the component unmounts.
    const calls = callId
    return () => { calls.current++ }
  }, [reload])

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }))
  }, [])

  const current = state.source === run
  return {
    data: current ? state.data : undefined,
    loading: state.loading || !current,
    error: current ? state.error : null,
    reload,
    setData,
  }
}

/**
 * Load optional lookup data (e.g. patient names for a table). A failure —
 * typically 403 for a role that may not read that resource — yields an empty
 * list instead of breaking the page.
 */
export async function optional(promise) {
  try {
    return await promise
  } catch {
    return []
  }
}
