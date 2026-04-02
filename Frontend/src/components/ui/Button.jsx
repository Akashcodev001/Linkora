import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import Spinner from '@/components/ui/Spinner'

const variantClasses = {
  primary:
    'bg-brand text-white border border-brand hover:bg-brand-dark active:scale-[0.98] focus-visible:ring-brand disabled:bg-brand/70',
  secondary:
    'bg-bg-surface text-text-secondary border border-border hover:bg-bg-hover active:scale-[0.98] focus-visible:ring-brand',
  ghost:
    'bg-transparent text-text-secondary border border-transparent hover:bg-bg-hover active:scale-[0.98] focus-visible:ring-brand',
  danger:
    'bg-state-error text-white border border-state-error hover:opacity-90 active:scale-[0.98] focus-visible:ring-state-error',
}

const sizeClasses = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
}

export const Button = forwardRef(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    leftIcon,
    rightIcon,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'focus-ring inline-flex items-center justify-center gap-2 rounded-default font-medium leading-none shadow-subtle transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading ? <Spinner size={14} className="text-current" /> : leftIcon ? leftIcon : null}
      <span className={cn(loading && 'opacity-90')}>{children}</span>
      {!loading && rightIcon ? rightIcon : null}
    </button>
  )
})

export default Button
