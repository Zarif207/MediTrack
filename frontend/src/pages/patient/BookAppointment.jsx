/**
 * Patient self-booking — /patient/book-appointment
 *
 * No patient-record linking is needed: the server stores the booking against
 * the signed-in account. Slots come from GET /doctors/{id}/availability, which
 * returns times only.
 */
import { useEffect, useMemo, useState } from 'react'
import { RiCheckLine, RiStethoscopeLine } from 'react-icons/ri'
import { appointmentsApi, departmentsApi, doctorsApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import PageHeader from '../../components/ui/PageHeader'
import Panel from '../../components/ui/Panel'
import Button from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/ui/States'
import DetailList from '../../components/ui/DetailList'
import { doctorName, formatDate, formatTime, sentenceCase, todayISO } from '../../utils/format'

const MAX_DAYS_AHEAD = 180
const REASON_MAX = 1000

function StepLabel({ n, children }) {
  return (
    <h2 className="flex items-center gap-2.5 text-sm font-semibold">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">{n}</span>
      {children}
    </h2>
  )
}

function SlotGrid({ doctorId, date, value, onChange, refreshKey }) {
  const { data, loading, error, reload } = useAsync(
    () => (doctorId && date ? doctorsApi.availability(doctorId, date) : Promise.resolve(null)),
    [doctorId, date, refreshKey],
  )
  if (!doctorId || !date) return <p className="text-sm text-ink-500">Choose a doctor and date to see open times.</p>
  if (loading) return <LoadingState label="Checking open times" />
  if (error) return <ErrorState error={error} onRetry={reload} title="Open times could not be loaded" />

  const available = new Set(data.available)
  const all = [...data.available, ...data.unavailable].sort()
  if (!data.available.length) {
    return <p className="rounded-md bg-ink-50 px-3 py-3 text-sm text-ink-600">No open times on this date. Try another day.</p>
  }
  return (
    <div role="radiogroup" aria-label="Available times" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {all.map((slot) => {
        const free = available.has(slot)
        const selected = value === slot
        return (
          <button
            key={slot}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!free}
            onClick={() => onChange(slot)}
            className={`h-9 rounded-md border text-[13px] tabular-nums transition-colors ${
              selected
                ? 'border-pine-700 bg-pine-700 font-medium text-white'
                : free
                  ? 'border-ink-200 bg-surface text-ink-800 hover:border-pine-400 hover:bg-pine-50'
                  : 'cursor-not-allowed border-transparent bg-ink-50 text-ink-300 line-through'
            }`}
          >
            {formatTime(slot)}
          </button>
        )
      })}
    </div>
  )
}

export default function BookAppointment() {
  const lookups = useAsync(() => Promise.all([doctorsApi.listAll(), departmentsApi.listAll()]), [])
  const [doctors, departments] = lookups.data ?? [[], []]

  const [dept, setDept] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [booked, setBooked] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const deptName = useMemo(() => Object.fromEntries(departments.map((d) => [d.department_id, d.department_name])), [departments])
  const shownDoctors = dept ? doctors.filter((d) => String(d.department_id) === dept) : doctors
  const doctor = doctors.find((d) => String(d.doctor_id) === doctorId)

  useEffect(() => { setSlot('') }, [doctorId, date])

  async function submit(e) {
    e.preventDefault()
    if (!doctorId || !date || !slot || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const appt = await appointmentsApi.book({
        doctor_id: Number(doctorId),
        appointment_date: date,
        appointment_time: slot.slice(0, 5),
        reason: reason.trim() || null,
      })
      setBooked(appt)
    } catch (err) {
      setError(err)
      if (err.status === 409) { setSlot(''); setRefreshKey((k) => k + 1) }
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setBooked(null); setDoctorId(''); setDate(''); setSlot(''); setReason(''); setError(null)
  }

  if (booked) {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-pine-50 text-pine-700">
          <RiCheckLine aria-hidden size={22} />
        </div>
        <h1 className="text-xl font-semibold">Your appointment is booked</h1>
        <p className="mt-1 text-sm text-ink-600">It is saved to your account and listed under My appointments.</p>
        <Panel className="mt-6" bodyClassName="px-5 py-2">
          <DetailList items={[
            ['Doctor', doctor ? `${doctorName(doctor)} · ${doctor.specialization}` : `#${booked.doctor_id}`],
            ['Date', formatDate(booked.appointment_date, { weekday: 'long' })],
            ['Time', formatTime(booked.appointment_time)],
            ['Reason', booked.reason],
            ['Reference', <span className="font-mono text-[13px]">#{booked.appointment_id}</span>],
          ]} />
        </Panel>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button to="/appointments">View my appointments</Button>
          <Button variant="secondary" onClick={reset}>Book another</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Book an appointment"
        description="Pick a doctor, a day and an open time. You can cancel from My appointments before the visit."
      />

      {lookups.loading ? <LoadingState /> : lookups.error ? (
        <ErrorState error={lookups.error} onRetry={lookups.reload} title="Doctors could not be loaded" />
      ) : !doctors.length ? (
        <Panel><EmptyState icon={RiStethoscopeLine} title="No doctors are available for booking yet" /></Panel>
      ) : (
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <Panel bodyClassName="space-y-4 p-4 sm:p-5">
              <StepLabel n={1}>Choose a doctor</StepLabel>
              <Select label="Department" value={dept} onChange={(e) => { setDept(e.target.value); setDoctorId('') }}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </Select>
              <fieldset>
                <legend className="sr-only">Doctor</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {shownDoctors.map((d) => {
                    const checked = doctorId === String(d.doctor_id)
                    return (
                      <label key={d.doctor_id}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                          checked ? 'border-pine-600 bg-pine-50' : 'border-ink-200 hover:border-ink-300'}`}>
                        <input type="radio" name="doctor" value={d.doctor_id} checked={checked}
                          onChange={(e) => setDoctorId(e.target.value)} className="mt-1 accent-pine-700" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink-900">{doctorName(d)}</span>
                          <span className="block truncate text-xs text-ink-500">
                            {sentenceCase(d.specialization)}
                            {deptName[d.department_id] && deptName[d.department_id].toLowerCase() !== d.specialization.toLowerCase()
                              ? ` · ${deptName[d.department_id]}` : ''}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {!shownDoctors.length && <p className="text-sm text-ink-500">No doctors in this department.</p>}
              </fieldset>
            </Panel>

            <Panel bodyClassName="space-y-4 p-4 sm:p-5">
              <StepLabel n={2}>Pick a date and time</StepLabel>
              <Input label="Date" type="date" required value={date} min={todayISO()} max={todayISO(MAX_DAYS_AHEAD)}
                onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
              <SlotGrid doctorId={doctorId} date={date} value={slot} onChange={setSlot} refreshKey={refreshKey} />
            </Panel>

            <Panel bodyClassName="space-y-4 p-4 sm:p-5">
              <StepLabel n={3}>Reason for the visit</StepLabel>
              <Textarea label="What would you like to discuss?" value={reason} maxLength={REASON_MAX}
                onChange={(e) => setReason(e.target.value)}
                hint={`Optional. Shared with the clinic only. ${reason.length}/${REASON_MAX}`} />
            </Panel>
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Panel title="Summary" bodyClassName="space-y-4 p-4">
              <DetailList items={[
                ['Doctor', doctor ? doctorName(doctor) : null],
                ['Date', date ? formatDate(date, { weekday: 'short' }) : null],
                ['Time', slot ? formatTime(slot) : null],
              ]} />
              {error && <Alert>{error.message}</Alert>}
              <Button type="submit" className="w-full" size="lg" loading={submitting} disabled={!doctorId || !date || !slot}>
                Confirm booking
              </Button>
            </Panel>
          </aside>
        </form>
      )}
    </>
  )
}
