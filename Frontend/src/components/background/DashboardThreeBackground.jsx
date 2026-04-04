import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, useTexture } from '@react-three/drei'
import dashboardModelImage from '../../../thumbnail.png'

const PRESET_CONFIG = {
  subtle: {
    mask: 'opacity-85 [mask-image:radial-gradient(circle_at_center,black_0%,black_50%,transparent_96%)]',
    intensity: 0.12,
  },
  medium: {
    mask: 'opacity-95 [mask-image:radial-gradient(circle_at_center,black_0%,black_56%,transparent_96%)]',
    intensity: 0.18,
  },
  bold: {
    mask: 'opacity-100 [mask-image:radial-gradient(circle_at_center,black_0%,black_62%,transparent_96%)]',
    intensity: 0.25,
  },
}

function CursorResponsivePoster({ intensity }) {
  const meshRef = useRef(null)
  const texture = useTexture(dashboardModelImage)

  useFrame((state, delta) => {
    if (!meshRef.current) return

    const targetX = state.pointer.x * intensity
    const targetY = state.pointer.y * intensity * 0.6

    meshRef.current.position.x += (targetX - meshRef.current.position.x) * Math.min(1, delta * 4)
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * Math.min(1, delta * 4)

    meshRef.current.rotation.y += ((state.pointer.x * 0.2) - meshRef.current.rotation.y) * Math.min(1, delta * 4)
    meshRef.current.rotation.x += ((-state.pointer.y * 0.12) - meshRef.current.rotation.x) * Math.min(1, delta * 4)
  })

  return (
    <mesh ref={meshRef} position={[0, 0.15, 0]}>
      <planeGeometry args={[6.8, 3.8, 32, 32]} />
      <meshStandardMaterial map={texture} metalness={0.08} roughness={0.7} />
    </mesh>
  )
}

export function DashboardThreeBackground({ preset = 'medium' }) {
  const config = useMemo(() => PRESET_CONFIG[preset] || PRESET_CONFIG.medium, [preset])

  return (
    <div className={`h-full w-full ${config.mask}`}>
      <Canvas camera={{ position: [0, 0.25, 5.4], fov: 42 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#050b18']} />
        <fog attach="fog" args={['#050b18', 5, 12]} />

        <ambientLight intensity={0.55} />
        <directionalLight position={[2.2, 2.4, 2.4]} intensity={1.2} />
        <pointLight position={[-2.8, 0.9, 1.4]} color="#3b82f6" intensity={1.3} />

        <CursorResponsivePoster intensity={config.intensity} />

        <Grid
          renderOrder={-1}
          position={[0, -2.1, 0]}
          infiniteGrid
          cellSize={0.65}
          cellThickness={0.45}
          sectionSize={3.2}
          sectionThickness={1.05}
          sectionColor={[0.35, 0.45, 0.95]}
          fadeDistance={24}
        />
      </Canvas>
    </div>
  )
}

export default DashboardThreeBackground
