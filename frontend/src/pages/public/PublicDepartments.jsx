import { departmentsApi, doctorsApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { doctorName } from '../../utils/format'
import { PublicPageHeader } from './PublicDoctors'

export default function PublicDepartments() {
  const { data, loading, error, reload } = useAsync(() => Promise.all([departmentsApi.listAll(), doctorsApi.listAll()]), [])
  const [departments, doctors] = data ?? [[], []]

  return (
    <>
      <PublicPageHeader eyebrow="Departments" title="Departments and their doctors">
        Each department lists the doctors you can book with.
      </PublicPageHeader>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={reload} /> : departments.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-500">No departments have been published yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100 border-y border-ink-100">
            {departments.map((d) => {
              const team = doctors.filter((doc) => doc.department_id === d.department_id)
              return (
                <li key={d.department_id} className="grid gap-3 py-6 md:grid-cols-[16rem_1fr_16rem] md:gap-8">
                  <h2 className="text-base font-medium">{d.department_name}</h2>
                  <p className="text-[14px] leading-relaxed text-ink-600">{d.description || 'No description yet.'}</p>
                  <div>
                    <p className="eyebrow text-[10.5px]">Doctors</p>
                    {team.length ? (
                      <ul className="mt-1.5 space-y-1 text-[13.5px] text-ink-800">
                        {team.map((doc) => <li key={doc.doctor_id}>{doctorName(doc)}</li>)}
                      </ul>
                    ) : <p className="mt-1.5 text-[13.5px] text-ink-500">None listed yet</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
