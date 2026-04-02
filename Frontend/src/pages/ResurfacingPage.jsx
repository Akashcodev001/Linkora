import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDismissItemMutation, useGetResurfacingQuery } from '@/app/api/resurfacingApi'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Skeleton from '@/components/ui/Skeleton'
import { Marquee } from '@/components/ui/marquee'
import { Sparkles } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import toast from 'react-hot-toast'

dayjs.extend(relativeTime)

const dayOptions = [1, 7, 14, 30, 60]

const asList = (value, keys = ['items', 'data']) => {
  if (Array.isArray(value)) {
    return value
  }

  for (const key of keys) {
    if (Array.isArray(value?.[key])) {
      return value[key]
    }
  }

  return []
}

const normalizePayload = (response) => response?.data || response || {}
const ResurfacingThreeBackground = lazy(() => import('@/components/background/ResurfacingThreeBackground'))

function ResurfacingPreviewCard({ item, onOpen }) {
  const itemId = String(item?.id || item?._id)
  return (
    <button
      type="button"
      onClick={() => onOpen(itemId)}
      className="w-[280px] shrink-0 rounded-2xl border border-border/70 bg-bg-surface/95 p-4 text-left shadow-subtle backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-focus/40 hover:shadow-card"
    >
      <p className="line-clamp-2 text-sm font-semibold text-text-primary">{item?.title || 'Untitled item'}</p>
      <p className="mt-2 line-clamp-2 text-xs text-text-secondary">{item?.summary || item?.description || 'No summary available yet.'}</p>
    </button>
  )
}

export function ResurfacingPage() {
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [dismissingId, setDismissingId] = useState(null)

  const {
    data: rawData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetResurfacingQuery({ days })

  const payload = normalizePayload(rawData)
  const items = asList(payload)
  const [dismissItem] = useDismissItemMutation()

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aDate = new Date(a?.updatedAt || a?.createdAt || 0).getTime()
      const bDate = new Date(b?.updatedAt || b?.createdAt || 0).getTime()
      return aDate - bDate
    })
  }, [items])

  const handleDismiss = async (itemId) => {
    setDismissingId(itemId)
    try {
      await dismissItem(itemId).unwrap()
      toast.success('Resurfacing item dismissed')
      refetch()
    } catch {
      toast.error('Could not dismiss item')
    } finally {
      setDismissingId(null)
    }
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[1.75rem] px-1 py-1">
      <div className="pointer-events-none absolute inset-x-0 -bottom-20 -top-24 -z-10">
        <Suspense fallback={null}>
          <ResurfacingThreeBackground />
        </Suspense>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,transparent_20%,var(--bg-base)_85%)]" />
      </div>

      <div className="relative z-10 space-y-5">
      <Card padding="comfortable" className="space-y-3 rounded-2xl border-border/80 bg-bg-surface/88 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Resurfacing</h1>
            <p className="text-sm text-text-secondary">Revisit old but valuable knowledge before it fades.</p>
          </div>
          <div className="flex items-center gap-2">
            {dayOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`focus-ring rounded-full px-3 py-1 text-xs transition ${days === option ? 'bg-brand text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'}`}
                onClick={() => setDays(option)}
              >
                {option}d
              </button>
            ))}
          </div>
        </div>

        {!isLoading && sortedItems.length ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-brand-light/55 p-3 [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]">
            <Marquee pauseOnHover className="[--duration:35s] [--gap:0.85rem] p-0">
              {sortedItems.slice(0, 8).map((item, index) => (
                <ResurfacingPreviewCard key={`${String(item?.id || item?._id)}-${index}-a`} item={item} onOpen={(id) => navigate(`/item/${id}`)} />
              ))}
            </Marquee>
            <Marquee reverse pauseOnHover className="mt-3 [--duration:42s] [--gap:0.85rem] p-0">
              {sortedItems.slice(0, 8).map((item, index) => (
                <ResurfacingPreviewCard key={`${String(item?.id || item?._id)}-${index}-b`} item={item} onOpen={(id) => navigate(`/item/${id}`)} />
              ))}
            </Marquee>
          </div>
        ) : null}
      </Card>

      {isLoading ? (
        <Card padding="comfortable" className="space-y-2 rounded-2xl border-border/80 bg-bg-surface/86 backdrop-blur-sm">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      ) : isError ? (
        <ErrorState
          title="Could not load resurfacing feed"
          message={error?.data?.message || 'Please retry.'}
          onRetry={refetch}
        />
      ) : !sortedItems.length ? (
        <EmptyState
          icon={Sparkles}
          title="No resurfacing items right now"
          description="Save and revisit more content to build your long-term memory loop."
        />
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => {
            const itemId = String(item?.id || item?._id)
            const lastSeen = item?.updatedAt || item?.createdAt
            const itemType = item?.type || 'item'

            return (
              <Card key={itemId} padding="comfortable" className="space-y-2 rounded-2xl border-border/70 bg-bg-surface/90 backdrop-blur-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{item?.title || 'Untitled item'}</p>
                    <p className="mt-1 text-xs text-text-secondary">Last active {lastSeen ? dayjs(lastSeen).fromNow() : 'recently'}</p>
                  </div>
                  <Badge size="sm" variant="warning">
                    {itemType}
                  </Badge>
                </div>

                <p className="text-sm text-text-secondary line-clamp-2">{item?.summary || item?.description || 'No summary available.'}</p>

                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => navigate(`/item/${itemId}`)}>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={dismissingId === itemId}
                    onClick={() => handleDismiss(itemId)}
                  >
                    Dismiss
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

export default ResurfacingPage
