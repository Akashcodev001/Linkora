import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useSearchQuery } from '@/app/api/searchApi'
import { useReprocessItemMutation } from '@/app/api/itemsApi'
import ItemGrid from '@/components/items/ItemGrid'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'
import {
  resetFilters,
  setFilters,
  setPage,
  setQuery,
  setResultsPerPage,
} from '@/features/search/searchSlice'
import { useDebounce } from '@/hooks/useDebounce'
import { Database } from 'lucide-react'
import toast from 'react-hot-toast'

const searchTypes = ['all', 'url', 'file', 'text', 'video', 'image', 'pdf']
const resultSizes = [10, 20, 30]

const asList = (value, keys = ['items', 'results', 'data']) => {
  const root = value?.data || value || {}

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

  return []
}

const getResponseData = (response) => response?.data || response || {}

const getTotal = (response, fallback) => {
  const data = getResponseData(response)

  if (typeof data?.total === 'number') {
    return data.total
  }

  if (typeof data?.count === 'number') {
    return data.count
  }

  return fallback
}

const normalizeTag = (tag) => {
  if (typeof tag === 'string') return tag
  if (tag && typeof tag === 'object') return tag.name || tag.label || String(tag._id || '')
  return String(tag || '')
}

const normalizeStatus = (item) => String(item?.aiStatus || item?.status || '').toLowerCase()
const normalizePayloadItem = (value) => value?.data || value || null

export function SearchPage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { query, filters, page, resultsPerPage } = useSelector((state) => state.search)

  const [localResults, setLocalResults] = useState([])
  const [recentQueries, setRecentQueries] = useState([])
  const [retryingId, setRetryingId] = useState(null)
  const [reprocessItem] = useReprocessItemMutation()

  const debouncedQuery = useDebounce(query.trim(), 350)
  const shouldSearch = debouncedQuery.length > 0

  const {
    data: rawSearchData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useSearchQuery(
    {
      q: debouncedQuery,
      page,
      limit: resultsPerPage,
    },
    {
      skip: !shouldSearch,
      refetchOnMountOrArgChange: true,
    },
  )

  const responseData = getResponseData(rawSearchData)
  
  const incomingResults = useMemo(() => {
    return asList(responseData)
  }, [rawSearchData])

  useEffect(() => {
    if (!shouldSearch) {
      setLocalResults([])
      return
    }

    if (!incomingResults.length && page === 1) {
      setLocalResults([])
      return
    }

    setLocalResults((prev) => {
      const merged = page === 1 ? [] : [...prev]
      const map = new Map(merged.map((item) => [String(item?.id || item?._id), item]))
      incomingResults.forEach((item) => {
        map.set(String(item?.id || item?._id), item)
      })
      return Array.from(map.values())
    })
  }, [incomingResults.length, page, shouldSearch])

  useEffect(() => {
    if (debouncedQuery) {
      setRecentQueries((prev) => {
        const next = [debouncedQuery, ...prev.filter((entry) => entry !== debouncedQuery)]
        return next.slice(0, 5)
      })
    }
  }, [debouncedQuery])

  const filteredResults = useMemo(() => {
    let output = localResults

    if (filters.type && filters.type !== 'all') {
      output = output.filter((item) => String(item?.type || '').toLowerCase() === filters.type)
    }

    if (filters.tags?.length) {
      output = output.filter((item) => {
        const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => normalizeTag(tag).toLowerCase()) : []
        return filters.tags.every((tag) => tags.includes(String(tag).toLowerCase()))
      })
    }

    return output
  }, [filters.tags, filters.type, localResults])

  const allTags = useMemo(() => {
    const tags = new Set()
    localResults.forEach((item) => {
      if (Array.isArray(item?.tags)) {
        item.tags.forEach((tag) => {
          const value = normalizeTag(tag).trim()
          if (value) tags.add(value)
        })
      }
    })
    return Array.from(tags).slice(0, 12)
  }, [localResults])

  const totalResults = getTotal(responseData, localResults.length)
  const hasMore = localResults.length < totalResults

  const handleLoadMore = () => {
    if (hasMore && !isFetching) {
      dispatch(setPage(page + 1))
    }
  }

  const handleRetryAi = async (itemId) => {
    setRetryingId(itemId)
    try {
      const response = await reprocessItem(itemId).unwrap()
      const updatedItem = normalizePayloadItem(response)
      const nextStatus = normalizeStatus(updatedItem)

      setLocalResults((prev) =>
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
        toast.success('AI reprocessing started')
      } else {
        toast('AI worker is unavailable right now')
      }
    } catch (error) {
      toast.error(error?.data?.message || 'Could not reprocess this item')
    } finally {
      setRetryingId(null)
    }
  }

  const handleDeleted = (itemId) => {
    const id = String(itemId)
    setLocalResults((prev) => prev.filter((item) => String(item?.id || item?._id) !== id))
  }

  const toggleTagFilter = (tag) => {
    const current = Array.isArray(filters.tags) ? filters.tags : []
    const exists = current.includes(tag)
    const next = exists ? current.filter((entry) => entry !== tag) : [...current, tag]
    dispatch(setFilters({ tags: next }))
  }

  const clearSearch = () => {
    dispatch(setQuery(''))
    dispatch(setPage(1))
    setLocalResults([])
  }

  return (
    <div className="space-y-4">
      <Card padding="comfortable" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Search</h1>
            <p className="text-sm text-text-secondary">Find saved knowledge with semantic retrieval and quick filters.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="focus-ring h-10 rounded-default border border-border bg-white px-3 text-sm text-text-secondary"
              value={resultsPerPage}
              onChange={(event) => {
                dispatch(setResultsPerPage(Number(event.target.value)))
                dispatch(setPage(1))
              }}
            >
              {resultSizes.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={() => dispatch(resetFilters())}>
              Reset filters
            </Button>
          </div>
        </div>

        <Input
          placeholder="Search by meaning, title, tags, or topic"
          value={query}
          onChange={(event) => dispatch(setQuery(event.target.value))}
          leftIcon={<Search size={14} />}
          rightSlot={
            query ? (
              <button type="button" className="focus-ring rounded p-1" onClick={clearSearch} aria-label="Clear query">
                <X size={14} />
              </button>
            ) : null
          }
        />

        {recentQueries.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">Recent</span>
            {recentQueries.map((entry) => (
              <button
                key={entry}
                type="button"
                className="focus-ring rounded-full border border-border bg-white px-2.5 py-1 text-xs text-text-secondary hover:bg-surface-2"
                onClick={() => {
                  dispatch(setQuery(entry))
                  dispatch(setPage(1))
                }}
              >
                {entry}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {searchTypes.map((type) => {
              const activeType = filters.type || 'all'
              const isActive = activeType === type
              return (
                <button
                  key={type}
                  type="button"
                  className={`focus-ring rounded-full px-3 py-1 text-xs capitalize transition ${isActive ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-slate-200'}`}
                  onClick={() => dispatch(setFilters({ type }))}
                >
                  {type}
                </button>
              )
            })}
          </div>

          {allTags.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {allTags.map((tag) => {
                const selected = filters.tags?.includes(tag)
                return (
                  <Badge
                    key={tag}
                    size="sm"
                    variant={selected ? 'brand' : 'default'}
                    removable={selected}
                    onRemove={() => toggleTagFilter(tag)}
                  >
                    <button type="button" onClick={() => toggleTagFilter(tag)} className="text-left">
                      {tag}
                    </button>
                  </Badge>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="text-xs text-text-muted">
          {shouldSearch ? `${filteredResults.length} shown of ${totalResults} results` : 'Type a query to start searching'}
        </div>
      </Card>

      {!shouldSearch ? (
        <EmptyState
          icon={Database}
          title="Start with a query"
          description="Use natural language like 'notes about React auth errors from last week'."
        />
      ) : (
        <ItemGrid
          items={filteredResults}
          isLoading={isLoading && page === 1}
          isFetching={isFetching}
          isError={isError}
          errorMessage={error?.data?.message || 'Could not run search'}
          onRetry={refetch}
          onOpen={(itemId) => navigate(`/item/${itemId}`)}
          onRetryAi={handleRetryAi}
          onDeleted={handleDeleted}
          retryingId={retryingId}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />
      )}
    </div>
  )
}

export default SearchPage
