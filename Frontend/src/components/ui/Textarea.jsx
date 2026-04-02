import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const Textarea = forwardRef(function Textarea({ className, error, rows = 4, ...props }, ref) {
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'focus-ring min-h-[120px] w-full resize-y rounded-default border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted shadow-subtle transition-all duration-200 ease-out',
          error ? 'border-state-error' : 'border-border hover:border-border-focus/40',
          className,
        )}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-state-error">{error}</p> : null}
    </div>
  )
})

export default Textarea
