'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'
import { planets } from './data'

interface OrbitLineProps {
  radius: number
  color?: string
  opacity?: number
  planetId?: string
}

export default function OrbitLine({ radius, color = '#ffffff', opacity = 0.08, planetId }: OrbitLineProps) {
  const showOrbitLines = useSolarSystemStore((s) => s.showOrbitLines)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const segments = 256
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ))
    }
    return pts
  }, [radius])

  if (!showOrbitLines) return null

  const isHighlighted = planetId && selectedBody === planetId
  const finalOpacity = isHighlighted ? 0.35 : opacity
  const finalColor = isHighlighted
    ? (planets.find(p => p.id === planetId)?.color || color)
    : color

  const lineArray = new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))

  return (
    <>
      {isHighlighted && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[lineArray, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={finalColor}
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </line>
      )}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[lineArray, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={finalColor}
          transparent
          opacity={finalOpacity}
          depthWrite={false}
        />
      </line>
    </>
  )
}
