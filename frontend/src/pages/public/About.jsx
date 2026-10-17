import { PublicPageHeader } from './PublicDoctors'

const ENTITIES = [
  ['Departments', 'Clinical departments; each doctor belongs to one.'],
  ['Doctors', 'Clinicians with specialization, contact and licence details.'],
  ['Patients', 'Clinical patient files, created and maintained by staff.'],
  ['Appointments', 'Visits between a doctor and either a patient file or a patient account.'],
  ['Medical records', 'One record per appointment: diagnosis, symptoms, treatment notes.'],
  ['Prescriptions', 'Issued against a medical record.'],
  ['Prescription items', 'Each medicine on a prescription with dosage and quantity.'],
  ['Medicines', 'Formulary with pricing and stock.'],
  ['Bills', 'One bill per appointment, with payment status.'],
  ['User profiles', 'Maps each sign-in account to a role and, optionally, a patient file.'],
]

export default function About() {
  return (
    <>
      <PublicPageHeader eyebrow="About" title="About MediTrack">
        MediTrack is a hospital appointment and patient record system built as a university database
        management systems project. It is a demonstration, not a real healthcare provider — do not use it for
        medical care, and do not enter real patient information.
      </PublicPageHeader>
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <section>
          <h2 className="text-base font-semibold">How it is built</h2>
          <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-ink-700">
            <p>A React interface talks to a FastAPI service backed by PostgreSQL. Sign-in is handled by Firebase Authentication; the API verifies every request’s ID token before it reads or writes data.</p>
            <p>Access is role-based. Patients can only reach their own appointments, records, prescriptions and bills. Staff roles — reception, doctors, pharmacists, accountants and administrators — each see only what their work requires.</p>
          </div>
        </section>
        <section>
          <h2 className="text-base font-semibold">Data model</h2>
          <dl className="mt-3 divide-y divide-ink-100 border-y border-ink-100">
            {ENTITIES.map(([name, desc]) => (
              <div key={name} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr]">
                <dt className="text-sm font-medium">{name}</dt>
                <dd className="text-[13.5px] text-ink-600">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  )
}
