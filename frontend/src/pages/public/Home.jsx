/**
 * Public homepage. Departments and doctors are loaded from the API; nothing on
 * this page is invented (no statistics, reviews, addresses or credentials).
 */
import { Link } from 'react-router'
import { RiArrowRightLine } from 'react-icons/ri'
import { departmentsApi, doctorsApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import Button from '../../components/ui/Button'
import { doctorName, initials, sentenceCase } from '../../utils/format'

const STEPS = [
  ['Create an account', 'Sign up with your email. The clinic confirms your account as a patient account.'],
  ['Choose a doctor and an open time', 'Filter by department, pick a day, and see the times that are still free.'],
  ['Manage it from your account', 'Your booking is saved straight away. Cancel online up to the start of the visit.'],
]

const PORTAL = [
  ['Appointments', 'Upcoming and past visits, with the option to cancel.'],
  ['Visit records', 'Diagnosis and treatment notes your doctor records after a visit.'],
  ['Prescriptions', 'Each medicine with its dosage, frequency and duration.'],
  ['Bills', 'What was charged for each visit and whether it has been paid.'],
]

const FAQ = [
  ['Do I need a patient file before I can book?',
    'No. Once your account has patient access you can book immediately. The clinic links your account to your patient file separately, after which visit records and bills appear in your account.'],
  ['Who can see my information?',
    'You see only appointments, records, prescriptions and bills that belong to you. Staff see only what their role requires — for example, billing staff cannot read clinical notes. These rules are enforced by the server, not just hidden in the interface.'],
  ['How long are appointment slots?',
    'Online booking offers 30-minute slots between 9:00 and 17:00, up to 180 days ahead. A time disappears as soon as someone books it.'],
  ['Can I use MediTrack in an emergency?',
    'No. MediTrack is an academic project, not a real clinic. In an emergency contact your local emergency number.'],
]

function SectionHeading({ eyebrow, title, children, action }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-2 font-serif text-[26px] font-medium leading-tight tracking-[-0.01em] sm:text-[30px]">{title}</h2>
        {children && <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{children}</p>}
      </div>
      {action}
    </div>
  )
}

export default function Home() {
  const { data, loading, error } = useAsync(() => Promise.all([departmentsApi.listAll(), doctorsApi.listAll()]), [])
  const [departments, doctors] = data ?? [[], []]
  const deptName = Object.fromEntries(departments.map((d) => [d.department_id, d.department_name]))
  const doctorCount = doctors.reduce((m, d) => ({ ...m, [d.department_id]: (m[d.department_id] ?? 0) + 1 }), {})

  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-100">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="eyebrow">Appointments and patient records</p>
            <h1 className="mt-4 font-serif text-[40px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-[52px]">
              See a doctor without the phone queue.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-600">
              Choose a department and a doctor, pick a time that is actually free, and keep your visits,
              prescriptions and bills together in one private account.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" to="/appointments/book">Book an appointment</Button>
              <Button size="lg" variant="secondary" to="/public/doctors">Find a doctor</Button>
            </div>
          </div>

          <ol className="relative space-y-0 rounded-lg border border-ink-100 bg-surface">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4 border-b border-ink-100 px-5 py-5 last:border-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-pine-200 font-mono text-xs text-pine-700">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">{title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Departments */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading eyebrow="Departments" title="Care is organised by department"
          action={departments.length > 0 && <Link to="/public/departments" className="link text-sm">All departments</Link>}>
          Every doctor belongs to a department. Start with the area that matches your concern.
        </SectionHeading>
        {loading ? (
          <div className="grid gap-px overflow-hidden rounded-lg border border-ink-100 bg-ink-100 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse bg-surface" />)}
          </div>
        ) : error ? (
          <p className="rounded-lg border border-ink-100 bg-surface px-5 py-6 text-sm text-ink-600">
            Departments could not be loaded right now. Please try again later.
          </p>
        ) : departments.length === 0 ? (
          <p className="rounded-lg border border-ink-100 bg-surface px-5 py-6 text-sm text-ink-600">No departments have been published yet.</p>
        ) : (
          <ul className="grid gap-px overflow-hidden rounded-lg border border-ink-100 bg-ink-100 sm:grid-cols-2 lg:grid-cols-3">
            {departments.slice(0, 6).map((d) => (
              <li key={d.department_id} className="bg-surface px-5 py-5">
                <p className="text-[15px] font-medium text-ink-900">{d.department_name}</p>
                {d.description && <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-600">{d.description}</p>}
                <p className="mt-3 text-xs text-ink-500">
                  {doctorCount[d.department_id] ? `${doctorCount[d.department_id]} doctor${doctorCount[d.department_id] === 1 ? '' : 's'}` : 'No doctors listed yet'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Doctors */}
      {!loading && !error && doctors.length > 0 && (
        <section className="border-y border-ink-100 bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionHeading eyebrow="Doctors" title="The people you can book"
              action={<Link to="/public/doctors" className="link text-sm">Full directory</Link>} />
            <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.slice(0, 6).map((d) => (
                <li key={d.doctor_id} className="flex items-start gap-3.5">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine-50 text-[13px] font-semibold text-pine-700">
                    {initials(`${d.first_name} ${d.last_name}`)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{doctorName(d)}</p>
                    <p className="text-[13px] text-ink-600">{sentenceCase(d.specialization)}</p>
                    {deptName[d.department_id] && <p className="mt-0.5 text-xs text-ink-500">{deptName[d.department_id]}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* How it works + portal */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="How booking works" title="Booked in a minute, kept in one place">
              Booking needs an account with patient access. You do not have to wait for a patient file — the clinic
              links that to your account separately, without holding up your booking.
            </SectionHeading>
            <Button to="/appointments/book" icon={RiArrowRightLine}>Start booking</Button>
          </div>
          <dl className="divide-y divide-ink-100 rounded-lg border border-ink-100 bg-surface">
            {PORTAL.map(([title, body]) => (
              <div key={title} className="grid gap-1 px-5 py-4 sm:grid-cols-[9rem_1fr]">
                <dt className="text-sm font-medium text-ink-900">{title}</dt>
                <dd className="text-[13.5px] leading-relaxed text-ink-600">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-ink-100">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="Questions" title="Before you book" />
          <div className="divide-y divide-ink-100 border-y border-ink-100">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink-900">
                  {q}
                  <span aria-hidden className="text-lg leading-none text-ink-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2.5 text-[14px] leading-relaxed text-ink-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
