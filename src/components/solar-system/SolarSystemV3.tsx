'use client'

import { lazy, Suspense, useMemo } from 'react'
import * as THREE from 'three'
import Sun from './Sun'
import EphemerisPlanet from './EphemerisPlanet'
import EphemerisOrbitLine from './EphemerisOrbitLine'
import EphemerisCameraController, {
  SimulationKeyboardControls,
} from './EphemerisCameraController'
import StarField from './StarField'
import SoundManager from './SoundManager'
import { planets } from './data'
import { useExperienceStore } from './experience-store'
import {
  SCENE_LOAD_STAGES,
  useSceneLoadStage,
} from './SceneLoadScheduler'

const BackgroundScene = lazy(() => import('./scene/BackgroundScene'))
const PhenomenaScene = lazy(() => import('./scene/PhenomenaScene'))
const SmallBodiesScene = lazy(() => import('./scene/SmallBodiesScene'))
const OuterFieldsScene = lazy(() => import('./scene/OuterFieldsScene'))
const ArtifactsScene = lazy(() => import('./scene/ArtifactsScene'))
const SandboxScene = lazy(() => import('./scene/SandboxScene'))

function EclipticReferenceGrid() {
  const mode = useExperienceStore((state) => state.mode)
  const showOrbitalPlanes = useExperienceStore((state) => state.showOrbitalPlanes)
  const positions = useMemo(() => {
    const size = 120
    const divisions = 48
    const step = (size * 2) / divisions
    const values: number[] = []

    for (let index = 0; index <= divisions; index += 1) {
      const offset = -size + index * step
      values.push(-size, 0, offset, size, 0, offset)
      values.push(offset, 0, -size, offset, 0, size)
    }

    return new Float32Array(values)
  }, [])

  if (mode !== 'scientific' || !showOrbitalPlanes) return null

  return (
    <group>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#4f7ecf"
          transparent
          opacity={0.075}
          depthWrite={false}
        />
      </lineSegments>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <circleGeometry args={[118, 96]} />
        <meshBasicMaterial
          color="#18345f"
          transparent
          opacity={0.022}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default function SolarSystemV3() {
  const stage = useSceneLoadStage()
  const mode = useExperienceStore((state) => state.mode)

  return (
    <>
      <ambientLight intensity={mode === 'scientific' ? 0.34 : 0.42} />

      <EphemerisCameraController />
      <SimulationKeyboardControls />
      <SoundManager />
      <EclipticReferenceGrid />
      <StarField />

      <Sun />
      {planets.map((planet) => (
        <EphemerisOrbitLine
          key={`orbit-${planet.id}`}
          bodyId={planet.id}
          color={planet.color}
          opacity={0.075}
        />
      ))}
      {planets.map((planet) => (
        <EphemerisPlanet key={planet.id} data={planet} />
      ))}

      {stage >= SCENE_LOAD_STAGES.background ? (
        <Suspense fallback={null}>
          <BackgroundScene />
        </Suspense>
      ) : null}

      {stage >= SCENE_LOAD_STAGES.phenomena ? (
        <Suspense fallback={null}>
          <PhenomenaScene />
        </Suspense>
      ) : null}

      {stage >= SCENE_LOAD_STAGES.smallBodies ? (
        <Suspense fallback={null}>
          <SmallBodiesScene />
        </Suspense>
      ) : null}

      {stage >= SCENE_LOAD_STAGES.outerFields ? (
        <Suspense fallback={null}>
          <OuterFieldsScene />
        </Suspense>
      ) : null}

      {stage >= SCENE_LOAD_STAGES.sandbox && mode === 'sandbox' ? (
        <Suspense fallback={null}>
          <SandboxScene />
        </Suspense>
      ) : null}

      {stage >= SCENE_LOAD_STAGES.artifacts && mode !== 'scientific' ? (
        <Suspense fallback={null}>
          <ArtifactsScene />
        </Suspense>
      ) : null}
    </>
  )
}
