import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className, size = 16, ariaLabel = 'Loading' }) {
  return (
    <LoaderCircle
      className={cn('animate-spin text-current', className)}
      size={size}
      strokeWidth={1.8}
      aria-label={ariaLabel}
    />
  )
}

export default Spinner
