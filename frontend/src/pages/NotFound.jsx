import Brand from '../components/Brand'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-paper px-4">
      <div className="py-5"><Brand /></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-24">
        <p className="font-mono text-sm text-ink-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold">This page doesn’t exist</h1>
        <p className="mt-2 text-sm text-ink-600">The link may be out of date, or the address mistyped.</p>
        <div className="mt-6 flex gap-2">
          <Button to="/">Go to the home page</Button>
          <Button variant="secondary" to="/dashboard">Open MediTrack</Button>
        </div>
      </div>
    </div>
  )
}
