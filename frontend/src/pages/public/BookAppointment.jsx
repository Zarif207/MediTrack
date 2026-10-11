import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { appointmentsApi, patientsApi, doctorsApi } from '../../services/api'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import ErrorAlert from '../../components/ui/ErrorAlert'
import { RiCalendarCheckLine, RiCheckLine } from 'react-icons/ri'

const STATUSES = ['scheduled', 'confirmed']

export default function BookAppointment() {
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [apiAvailable, setApiAvailable] = useState(true)
  const [form, setForm] = useState({
    patient_id: '', doctor_id: '', appointment_date: '',
    appointment_time: '', status: 'scheduled', reason: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    Promise.all([patientsApi.list({ limit: 100 }), doctorsApi.list({ limit: 100 })])
      .then(([pts, drs]) => { setPatients(pts); setDoctors(drs) })
      .catch(() => setApiAvailable(false))
  }, [])

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  function validate() {
    const e = {}
    if (!form.patient_id) e.patient_id = 'Please select a patient'
    if (!form.doctor_id) e.doctor_id = 'Please select a doctor'
    if (!form.appointment_date) e.appointment_date = 'Date is required'
    if (!form.appointment_time) e.appointment_time = 'Time is required'
    setErrors(e); return !Object.keys(e).length
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    try {
      setLoading(true); setSubmitError(null)
      await appointmentsApi.create({
        patient_id: Number(form.patient_id),
        doctor_id: Number(form.doctor_id),
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time + ':00',
        status: form.status,
        reason: form.reason || null,
      })
      setSuccess(true)
    } catch (e) {
      setSubmitError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="pt-24 min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <RiCheckLine size={36} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
          <p className="text-gray-500 mb-6">Your appointment has been successfully scheduled in the system.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => { setSuccess(false); setForm({ patient_id: '', doctor_id: '', appointment_date: '', appointment_time: '', status: 'scheduled', reason: '' }) }}>
              Book Another
            </Button>
            <Link to="/appointments">
              <Button variant="outline">View Appointments</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 min-h-screen pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-100 mb-4">
            <RiCalendarCheckLine size={26} className="text-teal-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Book an Appointment</h1>
          <p className="text-gray-500 mt-2">Fill in the details below. Patient and doctor lists are loaded from the database.</p>
        </div>

        {!apiAvailable ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <p className="text-amber-800 font-medium mb-2">Backend not available</p>
            <p className="text-amber-700 text-sm">The FastAPI backend must be running to book appointments.</p>
            <Link to="/dashboard" className="mt-4 inline-block text-sm text-teal-600 hover:underline">
              Go to Staff Dashboard
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            {submitError && <div className="mb-4"><ErrorAlert message={submitError} onDismiss={() => setSubmitError(null)} /></div>}
            <form onSubmit={handleSubmit} className="space-y-5">
              <Select label="Patient" required value={form.patient_id} onChange={(e) => set('patient_id', e.target.value)} error={errors.patient_id}>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.first_name} {p.last_name}</option>)}
              </Select>
              {patients.length === 0 && (
                <p className="text-xs text-amber-600 -mt-3">No patients found. <Link to="/patients" className="underline">Add a patient</Link> first.</p>
              )}

              <Select label="Doctor" required value={form.doctor_id} onChange={(e) => set('doctor_id', e.target.value)} error={errors.doctor_id}>
                <option value="">Select doctor…</option>
                {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} — {d.specialization}</option>)}
              </Select>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Appointment Date" type="date" required value={form.appointment_date} onChange={(e) => set('appointment_date', e.target.value)} error={errors.appointment_date} />
                <Input label="Appointment Time" type="time" required value={form.appointment_time} onChange={(e) => set('appointment_time', e.target.value)} error={errors.appointment_time} />
              </div>

              <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>

              <Input label="Reason for Visit" type="textarea" value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Briefly describe the reason for this appointment…" />

              <Button type="submit" loading={loading} className="w-full justify-center py-3" size="lg">
                Confirm Appointment
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
