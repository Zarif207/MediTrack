import { RiCapsuleLine } from 'react-icons/ri'
import { prescriptionItemsApi, prescriptionsApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import PageHeader from '../../components/ui/PageHeader'
import Panel from '../../components/ui/Panel'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States'
import { formatDate } from '../../utils/format'

export default function MyPrescriptions() {
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([prescriptionsApi.listAll(), prescriptionItemsApi.listAll()]), [])
  const [prescriptions, items] = data ?? [[], []]
  const sorted = [...prescriptions].sort((a, b) => b.prescription_date.localeCompare(a.prescription_date))
  const itemsFor = (id) => items.filter((i) => i.prescription_id === id)

  return (
    <>
      <PageHeader
        title="Prescriptions"
        description="Medicines your doctor has prescribed, with dosage and duration."
      />
      {loading ? <Panel><LoadingState rows={3} /></Panel> : error ? (
        <Panel><ErrorState error={error} onRetry={reload} /></Panel>
      ) : !sorted.length ? (
        <Panel>
          <EmptyState icon={RiCapsuleLine} title="No prescriptions yet"
            description="Prescriptions written for you will be listed here." />
        </Panel>
      ) : (
        <ol className="space-y-4">
          {sorted.map((p) => {
            const lines = itemsFor(p.prescription_id)
            return (
              <li key={p.prescription_id}>
                <Panel title={`Prescribed ${formatDate(p.prescription_date)}`} description={`Prescription #${p.prescription_id}`}>
                  {p.instructions && (
                    <p className="border-b border-ink-100 px-4 py-3 text-sm text-ink-700 sm:px-5">
                      <span className="eyebrow mr-2">Instructions</span>{p.instructions}
                    </p>
                  )}
                  {lines.length ? (
                    <ul className="divide-y divide-ink-100">
                      {lines.map((i) => (
                        <li key={i.prescription_item_id} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:px-5">
                          <div>
                            <p className="text-sm font-medium">
                              {i.medicine_name ?? `Medicine #${i.medicine_id}`}
                              {i.medicine_strength && <span className="font-normal text-ink-500"> {i.medicine_strength}</span>}
                            </p>
                            <p className="text-[13px] text-ink-600">{i.dosage} · {i.frequency} · {i.duration}</p>
                          </div>
                          <p className="text-[13px] text-ink-500 sm:text-right">Qty {i.quantity}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-ink-500 sm:px-5">No medicines listed on this prescription.</p>
                  )}
                </Panel>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
