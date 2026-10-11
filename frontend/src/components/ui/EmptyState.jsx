import { RiSearchLine } from 'react-icons/ri'

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
        {icon ?? <RiSearchLine size={28} />}
      </div>
      <div>
        <p className="font-semibold text-gray-700">{title ?? 'No results found'}</p>
        {description && <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
