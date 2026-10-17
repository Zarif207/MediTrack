import { RiFileList3Line } from 'react-icons/ri'
import { medicalRecordsApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import PageHeader from '../../components/ui/PageHeader'
import Panel from '../../components/ui/Panel'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States'
import { formatDate } from '../../utils/format'

function Section({ label, children }) {
  if (!children) return null
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">{children}</p>
    </div>
  )
}

export default function MyRecords() {
  const { data, loading, error, reload } = useAsync(() => medicalRecordsApi.listAll(), [])
  const records = [...(data ?? [])].sort((a, b) => b.record_date.localeCompare(a.record_date))

  return (
    <>
      <PageHeader
        title="Visit records"
        description="Notes your doctor recorded after each visit. Records appear once the clinic has added them."
      />
      {loading ? <Panel><LoadingState rows={3} /></Panel> : error ? (
        <Panel><ErrorState error={error} onRetry={reload} /></Panel>
      ) : !records.length ? (
        <Panel>
          <EmptyState icon={RiFileList3Line} title="No visit records yet"
            description="After a visit, your doctor's notes will be shown here." />
        </Panel>
      ) : (
        <ol className="space-y-4">
          {records.map((r) => (
            <li key={r.record_id}>
              <Panel title={formatDate(r.record_date, { weekday: 'long' })}
                description={`Record #${r.record_id} · appointment #${r.appointment_id}`}
                bodyClassName="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
                <Section label="Diagnosis">{r.diagnosis || 'Not recorded'}</Section>
                <Section label="Symptoms">{r.symptoms || 'Not recorded'}</Section>
                <Section label="Treatment notes">{r.treatment_notes || 'Not recorded'}</Section>
              </Panel>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
