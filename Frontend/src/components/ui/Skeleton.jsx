import { cn } from '@/lib/cn'

const variantClasses = {
  rect: 'rounded-default',
  text: 'h-4 rounded-sm',
  circle: 'rounded-full',
}

export function Skeleton({ className, variant = 'rect' }) {
  return <div className={cn('skeleton-shimmer w-full', variantClasses[variant], className)} aria-hidden />
}

export default Skeleton
