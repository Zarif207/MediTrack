/**
 * Patient self-booking page — /patient/book-appointment
 *
 * Any user with the 'patient' role can book immediately.
 * No patient_id / admin linking required.
 * The backend auto-creates a minimal patient record on first booking.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/useAuth'
import { doctorsApi, departmentsApi } from '../services/api'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import ErrorAlert from '../components/ui/ErrorAlert'
import {
  RiCalendarCheckLine, RiUserStarLine, RiBuildingLine,
  RiArrowLeftLine, RiCheckLine,
} from 'react-icons/ri'

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function bookAppointment(token, body) {
  const res = await fetch(`${BASE}/appointments/book`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = Array.isArray(data?.detail)
      ? data.detail.map((e) => `${e.loc?.slice(1).join('.')}: ${e.msg}`).join('\n')
      : data?.detail ?? `HTTP ${res.status}`
    throw new Error(msg)
  }
  return await res.json()
}

export default function PatientBooking() {
  const { getIdToken } = useAuth()

  const [doctors, setDoctors]         = useState([])
  const [depts, setDepts]             = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError]     = useState(null)

  const [selectedDept, setSelectedDept] = useState('')
  const [doctorId, setDoctorId]         = useState('')
  const [date, setDate]                 = useState('')
  const [time, setTime]                 = useState('')
  const [reason, setReason]             = useState('')
  const [errors, setErrors]             = useState({})
  const [saving, setSaving]             = useState(false)
  const [submitError, setSubmitError]   = useState(null)
  const [success, setSuccess]           = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [drs, ds] = await Promise.all([
          doctorsApi.list({ limit: 100 }),
          departmentsApi.list({ limit: 100 }),
        ])
        setDoctors(drs)
        setDepts(ds)
      } catch (e) {
        setDataError(e.message)
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [])

  const deptMap = Object.fromEntries(depts.map((d) => [d.department_id, d.department_name]))
  const filteredDoctors = selectedDept
    ? doctors.filter((d) => String(d.department_id) === selectedDept)
    : doctors

  function validate() {
    const e = {}
    if (!doctorId) e.doctorId = 'Please select a doctor'
    if (!date) {
      e.date = 'Please select a date'
    } else if (new Date(date) < new Date(new Date().toDateString())) {
      e.date = 'Date cannot be in the past'
    }
    if (!time) e.time = 'Please select a time'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSubmitError(null)
    setSaving(true)
    try {
      const token = await getIdToken()
      if (!token) throw new Error('Not authenticated. Please sign in again.')
      const result = await bookAppointment(token, {
        doctor_id: Number(doctorId),
        appointment_date: date,
        appointment_time: time,
        reason: reason.trim() || null,
      })
      setSuccess(result)
    } catch (e) {
      setSubmitError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <RiCheckLine size={36} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
        <p className="text-gray-500 mb-1">Your appointment has been scheduled.</p>
        <p className="text-sm text-gray-400 mb-6">
          ID #{success.appointment_id} · {success.appointment_date} · Status: {success.status}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/appointments">
            <Button>View My Appointments</Button>
          </Link>
          <Button variant="outline" onClick={() => {
            setSuccess(null)
            setDoctorId('')
            setDate('')
            setTime('')
            setReason('')
            setErrors({})
          }}>
            Book Another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <RiArrowLeftLine size={14} /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-500 flex items-center justify-center">
            <RiCalendarCheckLine size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Book an Appointment</h1>
            <p className="text-sm text-gray-500">Schedule a visit with one of our doctors</p>
          </div>
        </div>
      </div>

      {dataError && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          Could not load doctors and departments. Make sure the backend is running.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
        {submitError && <ErrorAlert message={submitError} onDismiss={() => setSubmitError(null)} />}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Department filter */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              <RiBuildingLine size={14} className="inline mr-1.5 mb-0.5" />
              Filter by Department (optional)
            </label>
            <select
              value={selectedDept}
              onChange={(e) => { setSelectedDept(e.target.value); setDoctorId('') }}
              className="w-full rounded-lg border px-3 py-2 text-sm border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 bg-white"
              disabled={loadingData}
            >
              <option value="">All departments</option>
              {depts.map((d) => (
                <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
              ))}
            </select>
          </div>

          {/* Doctor selection */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              <RiUserStarLine size={14} className="inline mr-1.5 mb-0.5" />
              Select Doctor <span className="text-red-500">*</span>
            </label>
            <select
              value={doctorId}
              onChange={(e) => { setDoctorId(e.target.value); setErrors((prev) => ({ ...prev, doctorId: '' })) }}
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-navy-200 ${errors.doctorId ? 'border-red-400' : 'border-gray-300 focus:border-navy-500'}`}
              disabled={loadingData}
            >
              <option value="">Choose a doctor…</option>
              {filteredDoctors.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>
                  Dr. {d.first_name} {d.last_name} — {d.specialization}
                  {deptMap[d.department_id] ? ` (${deptMap[d.department_id]})` : ''}
                </option>
              ))}
            </select>
            {errors.doctorId && <p className="text-xs text-red-600">{errors.doctorId}</p>}
            {filteredDoctors.length === 0 && !loadingData && (
              <p className="text-xs text-gray-400">No doctors found for the selected department.</p>
            )}
          </div>

          {/* Date and Time */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Appointment Date"
              type="date"
              required
              value={date}
              onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })) }}
              error={errors.date}
              min={new Date().toISOString().split('T')[0]}
            />
            <Input
              label="Preferred Time"
              type="time"
              required
              value={time}
              onChange={(e) => { setTime(e.target.value); setErrors((p) => ({ ...p, time: '' })) }}
              error={errors.time}
            />
          </div>

          {/* Reason */}
          <Input
            label="Reason for Visit"
            type="textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe the reason for your visit (optional)"
          />

          <Button
            type="submit"
            loading={saving}
            disabled={saving}
            className="w-full justify-center py-3"
            size="lg"
          >
            Confirm Appointment
          </Button>
        </form>
      </div>
    </div>
  )
}
