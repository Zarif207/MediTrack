import { useMemo, useState } from 'react'
import { RiCalendarCheckLine, RiCalendarScheduleLine } from 'react-icons/ri'
import { appointmentsApi, doctorsApi } from '../../services/api'
import { optional, useAsync } from '../../hooks/useAsync'
import { useToast } from '../../components/ui/useToast'
import PageHeader from '../../components/ui/PageHeader'
import Panel from '../../components/ui/Panel'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States'
import { doctorName, formatDate, formatTime, isUpcoming } from '../../utils/format'

const ACTIVE = ['scheduled', 'confirmed']

export function AppointmentRow({ appt, doctor, action }) {
  const [y, m, d] = appt.appointment_date.split('-').map(Number)
  const day = new Date(y, m - 1, d)
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <div className="flex w-14 shrink-0 flex-col items-center rounded-md border border-ink-100 py-1.5 text-center">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-ink-500">
          {day.toLocaleDateString(undefined, { month: 'short' })}
        </span>
        <span className="text-lg font-semibold leading-tight tabular-nums">{d}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">
          {doctor ? doctorName(doctor) : `Doctor #${appt.doctor_id}`}
          {doctor && <span className="font-normal text-ink-500"> · {doctor.specialization}</span>}
        </p>
        <p className="mt-0.5 text-[13px] text-ink-600">
          {formatDate(appt.appointment_date, { weekday: 'long' })} at {formatTime(appt.appointment_time)}
        </p>
        {appt.reason && <p className="mt-1 line-clamp-2 text-[13px] text-ink-500">{appt.reason}</p>}
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <StatusBadge value={appt.status} />
        {action}
      </div>
    </li>
  )
}

export default function MyAppointments() {
  const { notify } = useToast()
  const { data, loading, error, reload, setData } = useAsync(
    () => Promise.all([appointmentsApi.listAll(), optional(doctorsApi.listAll())]), [])
  const [appointments, doctors] = data ?? [[], []]
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  const doctorById = useMemo(() => Object.fromEntries(doctors.map((d) => [d.doctor_id, d])), [doctors])
  const sorted = [...appointments].sort((a, b) =>
    `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`))
  const upcoming = sorted.filter((a) => ACTIVE.includes(a.status) && isUpcoming(a))
  const past = sorted.filter((a) => !upcoming.includes(a)).reverse()

  async function confirmCancel() {
    setCancelling(true)
    setCancelError(null)
    try {
      const updated = await appointmentsApi.cancel(cancelTarget.appointment_id)
      setData(([appts, docs]) => [appts.map((a) => (a.appointment_id === updated.appointment_id ? updated : a)), docs])
      setCancelTarget(null)
      notify('Appointment cancelled.')
    } catch (err) {
      setCancelError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <PageHeader
        title="My appointments"
        description="Bookings made from this account, plus any visits the clinic has scheduled for you."
        actions={<Button icon={RiCalendarScheduleLine} to="/patient/book-appointment">Book appointment</Button>}
      />
      {loading ? <Panel><LoadingState rows={3} /></Panel> : error ? (
        <Panel><ErrorState error={error} onRetry={reload} /></Panel>
      ) : (
        <div className="space-y-6">
          <Panel title="Upcoming">
            {upcoming.length ? (
              <ul className="divide-y divide-ink-100">
                {upcoming.map((a) => (
                  <AppointmentRow key={a.appointment_id} appt={a} doctor={doctorById[a.doctor_id]}
                    action={<Button size="sm" variant="secondary" onClick={() => { setCancelError(null); setCancelTarget(a) }}>Cancel</Button>} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={RiCalendarCheckLine} title="No upcoming appointments"
                description="When you book a visit it will appear here."
                action={<Button size="sm" to="/patient/book-appointment">Book appointment</Button>} />
            )}
          </Panel>
          {past.length > 0 && (
            <Panel title="Past and cancelled">
              <ul className="divide-y divide-ink-100">
                {past.map((a) => <AppointmentRow key={a.appointment_id} appt={a} doctor={doctorById[a.doctor_id]} />)}
              </ul>
            </Panel>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        title="Cancel this appointment?"
        message={cancelTarget ? `Your visit on ${formatDate(cancelTarget.appointment_date, { weekday: 'long' })} at ${formatTime(cancelTarget.appointment_time)} will be cancelled and the time released.` : ''}
        confirmLabel="Cancel appointment"
        danger
        loading={cancelling}
        error={cancelError}
      />
    </>
  )
}
