import Button from './Button'
import { RiArrowLeftLine, RiArrowRightLine } from 'react-icons/ri'

export default function Pagination({ skip, limit, total, onPageChange }) {
  const page = Math.floor(skip / limit)
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white rounded-b-xl">
      <p className="text-sm text-gray-500">
        Showing {skip + 1}–{Math.min(skip + limit, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange((page - 1) * limit)}
          icon={<RiArrowLeftLine size={14} />}
        >
          Prev
        </Button>
        <span className="text-sm text-gray-600 px-2">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange((page + 1) * limit)}
          icon={<RiArrowRightLine size={14} />}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
