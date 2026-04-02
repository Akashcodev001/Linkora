import { useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import { Marquee } from '@/components/ui/marquee'

const toText = (value, fallback = '') => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    return String(value.name || value.label || value.title || value.text || value._id || fallback)
  }
  return fallback
}

function FloatingTaskCard({ item, onOpen, onDismiss, isDismissing }) {
  const itemId = item?.id || item?._id

  return (
    <div
      className="group relative w-[240px] shrink-0 rounded-2xl border border-border/70 bg-bg-surface/95 p-3 text-left shadow-subtle backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-focus/40 hover:shadow-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(itemId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(itemId)
        }
      }}
    >
      <button
        type="button"
        className="focus-ring absolute right-2 top-2 rounded-full p-1 text-text-muted opacity-0 transition hover:bg-bg-hover group-hover:opacity-100"
        aria-label="Dismiss resurfacing item"
        onClick={async (event) => {
          event.stopPropagation()
          await onDismiss(itemId)
        }}
        disabled={isDismissing}
      >
        <X size={12} />
      </button>

      <p className="line-clamp-2 pr-5 text-sm font-medium text-text-primary">{toText(item?.title, 'Untitled item')}</p>
      <p className="mt-2 text-xs text-text-muted">Saved earlier • revisit now</p>
    </div>
  )
}

export function ResurfacingWidget({ items = [], isLoading, onDismiss, dismissingId, onOpen }) {
  const [hiddenIds, setHiddenIds] = useState([])

  const visibleItems = items.filter((item) => !hiddenIds.includes(item?.id || item?._id)).slice(0, 5)
  const marqueeItems =
    visibleItems.length <= 2 ? [...visibleItems, ...visibleItems, ...visibleItems] : [...visibleItems, ...visibleItems]
  const firstRow = marqueeItems.filter((_, index) => index % 2 === 0)
  const secondRow = marqueeItems.filter((_, index) => index % 2 !== 0)

  if (isLoading) {
    return (
        <Card className="rounded-2xl border-brand/20 bg-brand-light/50" padding="comfortable">
        <Skeleton className="mb-3 h-4 w-44" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    )
  }

  if (!visibleItems.length) {
    return null
  }

  return (
    <Card className="rounded-2xl border-brand/20 bg-brand-light/50" padding="comfortable">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
          <Lightbulb size={16} />
          From your memory
        </h2>
      </div>

      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Marquee pauseOnHover className="[--duration:30s] [--gap:0.75rem] p-0">
            {firstRow.map((item, index) => {
              const itemId = item?.id || item?._id
              const isDismissing = dismissingId === itemId
              return (
                <FloatingTaskCard
                  key={`${String(itemId)}-${index}-a`}
                  item={item}
                  isDismissing={isDismissing}
                  onOpen={onOpen}
                  onDismiss={async (id) => {
                    await onDismiss(id)
                    setHiddenIds((prev) => [...prev, id])
                  }}
                />
              )
            })}
          </Marquee>
          <Marquee reverse pauseOnHover className="[--duration:34s] [--gap:0.75rem] p-0">
            {secondRow.map((item, index) => {
              const itemId = item?.id || item?._id
              const isDismissing = dismissingId === itemId
              return (
                <FloatingTaskCard
                  key={`${String(itemId)}-${index}-b`}
                  item={item}
                  isDismissing={isDismissing}
                  onOpen={onOpen}
                  onDismiss={async (id) => {
                    await onDismiss(id)
                    setHiddenIds((prev) => [...prev, id])
                  }}
                />
              )
            })}
          </Marquee>
        </div>
      </div>
    </Card>
  )
}

export default ResurfacingWidget
