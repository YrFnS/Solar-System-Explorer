'use client'

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react'
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

const BackgroundScene = lazy(() => import('./scene/BackgroundScene'))
const PhenomenaScene = lazy(() => import('./scene/PhenomenaScene'))
const SmallBodiesScene = lazy(() => import('./scene/SmallBodiesScene'))
const OuterFieldsScene = lazy(() => import('./scene/OuterFieldsScene'))
const ArtifactsScene = lazy(() => import('./scene/ArtifactsScene'))
const SandboxScene = lazy(() => import('./scene/SandboxScene'))

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

function useSceneStage() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const idleWindow = window as IdleWindow
    const idleHandles: number[] = []
    const timers: number[] = []
    let cancelled = false

    const scheduleStage = (nextStage: number, delay: number) => {
      const timer = window.setTimeout(() => {
        if (cancelled) return

        if (idleWindow.requestIdleCallback) {
          const idleHandle = idleWindow.requestIdleCallback(
            () => {
              if (!cancelled) setStage(nextStage)
            },
            { timeout: 650 }
          )
          idleHandles.push(idleHandle)
          return
        }

        setStage(nextStage)
      }, delay)
      timers.push(timer)
    }

    scheduleStage(1, 70)
    scheduleStage(2, 360)
    scheduleStage(3, 950)

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
      idleHandles.forEach((handle) => idleWindow.cancelIdleCallback?.(handle))
    }
  }, [])

  return stage
}

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
  const stage = useSceneStage()
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

      {stage >= 1 ? (
        <Suspense fallback={null}>
          <BackgroundScene />
          <PhenomenaScene />
        </Suspense>
      ) : null}

      {stage >= 2 ? (
        <Suspense fallback={null}>
          <SmallBodiesScene />
          <OuterFieldsScene />
          {mode === 'sandbox' ? <SandboxScene /> : null}
        </Suspense>
      ) : null}

      {stage >= 3 && mode !== 'scientific' ? (
        <Suspense fallback={null}>
          <ArtifactsScene />
        </Suspense>
      ) : null}
    </>
  )
}
