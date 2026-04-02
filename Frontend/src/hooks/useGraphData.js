import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLazyGetNeighborsQuery } from '@/app/api/graphApi'
import { addExpandedNodeId, setGraphData, setGraphLoading, setSelectedNodeId } from '@/features/graph/graphSlice'

const normalizeGraphPayload = (value) => {
  const payload = value?.data || value || {}
  return {
    nodes: payload?.nodes || [],
    links: payload?.links || payload?.edges || [],
  }
}

const getNodeId = (node) => String(node?.id ?? node?._id ?? '')

const getLinkEndId = (value) => {
  if (value && typeof value === 'object') {
    return String(value.id ?? value._id ?? '')
  }

  return String(value ?? '')
}

const getLinkKey = (link) => {
  const source = getLinkEndId(link?.source)
  const target = getLinkEndId(link?.target)
  return `${source}::${target}`
}

const mergeNodes = (existingNodes, incomingNodes) => {
  const map = new Map(existingNodes.map((node) => [getNodeId(node), node]))

  incomingNodes.forEach((node) => {
    const nodeId = getNodeId(node)
    if (!nodeId) {
      return
    }

    map.set(nodeId, {
      ...(map.get(nodeId) || {}),
      ...node,
    })
  })

  return Array.from(map.values())
}

const mergeLinks = (existingLinks, incomingLinks) => {
  const map = new Map(existingLinks.map((link) => [getLinkKey(link), link]))

  incomingLinks.forEach((link) => {
    const linkKey = getLinkKey(link)
    if (!linkKey) {
      return
    }

    map.set(linkKey, {
      ...(map.get(linkKey) || {}),
      ...link,
    })
  })

  return Array.from(map.values())
}

/**
 * Graph state selector and graph interaction handlers.
 */
export function useGraphData() {
  const dispatch = useDispatch()
  const [fetchNeighbors] = useLazyGetNeighborsQuery()

  const { nodes, links, selectedNodeId, expandedNodeIds, isLoading } = useSelector((state) => state.graph)

  const handleNeighborExpand = useCallback(
    async (nodeId) => {
      if (!nodeId || expandedNodeIds.includes(nodeId)) {
        return
      }

      dispatch(setGraphLoading(true))

      try {
        const result = await fetchNeighbors(nodeId).unwrap()
        const payload = normalizeGraphPayload(result)
        const nextNodes = mergeNodes(nodes, payload.nodes)
        const nextLinks = mergeLinks(links, payload.links)

        dispatch(
          setGraphData({
            nodes: nextNodes,
            links: nextLinks,
          }),
        )
        dispatch(addExpandedNodeId(nodeId))
      } catch (error) {
        // Graph includes collection nodes; neighbor endpoint supports item subgraphs only.
        // Ignore expected 404s to avoid unhandled promise noise in the console.
        if (error?.status !== 404) {
          throw error
        }
      } finally {
        dispatch(setGraphLoading(false))
      }
    },
    [dispatch, expandedNodeIds, fetchNeighbors, links, nodes],
  )

  const handleNodeClick = useCallback(
    async (node) => {
      const nodeId = getNodeId(node)
      if (!nodeId) {
        return
      }

      dispatch(setSelectedNodeId(nodeId))

      const nodeType = String(node?.type || '').toLowerCase()
      if (nodeType && nodeType !== 'item') {
        return
      }

      await handleNeighborExpand(nodeId)
    },
    [dispatch, handleNeighborExpand],
  )

  const clearSelection = useCallback(() => {
    dispatch(setSelectedNodeId(null))
  }, [dispatch])

  return {
    nodes,
    links,
    selectedNodeId,
    isLoading,
    handleNodeClick,
    handleNeighborExpand,
    clearSelection,
  }
}

export default useGraphData
