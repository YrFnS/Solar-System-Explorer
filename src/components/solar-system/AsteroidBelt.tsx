'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ASTEROID_BELT_INNER,
  ASTEROID_BELT_OUTER,
  ASTEROID_COUNT,
  KUIPER_BELT_INNER,
  KUIPER_BELT_OUTER,
  KUIPER_COUNT,
} from './data'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  usePerformanceStore,
} from './performance-store'

type GeometryType = 'dodecahedron' | 'ring'

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function ParticleBelt({
  innerRadius,
  outerRadius,
  count,
  color,
  size,
  ySpread,
  geometryType,
  rotationSpeed,
  seed,
}: {
  innerRadius: number
  outerRadius: number
  count: number
  color: string
  size: number
  ySpread: number
  geometryType: GeometryType
  rotationSpeed: number
  seed: number
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const effectiveCount = Math.max(256, Math.round(count * QUALITY_PROFILES[quality].instanceDensity))

  const geometry = useMemo(() => {
    if (geometryType === 'ring') {
      const ring = new THREE.RingGeometry(0.3, 0.5, 4)
      ring.rotateX(Math.PI / 2)
      return ring
    }
    return new THREE.DodecahedronGeometry(1, 0)
  }, [geometryType])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const random = seededRandom(seed)
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

    for (let index = 0; index < effectiveCount; index++) {
      const angle = random() * Math.PI * 2
      const radius = innerRadius + random() * (outerRadius - innerRadius)
      const verticalPosition = (random() - 0.5) * ySpread
      const scale = (0.5 + random() * 1.5) * size

      dummy.position.set(
        Math.cos(angle) * radius,
        verticalPosition,
        Math.sin(angle) * radius
      )
      dummy.rotation.set(
        random() * Math.PI * 2,
        random() * Math.PI * 2,
        random() * Math.PI * 2
      )
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [dummy, effectiveCount, innerRadius, outerRadius, seed, size, ySpread])

  useFrame((_, delta) => {
    if (!meshRef.current) return

    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const motionFactor = reducedMotion ? 0.18 : 1
    meshRef.current.rotation.y += delta * rotationSpeed * timeSpeed * motionFactor
  })

  return (
    <instancedMesh
      key={`${geometryType}-${effectiveCount}`}
      ref={meshRef}
      args={[geometry, undefined, effectiveCount]}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.92}
        metalness={0.05}
        transparent
        opacity={0.68}
      />
    </instancedMesh>
  )
}

export function AsteroidBelt() {
  const showAsteroidBelt = useSolarSystemStore((state) => state.showAsteroidBelt)

  if (!showAsteroidBelt) return null

  return (
    <ParticleBelt
      innerRadius={ASTEROID_BELT_INNER}
      outerRadius={ASTEROID_BELT_OUTER}
      count={ASTEROID_COUNT}
      color="#8B7D6B"
      size={0.03}
      ySpread={0.5}
      geometryType="dodecahedron"
      rotationSpeed={0.012}
      seed={1937}
    />
  )
}

export function KuiperBelt() {
  const showKuiperBelt = useSolarSystemStore((state) => state.showKuiperBelt)

  if (!showKuiperBelt) return null

  return (
    <ParticleBelt
      innerRadius={KUIPER_BELT_INNER}
      outerRadius={KUIPER_BELT_OUTER}
      count={KUIPER_COUNT}
      color="#6B7B8B"
      size={0.025}
      ySpread={1}
      geometryType="ring"
      rotationSpeed={0.0035}
      seed={4099}
    />
  )
}
