import { Link } from 'react-router'
import {
  RiArrowRightLine, RiCalendarCheckLine, RiCalendarScheduleLine, RiTimeLine,
} from 'react-icons/ri'
import { useAuth } from '../context/useAuth'
import { ROLE_LABELS } from '../config/navigation'
import {
  appointmentsApi, billsApi, doctorsApi, medicalRecordsApi, medicinesApi,
  patientsApi, prescriptionsApi,
} from '../services/api'
import { optional, useAsync } from '../hooks/useAsync'
import Panel from '../components/ui/Panel'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import { EmptyState, ErrorState, LoadingState, Alert } from '../components/ui/States'
import { AppointmentRow } from './patient/MyAppointments'
import { FullyPaid, PendingPayments } from '../components/billing/BillingGroups'
import {
  doctorName, formatCurrency, formatDate, formatTime, isUpcoming, plural, todayISO,
} from '../utils/format'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function firstName(profile) {
  return (profile?.display_name || profile?.email?.split('@')[0] || '').split(' ')[0]
}

function Figure({ label, value, to, note }) {
  const body = (
    <>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.01em]">{value}</p>
      {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
    </>
  )
  return to ? (
    <Link to={to} className="block rounded-lg border border-ink-100 bg-surface px-4 py-3.5 transition-colors hover:border-ink-200">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-ink-100 bg-surface px-4 py-3.5">{body}</div>
  )
}

export default function Dashboard() {
  const { role } = useAuth()
  if (role === 'patient') return <PatientDashboard />
  if (role === 'user') return <AwaitingAccess />
  return <StaffDashboard />
}

// ── Awaiting a role ───────────────────────────────────────────────────────────

function AwaitingAccess() {
  const { profile } = useAuth()
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">Account created</p>
      <h1 className="mt-1 text-xl font-semibold sm:text-[22px]">Welcome{firstName(profile) ? `, ${firstName(profile)}` : ''}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">
        Your account is ready, but it has not been given access yet. A MediTrack administrator assigns each
        account a role — patient, or a staff role — before clinical features are available.
      </p>
      <Panel className="mt-6" bodyClassName="divide-y divide-ink-100">
        {[
          ['Signed in', profile?.email, true],
          ['Role assigned by an administrator', 'Pending', false],
        ].map(([label, value, done]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm sm:px-5">
            <span className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${done ? 'bg-pine-500' : 'bg-ink-300'}`} aria-hidden />
              {label}
            </span>
            <span className="truncate text-ink-500">{value}</span>
          </div>
        ))}
      </Panel>
      <p className="mt-6 text-sm text-ink-600">
        Meanwhile you can browse <Link className="link" to="/public/doctors">our doctors</Link> and{' '}
        <Link className="link" to="/public/departments">departments</Link>.
      </p>
    </div>
  )
}

// ── Patient ───────────────────────────────────────────────────────────────────

function PatientDashboard() {
  const { profile } = useAuth()
  const { data, loading, error, reload } = useAsync(() => Promise.all([
    appointmentsApi.listAll(),
    optional(doctorsApi.listAll()),
    medicalRecordsApi.listAll(),
    prescriptionsApi.listAll(),
    billsApi.listAll(),
    billsApi.summary(),
  ]), [])
  const [appts, doctors, records, prescriptions, bills, billSummary] = data ?? [[], [], [], [], [], null]
  const doctorById = Object.fromEntries(doctors.map((d) => [d.doctor_id, d]))

  const upcoming = appts
    .filter((a) => ['scheduled', 'confirmed'].includes(a.status) && isUpcoming(a))
    .sort((a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`))
  const outstanding = bills.filter((b) => b.payment_status === 'pending')
  const latestRecord = [...records].sort((a, b) => b.record_date.localeCompare(a.record_date))[0]

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{formatDate(todayISO(), { weekday: 'long' })}</p>
          <h1 className="mt-1 text-xl font-semibold sm:text-[22px]">
            {greeting()}{firstName(profile) ? `, ${firstName(profile)}` : ''}
          </h1>
        </div>
        <Button size="lg" icon={RiCalendarScheduleLine} to="/patient/book-appointment">Book an appointment</Button>
      </div>

      {loading ? <Panel><LoadingState /></Panel> : error ? (
        <Panel><ErrorState error={error} onRetry={reload} /></Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-6">
            <Panel title="Upcoming appointments"
              actions={upcoming.length > 0 && <Link to="/appointments" className="link text-[13px]">All appointments</Link>}>
              {upcoming.length ? (
                <ul className="divide-y divide-ink-100">
                  {upcoming.slice(0, 3).map((a) => <AppointmentRow key={a.appointment_id} appt={a} doctor={doctorById[a.doctor_id]} />)}
                </ul>
              ) : (
                <EmptyState icon={RiCalendarCheckLine} title="Nothing booked"
                  description="Choose a doctor and an open time — it takes about a minute."
                  action={<Button size="sm" to="/patient/book-appointment">Book appointment</Button>} />
              )}
            </Panel>

            {billSummary && (billSummary.pending.length > 0 || bills.length > 0) && (
              <PendingPayments summary={billSummary} canPay showPatient={false} title="Bills to pay"
                action={<Link to="/bills" className="link text-[13px]">All bills</Link>} />
            )}

            {latestRecord && (
              <Panel title="Latest visit record" description={formatDate(latestRecord.record_date)}
                actions={<Link to="/medical-records" className="link text-[13px]">All records</Link>}
                bodyClassName="px-4 py-3.5 sm:px-5">
                <p className="text-sm text-ink-800">{latestRecord.diagnosis || 'No diagnosis recorded.'}</p>
              </Panel>
            )}
          </div>

          <aside className="space-y-3">
            <Figure label="Upcoming visits" value={upcoming.length} to="/appointments" />
            <Figure label="Prescriptions" value={prescriptions.length} to="/prescriptions" />
            <Figure label="Outstanding bills" value={outstanding.length}
              note={outstanding.length ? formatCurrency(outstanding.reduce((s, b) => s + Number.parseFloat(b.amount), 0)) : null}
              to="/bills" />
            {profile?.patient_id == null && (
              <Alert tone="info">
                Visit records, prescriptions and bills appear once the clinic links your account to your patient file.
                Booking works now.
              </Alert>
            )}
          </aside>
        </div>
      )}
    </>
  )
}

// ── Staff ─────────────────────────────────────────────────────────────────────

function StaffDashboard() {
  const { profile, role, can } = useAuth()
  const today = todayISO()

  const { data, loading, error, reload } = useAsync(async () => {
    const [appts, doctors, patients, pendingBills, medicines, prescriptions] = await Promise.all([
      can('appointments:read') ? appointmentsApi.listAll() : null,
      optional(doctorsApi.listAll()),
      can('patients:read') ? patientsApi.listAll() : null,
      can('bills:read') ? billsApi.listAll({ payment_status: 'pending' }) : null,
      can('medicines:read') ? medicinesApi.listAll() : null,
      can('prescriptions:read') ? prescriptionsApi.listAll() : null,
    ])
    const billSummary = can('bills:read') ? await billsApi.summary() : null
    return { appts, doctors, patients, pendingBills, medicines, prescriptions, billSummary }
  }, [role])

  const d = data ?? {}
  const doctorById = Object.fromEntries((d.doctors ?? []).map((x) => [x.doctor_id, x]))
  const todays = (d.appts ?? [])
    .filter((a) => a.appointment_date === today)
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
  const awaitingRecord = (d.appts ?? []).filter((a) => a.patient_id == null && ['scheduled', 'confirmed'].includes(a.status))
  const lowStock = (d.medicines ?? []).filter((m) => m.stock_quantity <= 10)

  const figures = [
    d.appts && { label: 'Appointments today', value: todays.length, to: '/appointments' },
    d.appts && can('appointments:write') && {
      label: 'Bookings without a patient file', value: awaitingRecord.length, to: '/appointments',
      note: awaitingRecord.length ? 'Link them before adding records or bills' : null,
    },
    d.patients && { label: 'Patients on file', value: d.patients.length, to: '/patients' },
    d.pendingBills && {
      label: 'Pending bills', value: d.pendingBills.length, to: '/bills',
      note: d.pendingBills.length ? formatCurrency(d.pendingBills.reduce((s, b) => s + Number.parseFloat(b.amount), 0)) : null,
    },
    d.medicines && { label: 'Medicines at or below 10 units', value: lowStock.length, to: '/medicines' },
    d.prescriptions && !d.appts && { label: 'Prescriptions on file', value: d.prescriptions.length, to: '/prescriptions' },
  ].filter(Boolean)

  return (
    <>
      <div className="mb-8">
        <p className="eyebrow">{formatDate(today, { weekday: 'long' })} · {ROLE_LABELS[role]}</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-[22px]">
          {greeting()}{firstName(profile) ? `, ${firstName(profile)}` : ''}
        </h1>
      </div>

      {loading ? <Panel><LoadingState /></Panel> : error ? (
        <Panel><ErrorState error={error} onRetry={reload} /></Panel>
      ) : (
        <div className="space-y-6">
          {role === 'doctor' && profile?.doctor_id == null && (
            <Alert tone="warn" title="Your account is not linked to a doctor record">
              Appointments, medical records and prescriptions appear once an administrator links your account to your doctor
              record under Users &amp; roles.
            </Alert>
          )}
          {figures.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {figures.map((f) => <Figure key={f.label} {...f} />)}
            </div>
          )}

          {d.appts && (
            <Panel title="Today's schedule" description={plural(todays.length, 'appointment')}
              actions={<Link to="/appointments" className="link text-[13px]">Open schedule</Link>}>
              {todays.length ? (
                <ul className="divide-y divide-ink-100">
                  {todays.map((a) => (
                    <li key={a.appointment_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                      <span className="flex w-20 items-center gap-1.5 text-sm font-medium tabular-nums">
                        <RiTimeLine aria-hidden size={14} className="text-ink-400" />{formatTime(a.appointment_time)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        {a.patient_name ?? 'Unnamed booking'}
                        <span className="text-ink-500"> with {doctorById[a.doctor_id] ? doctorName(doctorById[a.doctor_id]) : `doctor #${a.doctor_id}`}</span>
                      </span>
                      <StatusBadge value={a.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={RiCalendarCheckLine} title="No appointments today" />
              )}
            </Panel>
          )}

          {d.billSummary && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <PendingPayments summary={d.billSummary} canPay={can('bills:write')} limit={6}
                action={<Link to="/bills" className="link text-[13px]">All bills</Link>} />
              <FullyPaid summary={d.billSummary} limit={6} />
            </div>
          )}

          {lowStock.length > 0 && (
            <Panel title="Low stock" actions={<Link to="/medicines" className="link text-[13px]">Inventory</Link>}>
              <ul className="divide-y divide-ink-100">
                {lowStock.slice(0, 6).map((m) => (
                  <li key={m.medicine_id} className="flex items-center justify-between px-4 py-2.5 text-sm sm:px-5">
                    <span>{m.medicine_name} <span className="text-ink-500">{m.strength}</span></span>
                    <span className="tabular-nums text-warn-700">{plural(m.stock_quantity, 'unit')}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {!d.appts && !d.medicines && !d.pendingBills && (
            <Panel bodyClassName="flex items-center justify-between gap-4 px-5 py-4">
              <p className="text-sm text-ink-600">Use the navigation to open the sections your role can access.</p>
              <RiArrowRightLine aria-hidden className="text-ink-300" />
            </Panel>
          )}
        </div>
      )}
    </>
  )
}
