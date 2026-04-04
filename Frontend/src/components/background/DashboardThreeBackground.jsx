import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, OrbitControls, Stage } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { easing } from 'maath'

const PRESET_CONFIG = {
  subtle: {
    mask: 'opacity-28 [mask-image:radial-gradient(circle_at_center,black_0%,black_52%,transparent_95%)]',
    stageIntensity: 0.36,
    autoRotateSpeed: 0.02,
    bloomIntensity: 0.4,
    movement: 0.08,
  },
  medium: {
    mask: 'opacity-38 [mask-image:radial-gradient(circle_at_center,black_0%,black_58%,transparent_95%)]',
    stageIntensity: 0.48,
    autoRotateSpeed: 0.03,
    bloomIntensity: 0.62,
    movement: 0.14,
  },
  bold: {
    mask: 'opacity-50 [mask-image:radial-gradient(circle_at_center,black_0%,black_62%,transparent_95%)]',
    stageIntensity: 0.6,
    autoRotateSpeed: 0.045,
    bloomIntensity: 0.85,
    movement: 0.22,
  },
}

function KamdoModel({ movement = 0.14, ...props }) {
  const rig = useRef(null)
  const head = useRef(null)
  const stripe = useRef(null)
  const light = useRef(null)
  const cursorRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (event) => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1
      const ny = (event.clientY / window.innerHeight) * 2 - 1
      cursorRef.current = { x: nx, y: ny }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((state, delta) => {
    const cursor = cursorRef.current
    const t = (1 + Math.sin(state.clock.elapsedTime * 2)) / 2

    if (rig.current?.position) {
      easing.damp3(
        rig.current.position,
        [cursor.x * movement, -0.05 + cursor.y * -movement * 0.28, 0],
        0.4,
        delta,
      )
    }
    if (rig.current?.rotation) {
      easing.dampE(rig.current.rotation, [cursor.y * -movement * 0.2, Math.PI + cursor.x * movement * 0.35, 0], 0.35, delta)
    }

    if (stripe.current?.color) {
      stripe.current.color.setRGB(2 + t * 20, 2, 20 + t * 50)
    }
    if (head.current?.rotation) {
      easing.dampE(head.current.rotation, [cursor.y * -0.05, cursor.x * 0.28, 0], 0.3, delta)
    }
    if (light.current) {
      light.current.intensity = 1 + t * 4
    }
  })

  return (
    <group ref={rig} {...props}>
      <mesh castShadow receiveShadow position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.65, 0.86, 1.5, 40]} />
        <meshStandardMaterial color="#5f6f8a" metalness={0.82} roughness={0.24} />
      </mesh>
      <group ref={head}>
        <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.52, 48, 48]} />
          <meshStandardMaterial color="#8f9eb2" metalness={0.78} roughness={0.2} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.62, 0.56]}>
          <torusGeometry args={[0.2, 0.04, 24, 90]} />
          <meshBasicMaterial ref={stripe} toneMapped={false} />
          <pointLight ref={light} intensity={1} color={[10, 2, 5]} distance={2.5} />
        </mesh>
      </group>
    </group>
  )
}

export function DashboardThreeBackground({ preset = 'medium' }) {
  const config = useMemo(() => PRESET_CONFIG[preset] || PRESET_CONFIG.medium, [preset])

  return (
    <div className={`h-full w-full ${config.mask}`}>
      <Canvas flat shadows camera={{ position: [-15, 0, 10], fov: 25 }} dpr={[1, 1.4]}>
        <fog attach="fog" args={['black', 15, 22.5]} />
        <Suspense fallback={null}>
          <Stage
            intensity={config.stageIntensity}
            environment={null}
            shadows={{ type: 'accumulative', bias: -0.001, intensity: Math.PI }}
            adjustCamera={false}
          >
            <KamdoModel movement={config.movement} />
          </Stage>
        </Suspense>
        <Grid
          renderOrder={-1}
          position={[0, -1.85, 0]}
          infiniteGrid
          cellSize={0.6}
          cellThickness={0.5}
          sectionSize={3.3}
          sectionThickness={1.3}
          sectionColor={[0.5, 0.5, 10]}
          fadeDistance={30}
        />
        <OrbitControls
          autoRotate
          autoRotateSpeed={config.autoRotateSpeed}
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
        />
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={2} intensity={config.bloomIntensity} mipmapBlur />
          <ToneMapping />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

export default DashboardThreeBackground
