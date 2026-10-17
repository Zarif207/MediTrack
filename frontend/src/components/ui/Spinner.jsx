export default function Spinner({ size = 'md', className = '' }) {
  const s = { sm: 'h-3.5 w-3.5 border-2', md: 'h-5 w-5 border-2', lg: 'h-7 w-7 border-[3px]' }
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-current border-r-transparent opacity-70 ${s[size]} ${className}`}
    />
  )
}
