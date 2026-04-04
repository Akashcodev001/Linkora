import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import dashboardModelImage from '../../../thumbnail.png'

const PRESET_CONFIG = {
  subtle: {
    mask: 'opacity-85 [mask-image:radial-gradient(circle_at_center,black_0%,black_50%,transparent_96%)]',
    intensity: 10,
  },
  medium: {
    mask: 'opacity-95 [mask-image:radial-gradient(circle_at_center,black_0%,black_56%,transparent_96%)]',
    intensity: 16,
  },
  bold: {
    mask: 'opacity-100 [mask-image:radial-gradient(circle_at_center,black_0%,black_62%,transparent_96%)]',
    intensity: 24,
  },
}

export function DashboardThreeBackground({ preset = 'medium' }) {
  const config = useMemo(() => PRESET_CONFIG[preset] || PRESET_CONFIG.medium, [preset])
  const containerRef = useRef(null)
  const cardRef = useRef(null)
  const backgroundFarRef = useRef(null)
  const backgroundMidRef = useRef(null)
  const gridRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !cardRef.current) return undefined

    const container = d3.select(containerRef.current)
    const card = d3.select(cardRef.current)
    const far = d3.select(backgroundFarRef.current)
    const mid = d3.select(backgroundMidRef.current)
    const grid = d3.select(gridRef.current)

    const onMove = (event) => {
      const { width, height } = containerRef.current.getBoundingClientRect()
      const x = (event.clientX / width - 0.5) * 2
      const y = (event.clientY / height - 0.5) * 2
      const tx = x * config.intensity
      const ty = y * config.intensity * 0.62
      const ry = x * 8
      const rx = -y * 5

      const farX = x * config.intensity * 0.18
      const farY = y * config.intensity * 0.12
      const midX = x * config.intensity * 0.34
      const midY = y * config.intensity * 0.22
      const gridX = x * config.intensity * 0.5
      const gridY = y * config.intensity * 0.28

      card
        .interrupt()
        .transition()
        .duration(120)
        .ease(d3.easeCubicOut)
        .style('transform', `translate3d(${tx}px, ${ty}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`)

      far
        .interrupt()
        .transition()
        .duration(180)
        .ease(d3.easeCubicOut)
        .style('transform', `translate3d(${farX}px, ${farY}px, 0)`)

      mid
        .interrupt()
        .transition()
        .duration(160)
        .ease(d3.easeCubicOut)
        .style('transform', `translate3d(${midX}px, ${midY}px, 0)`)

      grid
        .interrupt()
        .transition()
        .duration(130)
        .ease(d3.easeCubicOut)
        .style('transform', `translate3d(${gridX}px, ${gridY}px, 0)`)
    }

    const onLeave = () => {
      card
        .interrupt()
        .transition()
        .duration(220)
        .ease(d3.easeCubicOut)
        .style('transform', 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)')

      far
        .interrupt()
        .transition()
        .duration(260)
        .ease(d3.easeCubicOut)
        .style('transform', 'translate3d(0, 0, 0)')

      mid
        .interrupt()
        .transition()
        .duration(240)
        .ease(d3.easeCubicOut)
        .style('transform', 'translate3d(0, 0, 0)')

      grid
        .interrupt()
        .transition()
        .duration(220)
        .ease(d3.easeCubicOut)
        .style('transform', 'translate3d(0, 0, 0)')
    }

    container.on('mousemove', onMove)
    container.on('mouseleave', onLeave)

    return () => {
      container.on('mousemove', null)
      container.on('mouseleave', null)
    }
  }, [config.intensity])

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-[#050b18] ${config.mask}`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="d3-bg-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06122b" />
            <stop offset="60%" stopColor="#070f1d" />
            <stop offset="100%" stopColor="#03070f" />
          </linearGradient>
          <pattern id="d3-grid" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M 52 0 L 0 0 0 52" fill="none" stroke="#2f5fa6" strokeOpacity="0.45" strokeWidth="1.2" />
          </pattern>
        </defs>

        <g ref={backgroundFarRef} style={{ willChange: 'transform' }}>
          <rect width="1200" height="700" fill="url(#d3-bg-grad)" />
        </g>
        <g ref={backgroundMidRef} style={{ willChange: 'transform' }}>
          <ellipse cx="220" cy="170" rx="170" ry="120" fill="#1d4ed8" opacity="0.25" />
          <ellipse cx="960" cy="140" rx="130" ry="90" fill="#0ea5e9" opacity="0.12" />
        </g>
        <g ref={gridRef} style={{ willChange: 'transform' }}>
          <rect x="0" y="430" width="1200" height="270" fill="url(#d3-grid)" opacity="0.8" />
        </g>
      </svg>

      <div className="absolute inset-0 flex items-center justify-center [perspective:1000px]">
        <div
          ref={cardRef}
          className="relative h-[50%] w-[72%] max-w-[820px] min-h-[220px] rounded-xl border border-blue-500/30 shadow-[0_24px_80px_rgba(2,8,23,0.55)] will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <img
            src={dashboardModelImage}
            alt="Dashboard model"
            className="h-full w-full rounded-xl object-cover object-center"
            loading="eager"
          />
        </div>
      </div>
    </div>
  )
}

export default DashboardThreeBackground
