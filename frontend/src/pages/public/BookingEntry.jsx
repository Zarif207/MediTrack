/**
 * /appointments/book — public entry point for booking.
 * Signed-out visitors are asked to sign in; patients go straight to the
 * booking form; other accounts are told what applies to them.
 */
import { Navigate } from 'react-router'
import { useAuth } from '../../context/useAuth'
import Button from '../../components/ui/Button'
import { LoadingState } from '../../components/ui/States'
import { PublicPageHeader } from './PublicDoctors'

const BOOKING = '/patient/book-appointment'

export default function BookingEntry() {
  const { status, role } = useAuth()
  if (status === 'loading') return <LoadingState />
  if (status === 'ready' && role === 'patient') return <Navigate to={BOOKING} replace />

  let body
  if (status === 'ready' && role === 'user') {
    body = (
      <>
        <p>Your account is waiting for the clinic to give it patient access. Once that is done, you can book here straight away.</p>
        <div className="mt-6"><Button variant="secondary" to="/dashboard">Go to your account</Button></div>
      </>
    )
  } else if (status === 'ready') {
    body = (
      <>
        <p>You are signed in with a staff account. Patients book for themselves; staff schedule visits from the appointment schedule.</p>
        <div className="mt-6"><Button to="/appointments">Open the schedule</Button></div>
      </>
    )
  } else {
    body = (
      <>
        <p>Booking is done from your MediTrack account, so your appointment is saved privately and you can cancel it later.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button to="/auth/sign-in" state={{ from: BOOKING }}>Sign in to book</Button>
          <Button variant="secondary" to="/auth/sign-up" state={{ from: BOOKING }}>Create an account</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <PublicPageHeader eyebrow="Appointments" title="Book an appointment" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="max-w-xl text-[15px] leading-relaxed text-ink-700">{body}</div>
      </div>
    </>
  )
}
