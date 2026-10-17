import Brand from './Brand'
import Spinner from './ui/Spinner'

export function FullPageLoader({ label = 'Loading' }) {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper text-sm text-ink-500">
      <Spinner size="lg" className="text-pine-600" />
      {label}
    </div>
  )
}

export function FullPageMessage({ title, body, actions }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper px-4">
      <div className="py-5"><Brand /></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-24">
        <h1 className="text-xl font-semibold">{title}</h1>
        {body && <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>}
        {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
