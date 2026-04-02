import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useGetItemQuery,
  useGetRelatedQuery,
  useReprocessItemMutation,
  useUpdateItemMutation,
} from '@/app/api/itemsApi'
import {
  useCreateHighlightMutation,
  useDeleteHighlightMutation,
  useGetHighlightsQuery,
} from '@/app/api/highlightsApi'
import { useAiPolling } from '@/hooks/useAiPolling'
import AiStatusBadge from '@/components/items/AiStatusBadge'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Input from '@/components/ui/Input'
import Skeleton from '@/components/ui/Skeleton'
import Spinner from '@/components/ui/Spinner'
import Textarea from '@/components/ui/Textarea'
import { ArrowLeft, Link2, Sparkles, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

const asList = (value, keys = ['data', 'items', 'highlights']) => {
  const root = value?.data || value || {}

  if (Array.isArray(root)) return root

  for (const key of keys) {
    if (Array.isArray(root?.[key])) {
      return root[key]
    }

    if (Array.isArray(root?.data?.[key])) {
      return root.data[key]
    }
  }

  return []
}

const normalizeItem = (value) => value?.data || value?.item || value || null

const normalizeStatus = (item) => String(item?.aiStatus || item?.status || 'pending').toLowerCase()

function ItemViewer({ item }) {
  const type = item?.type || 'text'

  if (type === 'url') {
    return (
      <div className="space-y-3">
        <a
          href={item?.url}
          target="_blank"
          rel="noreferrer"
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-brand/25 bg-brand-soft px-3 py-2 text-sm font-medium text-brand"
        >
          <Link2 size={14} />
          Open source
        </a>
        {item?.summary ? (
          <p className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-text-secondary">{item.summary}</p>
        ) : null}
      </div>
    )
  }

  if (type === 'file') {
    const fileUrl = item?.fileUrl || item?.url
    const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(fileUrl || '')

    return (
      <div className="space-y-3">
        {isImage && fileUrl ? (
          <img src={fileUrl} alt={item?.title || 'Attachment'} className="max-h-[440px] w-full rounded-lg border border-border object-contain" />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-text-secondary">
            File preview is unavailable for this format.
          </div>
        )}
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-brand/25 px-3 py-2 text-sm font-medium text-brand"
          >
            <Link2 size={14} />
            Open file
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{item?.content || item?.summary || 'No content available yet.'}</pre>
    </div>
  )
}

function ItemDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-52" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="space-y-4" padding="comfortable">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-72 w-full" />
        </Card>
        <Card className="space-y-3" padding="comfortable">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      </div>
    </div>
  )
}

export function ItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tagsInput, setTagsInput] = useState('')
  const [highlightText, setHighlightText] = useState('')
  const [highlightNote, setHighlightNote] = useState('')
  const [pollItemId, setPollItemId] = useState(null)
  const [showDetailedSummary, setShowDetailedSummary] = useState(false)

  const {
    data: itemData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetItemQuery(id, {
    skip: !id,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    refetchOnMountOrArgChange: false,
  })

  const item = normalizeItem(itemData)
  const itemId = String(item?.id || item?._id || id || '')
  const { item: polledItem } = useAiPolling(pollItemId)

  const {
    data: highlightsData,
    isLoading: highlightsLoading,
    refetch: refetchHighlights,
  } = useGetHighlightsQuery(itemId, { skip: !itemId })
  const highlights = asList(highlightsData)

  const { data: relatedData, isLoading: relatedLoading, refetch: refetchRelated } = useGetRelatedQuery(itemId, {
    skip: !itemId,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    refetchOnMountOrArgChange: false,
  })
  const relatedItems = asList(relatedData, ['items', 'data', 'related'])

  const [updateItem, { isLoading: savingTags }] = useUpdateItemMutation()
  const [reprocessItem, { isLoading: retryingAi }] = useReprocessItemMutation()
  const [createHighlight, { isLoading: creatingHighlight }] = useCreateHighlightMutation()
  const [deleteHighlight, { isLoading: deletingHighlight }] = useDeleteHighlightMutation()

  const effectiveItem = polledItem && String(polledItem?.id || polledItem?._id) === itemId ? polledItem : item

  const effectiveTags = useMemo(() => {
    if (!Array.isArray(effectiveItem?.tags)) {
      return []
    }
    // Handle both string tags and object tags with {_id, name}
    return effectiveItem.tags.map(tag => {
      if (typeof tag === 'string') return { _id: tag, name: tag }
      return { _id: tag?._id || tag?.id || tag?.name, name: tag?.name || tag }
    })
  }, [effectiveItem])

  const handleSaveTags = async () => {
    const nextTags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    try {
      await updateItem({ id: itemId, tags: nextTags }).unwrap()
      toast.success('Tags updated')
      setTagsInput('')
      refetch()
    } catch {
      toast.error('Could not update tags')
    }
  }

  const handleRetryAi = async () => {
    try {
      const response = await reprocessItem(itemId).unwrap()
      const nextItem = normalizeItem(response)
      const nextStatus = normalizeStatus(nextItem)

      if (nextStatus === 'pending' || nextStatus === 'processing') {
        setPollItemId(itemId)
        toast.success('AI reprocessing started')
      } else if (nextStatus === 'processed_without_ai') {
        setPollItemId(null)
        toast('AI worker is unavailable right now')
      } else {
        setPollItemId(null)
        toast.success('Item updated')
      }
    } catch (error) {
      const errorMessage = error?.data?.message || error?.message || 'Could not start reprocessing'
      console.error('Reprocess error:', error)
      toast.error(`Error: ${errorMessage}`)
    }
  }

  const handleCreateHighlight = async () => {
    if (!highlightText.trim()) {
      toast.error('Add text to create a highlight')
      return
    }

    try {
      await createHighlight({
        itemId,
        text: highlightText.trim(),
        color: 'yellow', // Default color
        note: highlightNote.trim(),
      }).unwrap()
      setHighlightText('')
      setHighlightNote('')
      toast.success('Highlight added')
    } catch (error) {
      const errorMessage = error?.data?.message || error?.message || 'Could not create highlight'
      console.error('Create highlight error:', error)
      toast.error(errorMessage)
    }
  }

  const handleDeleteHighlight = async (highlightId) => {
    try {
      await deleteHighlight(highlightId).unwrap()
      toast.success('Highlight removed')
    } catch {
      toast.error('Could not remove highlight')
    }
  }

  if (isLoading) {
    return <ItemDetailSkeleton />
  }

  if (isError || !effectiveItem) {
    return (
      <ErrorState
        title="Could not load item"
        message={error?.data?.message || 'Please try again.'}
        onRetry={refetch}
      />
    )
  }

  const aiStatus = normalizeStatus(effectiveItem)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>
          Back
        </Button>
        <Badge size="sm" variant="default">
          {effectiveItem?.type || 'item'}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card padding="comfortable" className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-text-primary">{effectiveItem?.title || 'Untitled item'}</h1>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Quick summary</p>
            <p className="text-sm text-text-secondary">{effectiveItem?.summary || 'No quick summary generated yet.'}</p>
          </div>

          <section className="space-y-2 rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Detailed summary</h2>
              <button
                type="button"
                className="focus-ring rounded-md border border-border px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setShowDetailedSummary((prev) => !prev)}
                aria-expanded={showDetailedSummary}
                disabled={!effectiveItem?.detailedSummary}
              >
                {showDetailedSummary ? 'Hide' : 'Show'}
              </button>
            </div>
            {effectiveItem?.detailedSummary ? (
              showDetailedSummary ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{effectiveItem.detailedSummary}</p>
              ) : (
                <p className="text-xs text-text-muted">Detailed summary is available. Click show to expand.</p>
              )
            ) : (
              <p className="text-xs text-text-muted">Detailed summary is not ready yet. Run AI reprocessing to generate it.</p>
            )}
          </section>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Source content</p>
          </div>

          <ItemViewer item={effectiveItem} />

          <section className="space-y-3 rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Highlights</h2>
              {highlightsLoading ? <Spinner size={16} /> : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Textarea
                placeholder="Highlighted text"
                value={highlightText}
                onChange={(event) => setHighlightText(event.target.value)}
                rows={3}
              />
              <Textarea
                placeholder="Optional note"
                value={highlightNote}
                onChange={(event) => setHighlightNote(event.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Button size="sm" onClick={handleCreateHighlight} disabled={creatingHighlight}>
                {creatingHighlight ? 'Adding...' : 'Add highlight'}
              </Button>
            </div>

            {highlights.length ? (
              <ul className="space-y-2">
                {highlights.map((highlight) => {
                  const highlightId = highlight?.id || highlight?._id
                  return (
                    <li key={String(highlightId)} className="rounded-lg border border-border bg-surface-2 p-3">
                      <p className="text-sm text-text-primary">{highlight?.text || highlight?.content || 'Highlight'}</p>
                      {highlight?.note ? <p className="mt-1 text-xs text-text-secondary">{highlight.note}</p> : null}
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteHighlight(highlightId)}
                          disabled={deletingHighlight}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState
                title="No highlights yet"
                description="Create highlights to keep key context for this item."
                icon={Sparkles}
              />
            )}
          </section>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card padding="comfortable" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">AI Status</h2>
              <AiStatusBadge status={aiStatus} onRetry={handleRetryAi} retrying={retryingAi} />
            </div>

            <Button size="sm" className="w-full" onClick={handleRetryAi} disabled={retryingAi}>
              {retryingAi ? 'Retrying...' : 'Retry AI Processing'}
            </Button>
          </Card>

          <Card padding="comfortable" className="space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Tags</h2>
            <Input
              placeholder="tag1, tag2, tag3"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              leftIcon={<Tag size={14} />}
            />
            <Button size="sm" onClick={handleSaveTags} disabled={savingTags}>
              {savingTags ? 'Saving...' : 'Save Tags'}
            </Button>
            <div className="flex flex-wrap gap-1">
              {effectiveTags.map((tag) => (
                <Badge key={String(tag?._id || tag?.name)} size="sm" variant="brand">
                  {tag?.name || tag}
                </Badge>
              ))}
            </div>
          </Card>

          <Card padding="comfortable" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Related</h2>
              <Button size="sm" variant="ghost" onClick={refetchRelated} disabled={relatedLoading}>
                Refresh
              </Button>
            </div>
            {relatedLoading ? (
              <div className="py-4 text-center">
                <Spinner size={16} />
              </div>
            ) : relatedItems.length ? (
              <ul className="space-y-2">
                {relatedItems.slice(0, 8).map((related) => {
                  const relatedId = related?.id || related?._id
                  return (
                    <li key={String(relatedId)}>
                      <Link
                        to={`/item/${relatedId}`}
                        className="focus-ring block rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:border-brand/40 hover:bg-brand-soft"
                      >
                        {related?.title || 'Untitled item'}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-text-secondary">No related items yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ItemDetailPage
