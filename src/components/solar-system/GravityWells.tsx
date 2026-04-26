'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { planets } from './data'
import { useSolarSystemStore } from './store'

// Mass data for gravity well visualization (relative to Earth = 1)
const PLANET_MASS: Record<string, number> = {
  mercury: 0.055,
  venus: 0.815,
  earth: 1.0,
  mars: 0.107,
  jupiter: 317.8,
  saturn: 95.2,
  uranus: 14.5,
  neptune: 17.1,
}

export default function GravityWells() {
  const showGravityWells = useSolarSystemStore((s) => s.showGravityWells)

  const rings = useMemo(() => {
    if (!showGravityWells) return []

    return planets.map((planet) => {
      const mass = PLANET_MASS[planet.id] || 1
      // Logarithmic scaling for ring radius - massive planets get bigger wells
      const wellRadius = planet.orbitRadius * (0.3 + Math.log10(mass + 1) * 0.4)
      const numRings = Math.min(Math.ceil(Math.log10(mass + 1) * 2) + 1, 5)
      return {
        planetId: planet.id,
        orbitRadius: planet.orbitRadius,
        wellRadius,
        numRings,
        color: planet.color,
        mass,
      }
    })
  }, [showGravityWells])

  if (!showGravityWells) return null

  return (
    <>
      {rings.map((ring) => (
        <group key={`gw-${ring.planetId}`} position={[0, 0, 0]}>
          {Array.from({ length: ring.numRings }).map((_, i) => {
            const t = (i + 1) / (ring.numRings + 1)
            const r = ring.orbitRadius + (ring.wellRadius - ring.orbitRadius) * t
            const opacity = 0.08 * (1 - t * 0.7)
            return (
              <mesh key={`gw-ring-${ring.planetId}-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[r - 0.03, r + 0.03, 64]} />
                <meshBasicMaterial
                  color={ring.color}
                  transparent
                  opacity={opacity}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )
          })}
          {/* Central glow dot at planet's orbit position */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[ring.orbitRadius - 0.1, ring.orbitRadius + 0.1, 64]} />
            <meshBasicMaterial
              color={ring.color}
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}
