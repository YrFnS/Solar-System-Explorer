'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { getOrbitPoints } from './ephemeris'
import { useExperienceStore } from './experience-store'
import { DAY_MS, getSimulationDateMs } from './simulation-clock'
import { useSolarSystemStore } from './store'

interface EphemerisOrbitLineProps {
  bodyId: string
  color?: string
  opacity?: number
}

const JULIAN_YEAR_MS = 365.25 * DAY_MS

export default function EphemerisOrbitLine({
  bodyId,
  color = '#ffffff',
  opacity = 0.08,
}: EphemerisOrbitLineProps) {
  const showOrbitLines = useSolarSystemStore((state) => state.showOrbitLines)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const mode = useExperienceStore((state) => state.mode)
  const showOrbitalPlanes = useExperienceStore((state) => state.showOrbitalPlanes)
  const dateBucket = useExperienceStore((state) =>
    Math.floor(state.simulationDateMs / JULIAN_YEAR_MS)
  )

  const { positions, perihelion, aphelion } = useMemo(() => {
    const points = getOrbitPoints(bodyId, getSimulationDateMs(), mode, 224)
    const array = new Float32Array(points.length * 3)
    let nearest = points[0] ?? new THREE.Vector3()
    let farthest = points[0] ?? new THREE.Vector3()

    points.forEach((point, index) => {
      array[index * 3] = point.x
      array[index * 3 + 1] = point.y
      array[index * 3 + 2] = point.z
      if (point.lengthSq() < nearest.lengthSq()) nearest = point
      if (point.lengthSq() > farthest.lengthSq()) farthest = point
    })

    return {
      positions: array,
      perihelion: nearest.clone(),
      aphelion: farthest.clone(),
    }
  }, [bodyId, dateBucket, mode])

  if (!showOrbitLines || positions.length === 0) return null

  const selected = selectedBody === bodyId
  const scientific = mode === 'scientific'
  const finalOpacity = selected
    ? 0.48
    : scientific && showOrbitalPlanes
      ? Math.max(opacity, 0.13)
      : opacity

  return (
    <group>
      {selected && (
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color={color}
            transparent
            opacity={0.16}
            linewidth={2}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </line>
      )}

      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={finalOpacity}
          depthWrite={false}
        />
      </line>

      {scientific && showOrbitalPlanes && selected && (
        <>
          <mesh position={perihelion.toArray()}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
          <mesh position={aphelion.toArray()}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshBasicMaterial color="#60a5fa" />
          </mesh>
        </>
      )}
    </group>
  )
}
