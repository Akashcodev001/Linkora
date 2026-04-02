import { cn } from '@/lib/cn'
import Button from '@/components/ui/Button'

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCtaClick, className }) {
  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center rounded-default border border-dashed border-border bg-bg-surface p-8 text-center', className)}>
      {Icon ? <Icon size={42} className="mb-4 text-slate-300" strokeWidth={1.5} /> : null}
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
      {ctaLabel ? (
        <Button className="mt-5" onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  )
}

export default EmptyState
