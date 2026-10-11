import { RiAlertLine, RiCloseLine } from 'react-icons/ri'

export default function ErrorAlert({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
      <RiAlertLine className="shrink-0 mt-0.5" size={18} />
      <p className="text-sm flex-1 whitespace-pre-line">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-red-400 hover:text-red-600">
          <RiCloseLine size={18} />
        </button>
      )}
    </div>
  )
}

export function ConnectionError() {
  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
      <RiAlertLine className="shrink-0 mt-0.5" size={18} />
      <div className="text-sm">
        <p className="font-medium">Backend not reachable</p>
        <p className="text-amber-700 mt-0.5">
          Make sure the FastAPI server is running at{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">http://127.0.0.1:8000</code>.
          Run: <code className="font-mono bg-amber-100 px-1 rounded">uvicorn app.main:app --reload</code>
        </p>
      </div>
    </div>
  )
}
