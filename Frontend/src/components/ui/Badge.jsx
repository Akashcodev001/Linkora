import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

const variantClasses = {
  default: 'border border-border bg-bg-muted text-text-secondary',
  brand: 'bg-brand-light text-brand-dark',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
}

const sizeClasses = {
  sm: 'h-5 text-[10px] px-2',
  default: 'h-6 text-[11px] px-2.5',
  lg: 'h-7 text-[12px] px-3',
}

const dotColors = {
  default: 'bg-slate-500',
  brand: 'bg-brand',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
}

export function Badge({
  className,
  variant = 'default',
  size = 'default',
  showDot = false,
  removable = false,
  onRemove,
  children,
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium leading-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {showDot ? <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} aria-hidden /> : null}
      <span>{children}</span>
      {removable ? (
        <button
          type="button"
          className="rounded-full p-0.5 transition-colors hover:bg-bg-hover"
          onClick={onRemove}
          aria-label="Remove badge"
        >
          <X size={12} strokeWidth={1.8} />
        </button>
      ) : null}
    </span>
  )
}

export default Badge
