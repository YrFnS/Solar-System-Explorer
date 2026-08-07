'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import type { EphemerisSmallBodyData } from './EphemerisSmallBody'
import { getOrbitPoints } from './ephemeris'
import { useExperienceStore } from './experience-store'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'
import { DAY_MS, getSimulationDateMs } from './simulation-clock'
import { useSolarSystemStore } from './store'

export interface SmallBodyOrbitEntry {
  body: EphemerisSmallBodyData
  color: string
  opacity: number
}

interface SmallBodyOrbitBatchProps {
  entries: SmallBodyOrbitEntry[]
}

const JULIAN_YEAR_MS = 365.25 * DAY_MS

const ORBIT_SEGMENTS: Record<EffectiveQuality, number> = {
  eco: 72,
  balanced: 112,
  ultra: 160,
}

export default function SmallBodyOrbitBatch({ entries }: SmallBodyOrbitBatchProps) {
  const showOrbitLines = useSolarSystemStore((state) => state.showOrbitLines)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const mode = useExperienceStore((state) => state.mode)
  const showOrbitalPlanes = useExperienceStore((state) => state.showOrbitalPlanes)
  const dateBucket = useExperienceStore((state) => (
    Math.floor(state.simulationDateMs / JULIAN_YEAR_MS)
  ))
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))

  const { positions, colors, materialOpacity } = useMemo(() => {
    if (!showOrbitLines) {
      return {
        positions: new Float32Array(),
        colors: new Float32Array(),
        materialOpacity: 0,
      }
    }

    const positionValues: number[] = []
    const colorValues: number[] = []
    const scientific = mode === 'scientific' && showOrbitalPlanes
    const nextMaterialOpacity = scientific ? 0.13 : 0.05
    const segments = ORBIT_SEGMENTS[quality]
    const sampledAt = getSimulationDateMs()
    const color = new THREE.Color()

    for (const entry of entries) {
      if (entry.body.id === selectedBody) continue

      const points = getOrbitPoints(entry.body.id, sampledAt, mode, segments)
      if (points.length < 2) continue

      const effectiveOpacity = scientific
        ? Math.max(entry.opacity, 0.13)
        : entry.opacity
      const intensity = THREE.MathUtils.clamp(
        effectiveOpacity / Math.max(0.001, nextMaterialOpacity),
        0.15,
        1
      )
      color.set(entry.color).multiplyScalar(intensity)

      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index]
        const end = points[index + 1]
        positionValues.push(start.x, start.y, start.z, end.x, end.y, end.z)
        colorValues.push(
          color.r,
          color.g,
          color.b,
          color.r,
          color.g,
          color.b
        )
      }
    }

    return {
      positions: new Float32Array(positionValues),
      colors: new Float32Array(colorValues),
      materialOpacity: nextMaterialOpacity,
    }
  }, [
    dateBucket,
    entries,
    mode,
    quality,
    selectedBody,
    showOrbitalPlanes,
    showOrbitLines,
  ])

  if (!showOrbitLines || positions.length === 0) return null

  return (
    <lineSegments frustumCulled={false} name="batched-small-body-orbits">
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={materialOpacity}
        depthWrite={false}
      />
    </lineSegments>
  )
}
