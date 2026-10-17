import { useCallback, useState } from 'react'

/**
 * Controlled form state with per-field errors.
 * `bind(name)` returns props for <Input>/<Select>/<Textarea>.
 * `applyServerErrors(err)` maps ApiError.fieldErrors onto fields and returns
 * any message that does not belong to a specific field.
 */
export function useForm(initial) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})

  const set = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e))
  }, [])

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => set(name, e.target.value),
    error: errors[name],
  })

  const reset = useCallback((next = initial) => {
    setValues(next)
    setErrors({})
  }, [initial])

  function applyServerErrors(err) {
    const fieldErrors = err?.fieldErrors ?? {}
    const known = Object.keys(fieldErrors).filter((k) => k in values)
    if (known.length) setErrors(Object.fromEntries(known.map((k) => [k, fieldErrors[k]])))
    return known.length === Object.keys(fieldErrors).length && known.length ? null : err?.message
  }

  return { values, set, bind, errors, setErrors, reset, applyServerErrors }
}

/** Convert '' to null for optional fields before sending. */
export function blankToNull(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v]))
}
