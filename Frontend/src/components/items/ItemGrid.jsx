import { useMemo, useRef } from 'react'
import ItemCard from '@/components/items/ItemCard'
import ItemCardSkeleton from '@/components/items/ItemCardSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { Database } from 'lucide-react'

const toText = (value, fallback = '') => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    return String(value.name || value.label || value.title || value.text || value._id || fallback)
  }
  return fallback
}

const normalizeTag = (tag) => toText(tag, '').trim()

const normalizeItemForRender = (item) => {
  if (!item || typeof item !== 'object') return item

  const normalizedTags = Array.isArray(item.tags)
    ? item.tags.map((tag) => normalizeTag(tag)).filter(Boolean)
    : []

  return {
    ...item,
    title: toText(item.title, 'Untitled item'),
    summary: toText(item.summary, ''),
    description: toText(item.description, ''),
    type: toText(item.type, 'text'),
    tags: normalizedTags,
  }
}

export function ItemGrid({
  items,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  onRetry,
  onOpen,
  onRetryAi,
  onDeleted,
  retryingId,
  onLoadMore,
  hasMore,
}) {
  const sentinelRef = useRef(null)

  useInfiniteScroll(sentinelRef, () => {
    if (!isFetching && hasMore) {
      onLoadMore()
    }
  })

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ItemCardSkeleton key={index} />
          ))}
        </div>
      )
    }

    if (isError) {
      return <ErrorState message={errorMessage} onRetry={onRetry} />
    }

    if (!items.length) {
      return (
        <EmptyState
          icon={Database}
          title="No saved items"
          description="Save your first URL, note, or file to start building your knowledge graph."
        />
      )
    }

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const safeItem = normalizeItemForRender(item)
            const itemId = safeItem?.id || safeItem?._id
            return (
              <ItemCard
                key={String(itemId)}
                item={safeItem}
                onOpen={onOpen}
                onRetry={onRetryAi}
                onDeleted={onDeleted}
                retrying={retryingId === itemId}
              />
            )
          })}
        </div>
        {isFetching ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ItemCardSkeleton />
            <ItemCardSkeleton />
            <ItemCardSkeleton />
          </div>
        ) : null}
        <div ref={sentinelRef} className="h-2 w-full" aria-hidden />
      </>
    )
  }, [errorMessage, hasMore, isError, isFetching, isLoading, items, onDeleted, onLoadMore, onOpen, onRetry, onRetryAi, retryingId])

  return content
}

export default ItemGrid
