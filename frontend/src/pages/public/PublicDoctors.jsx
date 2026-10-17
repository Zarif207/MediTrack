import { useMemo, useState } from 'react'
import { departmentsApi, doctorsApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import SearchInput from '../../components/ui/SearchInput'
import Button from '../../components/ui/Button'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { doctorName, initials, sentenceCase } from '../../utils/format'

export function PublicPageHeader({ eyebrow, title, children }) {
  return (
    <div className="border-b border-ink-100">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-[34px] font-medium leading-tight tracking-[-0.015em] sm:text-[40px]">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600">{children}</p>}
      </div>
    </div>
  )
}

export default function PublicDoctors() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([doctorsApi.listAll(), departmentsApi.listAll()]), [])
  const [doctors, departments] = data ?? [[], []]
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')
  const deptName = useMemo(() => Object.fromEntries(departments.map((d) => [d.department_id, d.department_name])), [departments])

  const shown = doctors
    .filter((d) => !dept || String(d.department_id) === dept)
    .filter((d) => {
      const q = search.trim().toLowerCase()
      return !q || [doctorName(d), d.specialization, deptName[d.department_id]].some((v) => v?.toLowerCase().includes(q))
    })

  return (
    <>
      <PublicPageHeader eyebrow="Directory" title="Doctors">
        Doctors you can book online, grouped by department.
      </PublicPageHeader>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-col gap-2.5 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or specialty" className="sm:w-80" />
          <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className="control h-9 sm:w-56">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
          </select>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={reload} /> : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-500">{doctors.length ? 'No doctors match your search.' : 'No doctors have been published yet.'}</p>
        ) : (
          <ul className="grid gap-px overflow-hidden rounded-lg border border-ink-100 bg-ink-100 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((d) => (
              <li key={d.doctor_id} className="flex items-start gap-3.5 bg-surface px-5 py-5">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine-50 text-[13px] font-semibold text-pine-700">
                  {initials(`${d.first_name} ${d.last_name}`)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{doctorName(d)}</p>
                  <p className="text-[13px] text-ink-600">{sentenceCase(d.specialization)}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{deptName[d.department_id] ?? '—'}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10 flex flex-col items-start gap-3 rounded-lg border border-ink-100 bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-700">Ready to see one of our doctors?</p>
          <Button to="/appointments/book">Book an appointment</Button>
        </div>
      </div>
    </>
  )
}
