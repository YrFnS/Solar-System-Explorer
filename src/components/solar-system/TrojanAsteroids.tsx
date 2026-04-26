'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

// Jupiter's orbit data (matching planet data)
const JUPITER_ORBIT_RADIUS = 20
const JUPITER_ORBIT_SPEED = 0.084
const TROJANS_PER_SWARM = 250
const TOTAL_TROJANS = TROJANS_PER_SWARM * 2

interface TrojanParticle {
  angleOffset: number // offset from L4/L5 point (±8°)
  radiusOffset: number // slight variation in orbit radius
  y: number // slight vertical spread
  scale: number
}

function TrojanSwarm() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Generate particle data for both L4 and L5 swarms
  const particleDataRef = useRef<TrojanParticle[]>([])
  const isL4Ref = useRef<boolean[]>([]) // which swarm each particle belongs to

  if (particleDataRef.current.length === 0) {
    for (let i = 0; i < TOTAL_TROJANS; i++) {
      const isL4 = i < TROJANS_PER_SWARM
      isL4Ref.current.push(isL4)
      particleDataRef.current.push({
        angleOffset: (Math.random() - 0.5) * (16 * Math.PI / 180), // ±8° spread
        radiusOffset: (Math.random() - 0.5) * 2, // slight radial spread
        y: (Math.random() - 0.5) * 0.6, // slight vertical spread
        scale: 0.02 + Math.random() * 0.03, // varied sizes
      })
    }
  }

  // Track Jupiter's angle
  const jupiterAngleRef = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const data = particleDataRef.current

    // Update Jupiter's angle
    jupiterAngleRef.current += delta * JUPITER_ORBIT_SPEED * 0.05 * timeSpeed
    const jupiterAngle = jupiterAngleRef.current

    for (let i = 0; i < TOTAL_TROJANS; i++) {
      const p = data[i]
      const isL4 = isL4Ref.current[i]

      // L4 is 60° ahead of Jupiter, L5 is 60° behind
      const lagrangeOffset = isL4 ? Math.PI / 3 : -Math.PI / 3
      const angle = jupiterAngle + lagrangeOffset + p.angleOffset
      const radius = JUPITER_ORBIT_RADIUS + p.radiusOffset

      dummy.position.set(
        Math.cos(angle) * radius,
        p.y,
        Math.sin(angle) * radius
      )
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_TROJANS]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#888888"
        roughness={0.9}
        metalness={0.1}
        transparent
        opacity={0.6}
      />
    </instancedMesh>
  )
}

export default function TrojanAsteroids() {
  const showTrojans = useSolarSystemStore((s) => s.showTrojans)
  const showAsteroidBelt = useSolarSystemStore((s) => s.showAsteroidBelt)

  if (!showTrojans || !showAsteroidBelt) return null

  return <TrojanSwarm />
}
