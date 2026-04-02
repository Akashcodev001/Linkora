import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useGetGraphQuery } from '@/app/api/graphApi'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Skeleton from '@/components/ui/Skeleton'
import Spinner from '@/components/ui/Spinner'
import useGraphData from '@/hooks/useGraphData'
import { setGraphData } from '@/features/graph/graphSlice'
import { useDispatch } from 'react-redux'
import { Network } from 'lucide-react'

const ForceGraph2D = lazy(() => import('react-force-graph-2d'))

const normalizeGraphPayload = (response) => {
  const payload = response?.data || response || {}
  return {
    nodes: payload?.nodes || [],
    links: payload?.links || payload?.edges || [],
    stats: payload?.stats || {},
  }
}

function GraphCanvasSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-[560px] w-full" />
    </div>
  )
}

export function GraphPage() {
  const dispatch = useDispatch()
  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 980, height: 560 })
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 1024)
  const [performanceMode, setPerformanceMode] = useState(true)
  const [zoomK, setZoomK] = useState(1)

  const {
    data: rawGraph,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetGraphQuery({ maxNodes: 100, maxEdges: 800 })

  const baseGraph = normalizeGraphPayload(rawGraph)

  const {
    nodes,
    links,
    selectedNodeId,
    isLoading: neighborLoading,
    handleNodeClick,
    clearSelection,
  } = useGraphData()

  useEffect(() => {
    if (!baseGraph?.nodes?.length) {
      return
    }

    dispatch(
      setGraphData({
        nodes: baseGraph.nodes,
        links: baseGraph.links,
      }),
    )
  }, [dispatch, baseGraph.nodes, baseGraph.links])

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) {
        return
      }

      const nextWidth = Math.max(320, Math.floor(containerRef.current.clientWidth))
      const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 1024
      setDimensions({ width: nextWidth, height: 560 })
      setIsMobile(isMobileScreen)
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const graphData = useMemo(() => {
    if (!performanceMode || nodes.length <= 180) {
      return {
        nodes,
        links,
      }
    }

    const getLinkEndId = (value) => {
      if (value && typeof value === 'object') {
        return String(value.id ?? value._id ?? '')
      }
      return String(value ?? '')
    }

    const nodeDegree = new Map(nodes.map((node) => [String(node?.id), 0]))
    links.forEach((link) => {
      const src = getLinkEndId(link?.source)
      const dst = getLinkEndId(link?.target)
      nodeDegree.set(src, (nodeDegree.get(src) || 0) + 1)
      nodeDegree.set(dst, (nodeDegree.get(dst) || 0) + 1)
    })

    const selectedId = String(selectedNodeId || '')
    const pinnedIds = new Set()
    if (selectedId) {
      pinnedIds.add(selectedId)
      links.forEach((link) => {
        const src = getLinkEndId(link?.source)
        const dst = getLinkEndId(link?.target)
        if (src === selectedId) pinnedIds.add(dst)
        if (dst === selectedId) pinnedIds.add(src)
      })
    }

    const collectionNodes = nodes.filter((node) => node?.type === 'collection')
    const itemNodes = nodes
      .filter((node) => node?.type !== 'collection')
      .sort((a, b) => (nodeDegree.get(String(b?.id)) || 0) - (nodeDegree.get(String(a?.id)) || 0))

    const nodeBudget = zoomK < 0.8 ? 180 : zoomK < 1.3 ? 260 : 360
    const picked = []
    const seen = new Set()

    const pick = (node) => {
      const id = String(node?.id || '')
      if (!id || seen.has(id) || picked.length >= nodeBudget) return
      picked.push(node)
      seen.add(id)
    }

    collectionNodes.forEach(pick)
    nodes.forEach((node) => {
      if (pinnedIds.has(String(node?.id))) {
        pick(node)
      }
    })
    itemNodes.forEach(pick)

    const pickedIds = new Set(picked.map((node) => String(node?.id)))
    const filteredLinks = links.filter((link) => {
      const src = getLinkEndId(link?.source)
      const dst = getLinkEndId(link?.target)
      return pickedIds.has(src) && pickedIds.has(dst)
    })

    return {
      nodes: picked,
      links: filteredLinks,
    }
  }, [links, nodes, performanceMode, selectedNodeId, zoomK])

  const forceGraphData = useMemo(() => {
    const toEndpointId = (value) => {
      if (value && typeof value === 'object') {
        const id = value.id ?? value._id
        return id != null ? String(id) : ''
      }
      return value
    }

    return {
      // react-force-graph mutates node/link objects (e.g. x/y/__indexColor),
      // so we pass fresh mutable copies instead of frozen RTK state objects.
      nodes: graphData.nodes.map((node) => ({ ...node })),
      links: graphData.links.map((link) => ({
        ...link,
        source: toEndpointId(link?.source),
        target: toEndpointId(link?.target),
      })),
    }
  }, [graphData])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const nodeIds = new Set(graphData.nodes.map((node) => String(node?.id || '')))
    const degreeByNodeId = new Map([...nodeIds].map((id) => [id, 0]))

    const toId = (value) => {
      if (value && typeof value === 'object') {
        return String(value.id ?? value._id ?? '')
      }
      return String(value ?? '')
    }

    graphData.links.forEach((link) => {
      const sourceId = toId(link?.source)
      const targetId = toId(link?.target)
      if (degreeByNodeId.has(sourceId)) {
        degreeByNodeId.set(sourceId, Number(degreeByNodeId.get(sourceId) || 0) + 1)
      }
      if (degreeByNodeId.has(targetId)) {
        degreeByNodeId.set(targetId, Number(degreeByNodeId.get(targetId) || 0) + 1)
      }
    })

    const points = graphData.nodes.map((node, index) => {
      const id = String(node?.id || '')
      return {
        id,
        label: node?.label || 'Node',
        x: index,
        y: Number(degreeByNodeId.get(id) || 0),
        type: node?.type || 'unknown',
      }
    })

    const links = graphData.links.map((link) => ({
      source: toId(link?.source),
      target: toId(link?.target),
    }))

    const exportPayload = {
      mode: '2d',
      axes: ['x', 'y'],
      generatedAt: new Date().toISOString(),
      points,
      links,
    }

    let script = document.getElementById('linkora-graph-export')
    if (!script) {
      script = document.createElement('script')
      script.id = 'linkora-graph-export'
      script.type = 'application/json'
      document.body.appendChild(script)
    }

    script.textContent = JSON.stringify(exportPayload)

    return () => {
      const current = document.getElementById('linkora-graph-export')
      if (current) {
        current.remove()
      }
    }
  }, [graphData.links, graphData.nodes])

  const selectedNode = useMemo(() => {
    return nodes.find((node) => String(node?.id) === String(selectedNodeId)) || null
  }, [nodes, selectedNodeId])

  const relationCount = useMemo(() => {
    if (!selectedNodeId) {
      return 0
    }

    return links.filter((link) => {
      const source = String(link?.source?.id || link?.source)
      const target = String(link?.target?.id || link?.target)
      return source === String(selectedNodeId) || target === String(selectedNodeId)
    }).length
  }, [links, selectedNodeId])

  if (isLoading) {
    return <GraphCanvasSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load graph"
        message={error?.data?.message || 'Please try again.'}
        onRetry={refetch}
      />
    )
  }

  if (!nodes.length) {
    return (
      <EmptyState
        icon={Network}
        title="No graph data yet"
        description="Save and process more items to generate relationships."
      />
    )
  }

  if (isMobile) {
    return (
      <Card padding="comfortable" className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-text-primary">Knowledge Graph</h1>
          <p className="text-sm text-text-secondary">
            {baseGraph.stats?.nodeCount || nodes.length} nodes • {baseGraph.stats?.edgeCount || links.length} links
          </p>
        </div>

        <EmptyState
          icon={Network}
          title="Graph not available on mobile"
          description="The graph visualization requires a larger screen. Try viewing on desktop or tablet for the best experience."
          ctaLabel="View in collections instead"
          onCtaClick={() => {
            /* no-op, user can navigate manually */
          }}
        />
      </Card>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card padding="comfortable" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Knowledge Graph</h1>
            <p className="text-sm text-text-secondary">
              {baseGraph.stats?.nodeCount || nodes.length} nodes • {baseGraph.stats?.edgeCount || links.length} links
            </p>
          </div>
          <div className="flex items-center gap-2">
            {neighborLoading ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
                <Spinner size={12} /> Expanding
              </span>
            ) : null}
            <Button
              size="sm"
              variant={performanceMode ? 'default' : 'ghost'}
              onClick={() => setPerformanceMode((prev) => !prev)}
            >
              {performanceMode ? 'Perf: On' : 'Perf: Off'}
            </Button>
            <Button size="sm" variant="ghost" onClick={refetch}>
              Refresh
            </Button>
          </div>
        </div>

        <div ref={containerRef} className="overflow-hidden rounded-default border border-border bg-surface-2">
          <Suspense fallback={<Skeleton className="h-[560px] w-full" />}>
            <ForceGraph2D
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={forceGraphData}
              nodeLabel={(node) => `${node?.label || 'Node'} (${node?.type || 'unknown'})`}
              nodeAutoColorBy="type"
              linkColor={() => '#cbd5e1'}
              linkDirectionalParticles={0}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const radius = selectedNodeId && String(node?.id) === String(selectedNodeId) ? 6 : 4
                ctx.beginPath()
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
                ctx.fillStyle = node?.color || '#f97316'
                ctx.fill()

                ctx.lineWidth = selectedNodeId && String(node?.id) === String(selectedNodeId) ? 2 : 1
                ctx.strokeStyle = selectedNodeId && String(node?.id) === String(selectedNodeId) ? '#ea580c' : 'rgba(15, 23, 42, 0.25)'
                ctx.stroke()

                if (globalScale < 1 && performanceMode) {
                  return
                }

                const label = node?.label || 'Node'
                const fontSize = 10 / Math.max(globalScale, 0.6)
                ctx.font = `${fontSize}px sans-serif`
                const textWidth = ctx.measureText(label).width
                const bckgDimensions = [textWidth + 8, fontSize + 6]

                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
                ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + radius + 2, bckgDimensions[0], bckgDimensions[1])

                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = '#334155'
                ctx.fillText(label, node.x, node.y + radius + 2 + bckgDimensions[1] / 2)
              }}
              onNodeClick={handleNodeClick}
              onZoom={({ k }) => setZoomK(k)}
              cooldownTicks={120}
            />
          </Suspense>
        </div>
      </Card>

      <Card padding="comfortable" className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Node Details</h2>
        {!selectedNode ? (
          <p className="text-sm text-text-secondary">Click any node to inspect and expand its neighborhood.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">{selectedNode?.label || 'Unnamed node'}</p>
            <p className="text-xs text-text-secondary">Type: {selectedNode?.type || 'unknown'}</p>
            <p className="text-xs text-text-secondary">Category: {selectedNode?.category || 'n/a'}</p>
            <p className="text-xs text-text-secondary">Connections: {relationCount}</p>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Clear selection
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

export default GraphPage
