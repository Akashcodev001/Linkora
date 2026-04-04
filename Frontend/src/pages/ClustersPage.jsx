import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetClusterQuery, useGetClustersQuery, useRebuildClustersMutation } from '@/app/api/clustersApi'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Skeleton from '@/components/ui/Skeleton'
import { GitBranch, Layers3, RefreshCcw, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const normalizePayload = (response) => response?.data || response || {}

const asList = (value, keys = ['clusters', 'items', 'data']) => {
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

const getId = (value) => String(value?.id || value?._id || '')

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ClustersPage() {
  const [selectedId, setSelectedId] = useState('')

  const {
    data: clustersRaw,
    isLoading: clustersLoading,
    isError: clustersError,
    error: clustersErrorPayload,
    refetch: refetchClusters,
  } = useGetClustersQuery()

  const clustersPayload = normalizePayload(clustersRaw)
  const clusters = useMemo(() => asList(clustersPayload), [clustersPayload])

  useEffect(() => {
    if (!clusters.length) {
      setSelectedId('')
      return
    }

    if (!selectedId || !clusters.some((cluster) => getId(cluster) === selectedId)) {
      setSelectedId(getId(clusters[0]))
    }
  }, [clusters, selectedId])

  const {
    data: clusterRaw,
    isLoading: clusterLoading,
    isError: clusterError,
    error: clusterErrorPayload,
    refetch: refetchCluster,
  } = useGetClusterQuery(selectedId, { skip: !selectedId })

  const clusterPayload = normalizePayload(clusterRaw)
  const selectedCluster = clusterPayload?.id ? clusterPayload : null
  const clusterItems = asList(clusterPayload, ['items', 'sampleItems'])

  const [rebuildClusters, { isLoading: rebuilding }] = useRebuildClustersMutation()

  const totalItems = clusters.reduce((sum, cluster) => sum + Number(cluster?.itemCount || 0), 0)

  const handleRebuild = async () => {
    try {
      await rebuildClusters({ reason: 'manual' }).unwrap()
      toast.success('Cluster rebuild queued')
      refetchClusters()
      if (selectedId) {
        refetchCluster()
      }
    } catch (error) {
      toast.error(error?.data?.message || 'Could not queue cluster rebuild')
    }
  }

  return (
    <div className="space-y-4">
      <Card padding="comfortable" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                <GitBranch size={18} />
              </span>
              <div>
                <h1 className="text-xl font-semibold text-text-primary">Topic Clusters</h1>
                <p className="text-sm text-text-secondary">Dedicated cluster management built from your saved knowledge.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              <Badge size="sm" variant="default">{clusters.length} clusters</Badge>
              <Badge size="sm" variant="default">{totalItems} clustered items</Badge>
              <Badge size="sm" variant="default">Auto-updated after ingestion</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetchClusters()}>
              Refresh
            </Button>
            <Button
              size="sm"
              loading={rebuilding}
              onClick={handleRebuild}
              leftIcon={<RefreshCcw size={14} />}
            >
              Rebuild clusters
            </Button>
          </div>
        </div>
      </Card>

      {clustersLoading ? (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card padding="comfortable" className="space-y-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </Card>
          <Card padding="comfortable" className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </Card>
        </div>
      ) : clustersError ? (
        <ErrorState
          title="Could not load clusters"
          message={clustersErrorPayload?.data?.message || 'Please retry.'}
          onRetry={refetchClusters}
        />
      ) : !clusters.length ? (
        <EmptyState
          icon={Layers3}
          title="No clusters yet"
          description="Clusters appear automatically once enough items have been processed and embedded."
          ctaLabel="Open graph view"
          onCtaClick={() => window.location.assign('/graph')}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card padding="comfortable" className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Clusters</h2>
              <p className="text-xs text-text-secondary">Sorted by size and recent activity.</p>
            </div>

            <div className="space-y-2 max-h-[680px] overflow-auto pr-1">
              {clusters.map((cluster) => {
                const clusterId = getId(cluster)
                const active = clusterId === selectedId
                return (
                  <button
                    key={clusterId}
                    type="button"
                    onClick={() => setSelectedId(clusterId)}
                    className={`w-full rounded-default border p-3 text-left transition ${active ? 'border-brand bg-brand-light/20 shadow-subtle' : 'border-border bg-surface hover:bg-surface-2'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{cluster.label || cluster.topic || 'Topic'}</p>
                        <p className="text-xs text-text-secondary">
                          {cluster.type || 'semantic'} · updated {formatDate(cluster.lastUpdatedAt)}
                        </p>
                      </div>
                      <Badge size="sm" variant={active ? 'brand' : 'default'}>
                        {cluster.itemCount || 0}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cluster.topTag ? <Badge size="sm">{cluster.topTag}</Badge> : null}
                      {cluster.sampleItems?.[0]?.type ? <Badge size="sm">{cluster.sampleItems[0].type}</Badge> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card padding="comfortable" className="space-y-4">
            {clusterLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : clusterError ? (
              <ErrorState
                title="Could not load cluster"
                message={clusterErrorPayload?.data?.message || 'Please retry.'}
                onRetry={refetchCluster}
              />
            ) : selectedCluster ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Layers3 size={18} className="text-brand" />
                      <h2 className="text-lg font-semibold text-text-primary">{selectedCluster.label || selectedCluster.topic}</h2>
                    </div>
                    <p className="max-w-2xl text-sm text-text-secondary">
                      {selectedCluster.itemCount} items grouped by semantic similarity and fallback signals when embeddings are not available.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge size="sm">{selectedCluster.type || 'semantic'}</Badge>
                    <Badge size="sm">Last updated {formatDate(selectedCluster.lastUpdatedAt)}</Badge>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-default border border-border bg-surface p-3">
                    <p className="text-xs uppercase tracking-wide text-text-muted">Cluster ID</p>
                    <p className="mt-1 break-all text-sm text-text-primary">{selectedCluster.id}</p>
                  </div>
                  <div className="rounded-default border border-border bg-surface p-3">
                    <p className="text-xs uppercase tracking-wide text-text-muted">Top tag</p>
                    <p className="mt-1 text-sm text-text-primary">{selectedCluster.topTag || 'n/a'}</p>
                  </div>
                  <div className="rounded-default border border-border bg-surface p-3">
                    <p className="text-xs uppercase tracking-wide text-text-muted">First seen</p>
                    <p className="mt-1 text-sm text-text-primary">{formatDate(selectedCluster.firstSeenAt)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">Items in cluster</h3>
                    <span className="text-xs text-text-secondary">{clusterItems.length} shown</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {clusterItems.map((item) => (
                      <Link
                        key={item.id}
                        to={`/item/${item.id}`}
                        className="group rounded-default border border-border bg-surface p-3 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-subtle"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-medium text-text-primary group-hover:text-brand-dark">{item.title}</p>
                          <Badge size="sm">{item.type}</Badge>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs text-text-secondary">
                          {item.description || item.topic || 'No description available'}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-text-muted">
                          <span>{formatDate(item.updatedAt)}</span>
                          <span className="truncate">{item.clusterId}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="Select a cluster"
                description="Pick a cluster from the left to inspect its items and signals."
              />
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default ClustersPage
