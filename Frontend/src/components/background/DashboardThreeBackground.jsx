import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Grid, OrbitControls, Stage, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { easing } from 'maath'

const PRESET_CONFIG = {
  subtle: {
    mask: 'opacity-85 [mask-image:radial-gradient(circle_at_center,black_0%,black_50%,transparent_96%)]',
    rotateSpeed: 0.03,
    modelScale: 1.08,
  },
  medium: {
    mask: 'opacity-95 [mask-image:radial-gradient(circle_at_center,black_0%,black_56%,transparent_96%)]',
    rotateSpeed: 0.05,
    modelScale: 1.16,
  },
  bold: {
    mask: 'opacity-100 [mask-image:radial-gradient(circle_at_center,black_0%,black_62%,transparent_96%)]',
    rotateSpeed: 0.08,
    modelScale: 1.24,
  },
}

function Kamdo(props) {
  const head = useRef()
  const body = useRef()
  const stripe = useRef()
  const light = useRef()
  const pointerRef = props.pointerRef
  const { nodes, materials } = useGLTF('/s2wt_kamdo_industrial_divinities-transformed.glb')

  useFrame((state, delta) => {
    const t = (1 + Math.sin(state.clock.elapsedTime * 2)) / 2
    const pointer = pointerRef?.current || { x: 0, y: 0 }

    if (stripe.current) {
      stripe.current.color.setRGB(2 + t * 20, 2, 20 + t * 50)
    }
    if (head.current) {
      easing.dampE(head.current.rotation, [pointer.y * 0.16, pointer.x * 0.72, 0], 0.28, delta)
    }
    if (body.current) {
      easing.damp3(body.current.position, [pointer.x * 0.22, pointer.y * 0.12, 0], 0.22, delta)
    }
    if (light.current) {
      light.current.intensity = 1 + t * 4
    }
  })

  return (
    <group {...props} ref={body}>
      <mesh castShadow receiveShadow geometry={nodes.body001.geometry} material={materials.Body} />
      <group ref={head}>
        <mesh castShadow receiveShadow geometry={nodes.head001.geometry} material={materials.Head} />
        <mesh castShadow receiveShadow geometry={nodes.stripe001.geometry}>
          <meshBasicMaterial ref={stripe} toneMapped={false} />
          <pointLight ref={light} intensity={1} color={[10, 2, 5]} distance={2.5} />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload('/s2wt_kamdo_industrial_divinities-transformed.glb')

function Overlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-6 top-6 rounded-md border border-white/15 bg-black/25 px-3 py-2 text-[11px] font-medium tracking-[0.08em] text-white/80 backdrop-blur-sm">
        S2WT KAMDO
      </div>
      <div className="absolute bottom-6 right-6 text-[11px] text-white/70">04/04/2026</div>
    </div>
  )
}

export function DashboardThreeBackground({ preset = 'medium' }) {
  const config = useMemo(() => PRESET_CONFIG[preset] || PRESET_CONFIG.medium, [preset])
  const [isLightMode, setIsLightMode] = useState(false)
  const pointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const root = document.documentElement
    if (!root) return undefined

    const applyTheme = () => {
      const hasDarkClass = root.classList.contains('dark')
      const prefersDark = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false
      setIsLightMode(!(hasDarkClass || prefersDark))
    }

    applyTheme()

    const observer = new MutationObserver(() => applyTheme())
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => {
      observer.disconnect()
    }
  }, [])

  const scenePalette = isLightMode
    ? {
        containerBg: '#f4f1ff',
        fog: '#ebe7ff',
        ambient: '#6f58d8',
        directional: '#7f67f0',
        environment: 'city',
        overlay:
          'radial-gradient(ellipse_at_20%_15%,rgba(126,92,255,0.20),transparent_45%),radial-gradient(ellipse_at_80%_20%,rgba(103,67,220,0.16),transparent_44%),linear-gradient(to_bottom,rgba(244,241,255,0.12),rgba(228,223,255,0.38))',
        lineColorA: 'rgba(61, 23, 104, 0.34)',
        lineColorB: 'rgba(78, 34, 134, 0.26)',
        blendMode: 'multiply',
      }
    : {
        containerBg: '#010103',
        fog: '#03020a',
        ambient: '#7260ff',
        directional: '#8c7dff',
        environment: 'night',
        overlay:
          'radial-gradient(ellipse_at_20%_15%,rgba(91,33,182,0.22),transparent_45%),radial-gradient(ellipse_at_80%_20%,rgba(59,7,100,0.26),transparent_44%),linear-gradient(to_bottom,rgba(1,1,3,0.2),rgba(1,1,3,0.7))',
        lineColorA: 'rgba(58, 16, 94, 0.50)',
        lineColorB: 'rgba(44, 10, 76, 0.42)',
        blendMode: 'screen',
      }

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${config.mask}`}
      style={{ backgroundColor: scenePalette.containerBg }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: scenePalette.overlay }} />
      <div
        className="pointer-events-none absolute inset-[-8%] opacity-70"
        style={{
          backgroundImage:
            `repeating-linear-gradient(90deg, ${scenePalette.lineColorA} 0px, ${scenePalette.lineColorA} 1px, transparent 1px, transparent 42px), repeating-linear-gradient(0deg, ${scenePalette.lineColorB} 0px, ${scenePalette.lineColorB} 1px, transparent 1px, transparent 36px)`,
          mixBlendMode: scenePalette.blendMode,
        }}
      />
      <Canvas flat shadows dpr={[1, 1.5]} camera={{ position: [-11.5, 1.2, 8.2], fov: 22 }}>
        <fog attach="fog" args={[scenePalette.fog, 12, 24]} />
        <ambientLight intensity={isLightMode ? 0.28 : 0.18} color={scenePalette.ambient} />
        <directionalLight position={[6, 8, 5]} intensity={isLightMode ? 0.7 : 0.55} color={scenePalette.directional} />
        <Stage intensity={isLightMode ? 0.45 : 0.32} environment={scenePalette.environment} shadows={{ type: 'accumulative', bias: -0.0015, intensity: 0.65 }} adjustCamera={false}>
          <Kamdo pointerRef={pointerRef} scale={config.modelScale} position={[0, -0.15, 0]} rotation={[0, Math.PI, 0]} />
        </Stage>
        <Grid
          renderOrder={-1}
          position={[0, -1.95, 0]}
          infiniteGrid
          cellSize={0.58}
          cellThickness={0.75}
          sectionSize={3.2}
          sectionThickness={1.7}
          sectionColor={[0.9, 0.3, 1.8]}
          cellColor={[0.2, 0.08, 0.65]}
          fadeDistance={26}
        />
        <OrbitControls
          autoRotate={false}
          autoRotateSpeed={config.rotateSpeed}
          enableRotate={false}
          enablePan={false}
          enableZoom={false}
          makeDefault
          minPolarAngle={Math.PI / 2.06}
          maxPolarAngle={Math.PI / 1.98}
        />
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1.3} intensity={0.7} mipmapBlur />
          <ToneMapping />
        </EffectComposer>
        <Environment background preset={scenePalette.environment} blur={isLightMode ? 0.82 : 0.92} />
      </Canvas>
      <Overlay />
    </div>
  )
}

export default DashboardThreeBackground
