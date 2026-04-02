import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

const sizeClasses = {
  sm: 'h-9',
  md: 'h-10',
}

export const Input = forwardRef(function Input(
  {
    className,
    size = 'md',
    error,
    leftIcon,
    rightSlot,
    wrapperClassName,
    type = 'text',
    ...props
  },
  ref,
) {
  return (
    <div className={cn('w-full', wrapperClassName)}>
      <div
        className={cn(
          'focus-within:ring-brand relative flex items-center rounded-default border bg-bg-surface px-3 shadow-subtle transition-all duration-200 ease-out focus-within:ring-2 focus-within:ring-offset-1',
          error ? 'border-state-error' : 'border-border hover:border-border-focus/40',
          sizeClasses[size],
        )}
      >
        {leftIcon ? <span className="mr-2 text-text-muted">{leftIcon}</span> : null}
        <input
          ref={ref}
          type={type}
          className={cn(
            'h-full w-full border-none bg-transparent p-0 text-sm text-text-primary placeholder:text-text-muted focus:outline-none',
            className,
          )}
          {...props}
        />
        {rightSlot ? <span className="ml-2 text-text-secondary">{rightSlot}</span> : null}
      </div>
      {error ? <p className="mt-1 text-xs text-state-error">{error}</p> : null}
    </div>
  )
})

export default Input
