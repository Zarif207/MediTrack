/** Simple surface card */
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
