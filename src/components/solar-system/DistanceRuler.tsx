'use client'

import { useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  ASTRONOMICAL_UNIT_KM,
  getBodyTelemetry,
  getBodyVisualPosition,
} from './ephemeris'
import { useExperienceStore } from './experience-store'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return 'Visual separation'
  if (distanceKm >= 1_000_000_000) return `${(distanceKm / 1_000_000_000).toFixed(2)} billion km`
  if (distanceKm >= 1_000_000) return `${(distanceKm / 1_000_000).toFixed(2)} million km`
  return `${Math.round(distanceKm).toLocaleString()} km`
}

function physicalVectorFromTelemetry(
  visualPosition: THREE.Vector3,
  distanceAu: number | null,
  target: THREE.Vector3
) {
  if (distanceAu === null) return null
  if (distanceAu === 0) return target.set(0, 0, 0)
  if (visualPosition.lengthSq() < 1e-10) return null
  return target.copy(visualPosition).normalize().multiplyScalar(distanceAu)
}

function DistanceRulerInner({ body1, body2 }: { body1: string; body2: string }) {
  const lineRef = useRef<THREE.LineSegments>(null)
  const labelRef = useRef<THREE.Group>(null)
  const p1Ref = useRef(new THREE.Vector3())
  const p2Ref = useRef(new THREE.Vector3())
  const physical1Ref = useRef(new THREE.Vector3())
  const physical2Ref = useRef(new THREE.Vector3())
  const midpointRef = useRef(new THREE.Vector3())
  const publishElapsedRef = useRef(Number.POSITIVE_INFINITY)
  const [distanceText, setDistanceText] = useState('Visual separation')
  const mode = useExperienceStore((state) => state.mode)

  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    return next
  }, [])

  useFrameLane({
    id: `distance-ruler:${body1}:${body2}`,
    lane: 'critical',
    priority: -5,
  }, ({ simulationDateMs, renderDelta }) => {
    if (!lineRef.current) return

    const p1 = getBodyVisualPosition(body1, simulationDateMs, mode, p1Ref.current)
    const p2 = getBodyVisualPosition(body2, simulationDateMs, mode, p2Ref.current)
    const positions = lineRef.current.geometry.attributes.position as THREE.BufferAttribute

    positions.setXYZ(0, p1.x, p1.y, p1.z)
    positions.setXYZ(1, p2.x, p2.y, p2.z)
    positions.needsUpdate = true
    lineRef.current.computeLineDistances()

    if (labelRef.current) {
      labelRef.current.position.copy(
        midpointRef.current.addVectors(p1, p2).multiplyScalar(0.5)
      )
    }

    publishElapsedRef.current += renderDelta
    if (publishElapsedRef.current < 0.2) return
    publishElapsedRef.current = 0

    const telemetry1 = getBodyTelemetry(body1, simulationDateMs, mode)
    const telemetry2 = getBodyTelemetry(body2, simulationDateMs, mode)
    const physical1 = physicalVectorFromTelemetry(
      p1,
      telemetry1.distanceFromSunAu,
      physical1Ref.current
    )
    const physical2 = physicalVectorFromTelemetry(
      p2,
      telemetry2.distanceFromSunAu,
      physical2Ref.current
    )
    const distanceKm =
      physical1 && physical2
        ? physical1.distanceTo(physical2) * ASTRONOMICAL_UNIT_KM
        : null
    setDistanceText(formatDistance(distanceKm))
  })

  return (
    <>
      <lineSegments ref={lineRef} geometry={geometry}>
        <lineDashedMaterial
          color="#fbbf24"
          transparent
          opacity={0.72}
          dashSize={0.8}
          gapSize={0.38}
          depthWrite={false}
        />
      </lineSegments>
      <group ref={labelRef}>
        <Html center distanceFactor={80} style={{ pointerEvents: 'none' }}>
          <div className="rounded-lg border border-amber-400/30 bg-black/80 px-2.5 py-1.5 shadow-xl backdrop-blur-sm">
            <div className="whitespace-nowrap font-mono text-[9px] font-bold text-amber-300">
              {distanceText}
            </div>
          </div>
        </Html>
      </group>
    </>
  )
}

export default function DistanceRuler() {
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const rulerTarget = useSolarSystemStore((state) => state.rulerTarget)

  if (!selectedBody || !rulerTarget || selectedBody === rulerTarget) return null
  return <DistanceRulerInner body1={selectedBody} body2={rulerTarget} />
}
