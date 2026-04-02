import { Suspense, lazy, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import SaveModal from '@/components/items/SaveModal'
import ItemGrid from '@/components/items/ItemGrid'
import ResurfacingWidget from '@/components/resurfacing/ResurfacingWidget'
import { useGetItemsQuery, useReprocessItemMutation } from '@/app/api/itemsApi'
import { useGetCollectionsQuery } from '@/app/api/collectionsApi'
import { useDismissItemMutation, useGetResurfacingQuery } from '@/app/api/resurfacingApi'
import { useGetHealthQuery } from '@/app/api/healthApi'
import { useAiPolling } from '@/hooks/useAiPolling'
import { ROUTES } from '@/constants/routes'

dayjs.extend(relativeTime)

const asList = (payload, keys = []) => {
  const root = payload?.data || payload || {}

  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(root)) {
    return root
  }

  for (const key of keys) {
    if (Array.isArray(root?.[key])) {
      return root[key]
    }

    if (Array.isArray(root?.data?.[key])) {
      return root.data[key]
    }
  }

  if (Array.isArray(root?.items)) return root.items
  if (Array.isArray(root?.collections)) return root.collections

  return []
}

const asTotal = (payload, fallbackLength) => {
  const root = payload?.data || payload || {}

  if (typeof root?.pagination?.total === 'number') {
    return root.pagination.total
  }

  if (typeof root?.total === 'number') {
    return root.total
  }

  if (typeof root?.count === 'number') {
    return root.count
  }

  return fallbackLength
}

const normalizeStatus = (item) => {
  const rawStatus = String(item?.aiStatus || item?.status || 'pending').toLowerCase()
  if (rawStatus !== 'pending' && rawStatus !== 'processing') {
    return rawStatus
  }

  const processingError = String(item?.processingError || '').toLowerCase()
  if (processingError.includes('ai_pipeline')) {
    return 'processed_without_ai'
  }

  const updatedMs = new Date(item?.updatedAt || item?.createdAt || 0).getTime()
  const staleThresholdMs = 15 * 60 * 1000
  if (Number.isFinite(updatedMs) && Date.now() - updatedMs > staleThresholdMs) {
    return 'processed_without_ai'
  }

  return item?.aiStatus || item?.status || 'pending'
}

const normalizePayloadItem = (value) => value?.data || value || null

const periodGreeting = () => {
  const hour = dayjs().hour()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const typeFilters = ['all', 'url', 'pdf', 'video', 'tweet', 'image', 'text']
const bgPresetOptions = ['subtle', 'medium', 'bold']
const BG_PRESET_STORAGE_KEY = 'linkora-dashboard-bg-preset'
const DashboardThreeBackground = lazy(() => import('@/components/background/DashboardThreeBackground'))

export function DashboardPage() {
  const navigate = useNavigate()
  const [isSaveOpen, setSaveOpen] = useState(false)
  const [activeType, setActiveType] = useState('all')
  const [page, setPage] = useState(1)
  const [dismissingId, setDismissingId] = useState(null)
  const [retryingId, setRetryingId] = useState(null)
  const [localItems, setLocalItems] = useState([])
  const [pollItemId, setPollItemId] = useState(null)
  const [bgPreset, setBgPreset] = useState('medium')

  const limit = 9

  const {
    data: itemsData,
    isLoading: itemsLoading,
    isFetching: itemsFetching,
    isError: itemsError,
    error: itemsErrorPayload,
    refetch: refetchItems,
  } = useGetItemsQuery({ 
    page, 
    limit, 
    type: activeType === 'all' ? undefined : activeType 
  })
  const { data: collectionsData } = useGetCollectionsQuery(undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: false,
    refetchOnMountOrArgChange: 300,
  })
  const { data: resurfacingData, isLoading: resurfacingLoading } = useGetResurfacingQuery(undefined, {
    refetchOnFocus: false,
    refetchOnReconnect: false,
    refetchOnMountOrArgChange: 300,
  })
  const { data: healthData } = useGetHealthQuery(undefined, {
    pollingInterval: 15000,
    refetchOnFocus: false,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: 30,
  })
  const [dismissResurfacing] = useDismissItemMutation()
  const [reprocessItem] = useReprocessItemMutation()
  const { item: polledItem } = useAiPolling(pollItemId)

  const items = asList(itemsData, ['items', 'data'])
  const collections = asList(collectionsData, ['collections', 'data'])
  const resurfacingItems = asList(resurfacingData, ['items', 'data'])

  const totalItems = asTotal(itemsData, items.length)
  const totalCollections = asTotal(collectionsData, collections.length)
  const pendingCountFallback = items.filter((item) => {
    const status = normalizeStatus(item)
    return status === 'pending' || status === 'processing'
  }).length

  const health = healthData?.data || healthData || {}
  const queueCounts = health?.aiQueue?.counts || {}
  const queuedCount = Number(queueCounts.waiting || 0) + Number(queueCounts.delayed || 0) + Number(queueCounts.prioritized || 0)
  const activeCount = Number(queueCounts.active || 0)
  const queueCount = Number.isFinite(queuedCount + activeCount) ? queuedCount + activeCount : pendingCountFallback
  const queueAvailable = Boolean(health?.aiQueue?.available)
  const workerOnline = Boolean(health?.aiQueue?.worker?.online)
  const delayedCount = Number(queueCounts.delayed || 0)
  const waitingCount = Number(queueCounts.waiting || 0)

  useEffect(() => {
    const savedPreset = localStorage.getItem(BG_PRESET_STORAGE_KEY)
    if (savedPreset && bgPresetOptions.includes(savedPreset)) {
      setBgPreset(savedPreset)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(BG_PRESET_STORAGE_KEY, bgPreset)
  }, [bgPreset])

  useEffect(() => {
    if (!items.length) {
      if (page === 1) {
        setLocalItems([])
      }
      return
    }

    setLocalItems((prev) => {
      const merged = page === 1 ? [] : [...prev]
      const map = new Map(merged.map((item) => [String(item?.id || item?._id), item]))
      items.forEach((item) => map.set(String(item?.id || item?._id), item))
      return Array.from(map.values())
    })
  }, [items, page])

  useEffect(() => {
    setPage(1)
  }, [activeType])

  useEffect(() => {
    if (!polledItem || (!polledItem?.id && !polledItem?._id)) {
      return
    }

    const itemId = String(polledItem?.id || polledItem?._id)
    const status = normalizeStatus(polledItem)

    setLocalItems((prev) => {
      const itemExists = prev.find((item) => String(item?.id || item?._id) === itemId)
      
      // Only update if item exists
      if (!itemExists) {
        return prev
      }

      return prev.map((item) => {
        if (String(item?.id || item?._id) === itemId) {
          return {
            ...item,
            ...polledItem,
          }
        }
        return item
      })
    })

    // Handle terminal states - only run once when status changes
    if (status === 'processed' || status === 'failed') {
      setPollItemId(null)
      toast.success(status === 'processed' ? 'AI processing complete' : 'AI processing failed')
    }
  }, [polledItem?.id || polledItem?._id, polledItem?.aiStatus, polledItem?.status, polledItem?.processingError])

  const hasMore = localItems.length < totalItems

  const handleSaveSuccess = (savedItem) => {
    const newItemId = savedItem?.id || savedItem?._id || savedItem?.itemId

    if (savedItem) {
      setLocalItems((prev) => [savedItem, ...prev])
    }
    toast.success('Saved! AI is processing...')
    if (newItemId) {
      setPollItemId(newItemId)
    }
    refetchItems()
  }

  const handleDismissResurfacing = async (itemId) => {
    setDismissingId(itemId)
    try {
      await dismissResurfacing(itemId).unwrap()
    } catch {
      toast.error('Could not dismiss this item')
    } finally {
      setDismissingId(null)
    }
  }

  const handleRetryAi = async (itemId) => {
    setRetryingId(itemId)
    try {
      const response = await reprocessItem(itemId).unwrap()
      const updatedItem = normalizePayloadItem(response)
      const nextStatus = normalizeStatus(updatedItem)

      setLocalItems((prev) =>
        prev.map((item) => {
          const id = String(item?.id || item?._id)
          if (id !== String(itemId)) return item
          return {
            ...item,
            ...(updatedItem || {}),
          }
        }),
      )

      if (nextStatus === 'pending' || nextStatus === 'processing') {
        setPollItemId(itemId)
        toast.success('AI reprocessing started')
      } else {
        setPollItemId(null)
        toast('AI worker is unavailable right now')
      }
    } catch (error) {
      toast.error(error?.data?.message || 'Could not reprocess this item')
    } finally {
      setRetryingId(null)
    }
  }

  const handleDeletedItem = (itemId) => {
    setLocalItems((prev) => prev.filter((item) => String(item?.id || item?._id) !== String(itemId)))
    if (String(pollItemId || '') === String(itemId)) {
      setPollItemId(null)
    }
    refetchItems()
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[1.75rem] px-1 py-1">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Suspense fallback={null}>
          <DashboardThreeBackground preset={bgPreset} />
        </Suspense>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,transparent_20%,var(--bg-base)_85%)]" />
      </div>

      <div className="relative z-10 space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-bg-surface/84 p-4 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{periodGreeting()}</h1>
          <p className="text-sm text-text-secondary">
            {totalItems} items • {totalCollections} collections • {queueCount} AI in queue
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted">
            <span className={`inline-block h-2 w-2 rounded-full ${queueAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {queueAvailable ? `Queue online` : 'Queue unavailable'}
            <span className={`ml-2 inline-block h-2 w-2 rounded-full ${workerOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {workerOnline ? 'Worker online' : 'Worker offline'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Waiting: {waitingCount} • Processing: {activeCount} • Delayed: {delayedCount}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-bg-surface/80 p-1">
            {bgPresetOptions.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`focus-ring rounded-full px-3 py-1 text-xs font-medium capitalize transition ${bgPreset === preset ? 'bg-brand text-white' : 'text-text-secondary hover:bg-bg-hover'}`}
                onClick={() => setBgPreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <Button leftIcon={<Plus size={14} />} onClick={() => setSaveOpen(true)}>
            Save something
          </Button>
        </div>
      </section>

      <ResurfacingWidget
        items={resurfacingItems}
        isLoading={resurfacingLoading}
        onDismiss={handleDismissResurfacing}
        dismissingId={dismissingId}
        onOpen={(itemId) => navigate(`/item/${itemId}`)}
      />

      <section className="flex items-center gap-2 overflow-x-auto pb-1">
        {typeFilters.map((filterType) => (
          <button
            key={filterType}
            type="button"
            className={`focus-ring whitespace-nowrap rounded-full px-3 py-1.5 text-sm capitalize transition ${activeType === filterType ? 'bg-brand text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'}`}
            onClick={() => setActiveType(filterType)}
          >
            {filterType}
          </button>
        ))}
      </section>

      <ItemGrid
        items={localItems}
        isLoading={itemsLoading && page === 1}
        isFetching={itemsFetching}
        isError={itemsError}
        errorMessage={itemsErrorPayload?.data?.message || 'Could not load items'}
        onRetry={refetchItems}
        onOpen={(itemId) => navigate(`/item/${itemId}`)}
        onRetryAi={handleRetryAi}
        onDeleted={handleDeletedItem}
        retryingId={retryingId}
        onLoadMore={() => setPage((prev) => prev + 1)}
        hasMore={hasMore}
      />

      <SaveModal open={isSaveOpen} onOpenChange={setSaveOpen} onSaved={handleSaveSuccess} />
      </div>
    </div>
  )
}

export default DashboardPage
