'use client'

import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'
import { planets, dwarfPlanets, comets } from './data'

// Map from body ID to real distance from Sun in million km
function getRealDistanceFromSun(id: string): number {
  if (id === 'sun') return 0
  const planet = planets.find((p) => p.id === id)
  if (planet) return planet.distanceFromSun
  const dwarf = dwarfPlanets.find((d) => d.id === id)
  if (dwarf) return dwarf.distanceFromSun
  return 0
}

// Get visual position of a body at the current simulation time
function getBodyVisualPosition(id: string, time: number, dateOffset: number): THREE.Vector3 | null {
  if (id === 'sun') return new THREE.Vector3(0, 0, 0)

  const planet = planets.find((p) => p.id === id)
  if (planet) {
    const angle = time * planet.orbitSpeed * 0.05 + dateOffset * planet.orbitSpeed
    return new THREE.Vector3(
      Math.cos(angle) * planet.orbitRadius,
      0,
      Math.sin(angle) * planet.orbitRadius
    )
  }

  const dwarf = dwarfPlanets.find((d) => d.id === id)
  if (dwarf) {
    const angle = time * dwarf.orbitSpeed * 0.05 + dateOffset * dwarf.orbitSpeed
    const incl = (dwarf.orbitInclination * Math.PI) / 180
    return new THREE.Vector3(
      Math.cos(angle) * dwarf.orbitRadius,
      Math.sin(angle) * Math.sin(incl) * dwarf.orbitRadius * 0.3,
      Math.sin(angle) * dwarf.orbitRadius
    )
  }

  const comet = comets.find((c) => c.id === id)
  if (comet) {
    const angle = time * comet.orbitSpeed * 0.05 + dateOffset * comet.orbitSpeed
    const e = comet.orbitEccentricity
    const a = comet.orbitRadius
    const r = a * (1 - e * e) / (1 + e * Math.cos(angle))
    const incl = (comet.orbitInclination * Math.PI) / 180
    return new THREE.Vector3(
      Math.cos(angle) * r,
      Math.sin(angle) * Math.sin(incl) * r * 0.4,
      Math.sin(angle) * r
    )
  }

  return null
}

function DistanceRulerInner({ body1, body2 }: { body1: string; body2: string }) {
  const lineRef = useRef<THREE.LineSegments>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedTimeRef = useRef(0)
  const [distanceText, setDistanceText] = useState('— M km')

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(6)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  useFrame((_, delta) => {
    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const isPaused = useSolarSystemStore.getState().isPaused
    if (!isPaused) {
      elapsedTimeRef.current += delta * timeSpeed
    }

    const p1 = getBodyVisualPosition(body1, elapsedTimeRef.current, useSolarSystemStore.getState().customDateAngleBase)
    const p2 = getBodyVisualPosition(body2, elapsedTimeRef.current, useSolarSystemStore.getState().customDateAngleBase)

    if (!p1 || !p2 || !lineRef.current) return

    // Update line geometry
    const positions = lineRef.current.geometry.attributes.position
    if (positions) {
      const arr = positions.array as Float32Array
      arr[0] = p1.x; arr[1] = p1.y; arr[2] = p1.z
      arr[3] = p2.x; arr[4] = p2.y; arr[5] = p2.z
      positions.needsUpdate = true
    }

    // Compute line distances for dashed material
    lineRef.current.computeLineDistances()

    // Calculate real distance in million km
    const dist = p1.distanceTo(p2)
    const realDist1 = getRealDistanceFromSun(body1)
    const realDist2 = getRealDistanceFromSun(body2)

    const orbitRef1 = planets.find((p) => p.id === body1)
    const orbitRef2 = planets.find((p) => p.id === body2)
    const dwarfRef1 = dwarfPlanets.find((d) => d.id === body1)
    const dwarfRef2 = dwarfPlanets.find((d) => d.id === body2)

    const visualOrbit1 = orbitRef1?.orbitRadius || dwarfRef1?.orbitRadius || 0
    const visualOrbit2 = orbitRef2?.orbitRadius || dwarfRef2?.orbitRadius || 0

    let distanceKm = 0

    if (visualOrbit1 > 0 && realDist1 > 0) {
      const scale = realDist1 / visualOrbit1
      distanceKm = dist * scale
    } else if (visualOrbit2 > 0 && realDist2 > 0) {
      const scale = realDist2 / visualOrbit2
      distanceKm = dist * scale
    } else if (body1 === 'sun' || body2 === 'sun') {
      const nonSunId = body1 === 'sun' ? body2 : body1
      const realDist = getRealDistanceFromSun(nonSunId)
      const nonSunVisual = body1 === 'sun' ? p2 : p1
      const visualDist = nonSunVisual.length()
      if (visualDist > 0 && realDist > 0) {
        const scale = realDist / visualDist
        distanceKm = dist * scale
      }
    }

    setDistanceText(distanceKm > 0 ? `${distanceKm.toFixed(1)} M km` : '— M km')

    // Update group position for label
    if (groupRef.current) {
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
      groupRef.current.position.copy(mid)
    }
  })

  return (
    <>
      <lineSegments ref={lineRef} geometry={lineGeometry}>
        <lineDashedMaterial
          color="#FBBF24"
          transparent
          opacity={0.7}
          dashSize={1}
          gapSize={0.5}
          depthWrite={false}
        />
      </lineSegments>
      <group ref={groupRef}>
        <Html
          center
          distanceFactor={80}
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-black/80 backdrop-blur-sm border border-amber-400/30 rounded-lg px-2.5 py-1.5 shadow-xl">
            <div className="text-[9px] text-amber-300 font-mono font-bold whitespace-nowrap">
              {distanceText}
            </div>
          </div>
        </Html>
      </group>
    </>
  )
}

export default function DistanceRuler() {
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const rulerTarget = useSolarSystemStore((s) => s.rulerTarget)

  if (!selectedBody || !rulerTarget || selectedBody === rulerTarget) return null

  return <DistanceRulerInner body1={selectedBody} body2={rulerTarget} />
}
