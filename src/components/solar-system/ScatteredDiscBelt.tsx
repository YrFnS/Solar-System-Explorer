'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

interface ParticleInfo {
  angle: number
  radius: number
  y: number
  speed: number
  scale: number
  rotX: number
  rotY: number
  rotZ: number
  rotSpeedX: number
  rotSpeedY: number
  rotSpeedZ: number
}

const SD_INNER = 35  // Scattered disc starts beyond Kuiper belt (~30 AU)
const SD_OUTER = 100 // Scattered disc extends to ~100 AU
const SD_COUNT = 10000

function ScatteredDiscBeltInner() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const particleDataRef = useRef<ParticleInfo[]>([])
  if (particleDataRef.current.length === 0) {
    for (let i = 0; i < SD_COUNT; i++) {
      // Scattered disc objects have highly inclined orbits (can be >40 degrees)
      const inclination = (Math.random() - 0.5) * 80 // -40 to +40 degrees
      const inclinationRad = (inclination * Math.PI) / 180
      particleDataRef.current.push({
        angle: Math.random() * Math.PI * 2,
        radius: SD_INNER + Math.random() * (SD_OUTER - SD_INNER),
        y: (Math.random() - 0.5) * 20, // Larger Y spread due to high inclination
        speed: 0.002 + Math.random() * 0.006,
        scale: 0.2 + Math.random() * 1.0,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedX: (Math.random() - 0.5) * 0.2,
        rotSpeedY: (Math.random() - 0.5) * 0.2,
        rotSpeedZ: (Math.random() - 0.5) * 0.2,
      })
    }
  }

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const data = particleDataRef.current

    for (let i = 0; i < SD_COUNT; i++) {
      const p = data[i]
      p.angle += delta * p.speed * timeSpeed

      // Apply orbital inclination to Y position
      const inclRad = (p.y / 10) * Math.PI / 180 * 20 // scaled inclination
      dummy.position.set(
        Math.cos(p.angle) * p.radius,
        Math.sin(p.angle) * Math.sin(inclRad) * Math.abs(p.y),
        Math.sin(p.angle) * p.radius
      )
      dummy.scale.setScalar(p.scale * 0.03)
      p.rotX += delta * p.rotSpeedX * timeSpeed
      p.rotY += delta * p.rotSpeedY * timeSpeed
      p.rotZ += delta * p.rotSpeedZ * timeSpeed
      dummy.rotation.set(p.rotX, p.rotY, p.rotZ)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SD_COUNT]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#8899AA"
        roughness={0.9}
        metalness={0.1}
        transparent
        opacity={0.6}
      />
    </instancedMesh>
  )
}

export default function ScatteredDiscBelt() {
  const showScatteredDisc = useSolarSystemStore((s) => s.showScatteredDisc)

  if (!showScatteredDisc) return null

  return <ScatteredDiscBeltInner />
}