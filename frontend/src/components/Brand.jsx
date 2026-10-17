import { Link } from 'react-router'

export function BrandMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-pine-700" />
      <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" className="fill-paper" />
      <path d="M19 19h6v6h-6z" className="fill-pine-300" />
    </svg>
  )
}

export default function Brand({ to = '/', tone = 'dark' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="MediTrack home">
      <BrandMark />
      <span className={`text-[15px] font-semibold tracking-[-0.01em] ${tone === 'light' ? 'text-white' : 'text-ink-900'}`}>
        MediTrack
      </span>
    </Link>
  )
}
