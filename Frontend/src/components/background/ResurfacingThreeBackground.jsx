import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Grid, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { easing } from 'maath'

function KamdoInspiredRig() {
  const head = useRef(null)
  const stripe = useRef(null)
  const light = useRef(null)

  useFrame((state, delta) => {
    const t = (1 + Math.sin(state.clock.elapsedTime * 2)) / 2
    if (stripe.current?.color) {
      stripe.current.color.setRGB(0.8 + t * 1.4, 0.35, 1.2 + t * 2)
    }
    if (head.current?.rotation) {
      easing.dampE(
        head.current.rotation,
        [0.04, state.pointer.x * (state.camera.position.z > 1 ? 0.22 : -0.22), 0],
        0.35,
        delta,
      )
    }
    if (light.current) {
      light.current.intensity = 0.9 + t * 1.8
    }
  })

  return (
    <group rotation={[0, Math.PI, 0]}>
      <mesh castShadow receiveShadow position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.65, 0.9, 1.55, 42]} />
        <meshStandardMaterial color="#5b6478" metalness={0.85} roughness={0.24} />
      </mesh>

      <group ref={head} position={[0, 0.6, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.55, 48, 48]} />
          <meshStandardMaterial color="#8b98ad" metalness={0.8} roughness={0.2} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 0.08, 0.58]}>
          <torusGeometry args={[0.22, 0.04, 24, 80]} />
          <meshBasicMaterial ref={stripe} toneMapped={false} color="#b347ff" />
          <pointLight ref={light} intensity={1} color={[2.5, 1, 5]} distance={3.4} />
        </mesh>
      </group>
    </group>
  )
}

export function ResurfacingThreeBackground() {
  return (
    <div className="h-full w-full opacity-75 [mask-image:radial-gradient(circle_at_center,black_0%,black_58%,transparent_95%)]">
      <Canvas flat shadows camera={{ position: [-8, 0.45, 6.8], fov: 29 }} dpr={[1, 1.4]}>
        <fog attach="fog" args={['#070b14', 10, 24]} />

        <ambientLight intensity={0.3} />

        <group scale={1.25} position={[0, 0.35, 0]}>
          <KamdoInspiredRig />
        </group>

        <Grid
          renderOrder={-1}
          position={[0, -1.85, 0]}
          infiniteGrid
          cellSize={0.6}
          cellThickness={0.42}
          sectionSize={3.2}
          sectionThickness={1.1}
          sectionColor={[0.45, 0.48, 0.75]}
          fadeDistance={30}
        />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.07}
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
        />

        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1.1} intensity={0.6} mipmapBlur />
          <ToneMapping />
        </EffectComposer>

        <Environment preset="sunset" blur={0.86} />
      </Canvas>
    </div>
  )
}

export default ResurfacingThreeBackground
