import { Link, useParams } from 'react-router-dom'
import { useGetSharedItemQuery } from '@/app/api/itemsApi'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Skeleton from '@/components/ui/Skeleton'
import Highlighter from '@/components/ui/Highlighter'
import { ArrowLeft, ExternalLink, Link2 } from 'lucide-react'

const normalizeItemPayload = (response) => response?.data || response || null

function LoadingState() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Skeleton className="h-10 w-40" />
      <Card padding="comfortable" className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-28 w-full" />
      </Card>
    </div>
  )
}

export function SharedItemPage() {
  const { token } = useParams()

  const {
    data: payload,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSharedItemQuery(token, {
    skip: !token,
  })

  const item = normalizeItemPayload(payload)

  if (isLoading) {
    return <LoadingState />
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <ErrorState
          title="Could not load shared item"
          message={error?.data?.message || 'This link is invalid or expired.'}
          onRetry={refetch}
        />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <EmptyState title="Shared item unavailable" description="This item may have been removed or the link expired." />
      </div>
    )
  }

  const tags = Array.isArray(item?.tags)
    ? item.tags.map((tag) => (typeof tag === 'string' ? tag : tag?.name)).filter(Boolean)
    : []

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft size={14} />
          <span>
            Back to{' '}
            <Highlighter action="underline" color="#FF9800" animationDuration={800} iterations={1} isView>
              Linkora
            </Highlighter>
          </span>
        </Link>
        {item?.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            Open source <ExternalLink size={14} />
          </a>
        ) : null}
      </div>

      <Card padding="comfortable" className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-text-muted">Shared Link</p>
          <h1 className="text-xl font-semibold text-text-primary">{item?.title || 'Untitled item'}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span className="rounded-full border border-border px-2 py-0.5">{item?.type || 'text'}</span>
          {tags.length ? <span>{tags.join(' • ')}</span> : null}
        </div>

        {item?.summary ? (
          <p className="rounded-default border border-border bg-surface-2 p-3 text-sm text-text-secondary">{item.summary}</p>
        ) : null}

        {item?.detailedSummary ? (
          <div className="rounded-default border border-border bg-surface-2 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Detailed summary</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{item.detailedSummary}</p>
          </div>
        ) : null}

        {item?.description ? (
          <p className="text-sm text-text-secondary">{item.description}</p>
        ) : null}

        {item?.content ? (
          <div className="rounded-default border border-border bg-surface-2 p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{item.content}</p>
          </div>
        ) : (
          <div className="rounded-default border border-dashed border-border bg-surface-2 p-6 text-center text-sm text-text-secondary">
            <Link2 size={18} className="mx-auto mb-2 text-text-muted" />
            Full content not included in this shared view.
          </div>
        )}

        <div className="pt-2">
          <Link to="/register">
            <Button size="sm">
              Create your{' '}
              <Highlighter action="highlight" color="#ffd59e" animationDuration={850} iterations={1} isView>
                Linkora
              </Highlighter>{' '}
              workspace
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default SharedItemPage
