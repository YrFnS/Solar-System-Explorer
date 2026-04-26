'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ASTEROID_BELT_INNER, ASTEROID_BELT_OUTER, ASTEROID_COUNT, KUIPER_BELT_INNER, KUIPER_BELT_OUTER, KUIPER_COUNT } from './data'
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

function ParticleBelt({
  innerRadius,
  outerRadius,
  count,
  color,
  size,
  ySpread,
}: {
  innerRadius: number
  outerRadius: number
  count: number
  color: string
  size: number
  ySpread: number
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Use ref for mutable particle data
  const particleDataRef = useRef<ParticleInfo[]>([])
  if (particleDataRef.current.length === 0) {
    for (let i = 0; i < count; i++) {
      particleDataRef.current.push({
        angle: Math.random() * Math.PI * 2,
        radius: innerRadius + Math.random() * (outerRadius - innerRadius),
        y: (Math.random() - 0.5) * ySpread,
        speed: 0.01 + Math.random() * 0.02,
        scale: 0.5 + Math.random() * 1.5,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedX: (Math.random() - 0.5) * 0.5,
        rotSpeedY: (Math.random() - 0.5) * 0.5,
        rotSpeedZ: (Math.random() - 0.5) * 0.5,
      })
    }
  }

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const data = particleDataRef.current

    for (let i = 0; i < count; i++) {
      const p = data[i]
      p.angle += delta * p.speed * timeSpeed

      dummy.position.set(
        Math.cos(p.angle) * p.radius,
        p.y,
        Math.sin(p.angle) * p.radius
      )
      dummy.scale.setScalar(p.scale * size)
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={color}
        roughness={0.9}
        metalness={0.1}
        transparent
        opacity={0.7}
      />
    </instancedMesh>
  )
}

export function AsteroidBelt() {
  const showAsteroidBelt = useSolarSystemStore((s) => s.showAsteroidBelt)

  if (!showAsteroidBelt) return null

  return (
    <ParticleBelt
      innerRadius={ASTEROID_BELT_INNER}
      outerRadius={ASTEROID_BELT_OUTER}
      count={ASTEROID_COUNT}
      color="#8B7D6B"
      size={0.03}
      ySpread={0.5}
    />
  )
}

export function KuiperBelt() {
  const showKuiperBelt = useSolarSystemStore((s) => s.showKuiperBelt)

  if (!showKuiperBelt) return null

  return (
    <ParticleBelt
      innerRadius={KUIPER_BELT_INNER}
      outerRadius={KUIPER_BELT_OUTER}
      count={KUIPER_COUNT}
      color="#6B7B8B"
      size={0.025}
      ySpread={1.0}
    />
  )
}
