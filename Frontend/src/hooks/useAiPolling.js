import { useEffect, useMemo, useState } from 'react'
import { useGetItemQuery } from '@/app/api/itemsApi'

const TERMINAL_AI_STATUSES = new Set(['processed', 'failed', 'processed_without_ai'])

const normalizeItemResponse = (value) => value?.data || value?.item || value || null

/**
 * Poll item status until AI processing reaches a terminal state.
 */
export function useAiPolling(itemId, interval = 6000) {
  const [isPolling, setIsPolling] = useState(Boolean(itemId))

  useEffect(() => {
    setIsPolling(Boolean(itemId))
  }, [itemId])

  const queryState = useGetItemQuery(itemId, {
    skip: !itemId,
    pollingInterval: isPolling ? interval : 0,
    refetchOnMountOrArgChange: false,
  })

  const item = normalizeItemResponse(queryState.data)
  const aiStatus = String(item?.aiStatus || item?.status || '').toLowerCase()
  const extractedItemId = item?.id || item?._id

  useEffect(() => {
    if (!item) {
      return
    }

    if (TERMINAL_AI_STATUSES.has(aiStatus) || queryState.error?.status === 429) {
      setIsPolling(false)
    }
  }, [aiStatus, extractedItemId, queryState.error?.status])

  const isLoading = useMemo(() => {
    return queryState.isLoading || (queryState.isFetching && !item)
  }, [item, queryState.isFetching, queryState.isLoading])

  return {
    item,
    isPolling,
    isLoading,
  }
}

export default useAiPolling
