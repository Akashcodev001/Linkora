import { cn } from '@/lib/cn'

const paddingClasses = {
  default: 'p-4',
  comfortable: 'p-5',
  spacious: 'p-6',
}

export function Card({ className, children, padding = 'default', hover = false, clickable = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-default border border-[#d8e1ec] bg-[#ffffff] shadow-[0_8px_22px_rgba(15,23,42,0.07)] transition-all duration-200 ease-out dark:border-[color:var(--border-default)] dark:bg-[color:var(--bg-surface)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.32)]',
        paddingClasses[padding],
        hover && 'hover:-translate-y-0.5 hover:border-[#c8d4e3] hover:shadow-[0_16px_32px_rgba(15,23,42,0.10)] dark:hover:border-[color:var(--border-focus)]/35 dark:hover:shadow-[0_14px_30px_rgba(0,0,0,0.38)]',
        clickable && 'cursor-pointer active:scale-[0.99]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card
