'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  usePerformanceStore,
} from './performance-store'

const SD_INNER = 35
const SD_OUTER = 100
const SD_COUNT = 10000

function seededRandom(seed: number) {
  return () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 4294967296
  }
}

function ScatteredDiscBeltInner() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const effectiveCount = Math.max(
    300,
    Math.round(SD_COUNT * QUALITY_PROFILES[quality].instanceDensity)
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const random = seededRandom(70123)
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

    for (let index = 0; index < effectiveCount; index++) {
      const angle = random() * Math.PI * 2
      const radius = SD_INNER + random() * (SD_OUTER - SD_INNER)
      const inclination = ((random() - 0.5) * 80 * Math.PI) / 180
      const scale = (0.2 + random()) * 0.03

      dummy.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * Math.sin(inclination) * radius * 0.45,
        Math.sin(angle) * Math.cos(inclination) * radius
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
  }, [dummy, effectiveCount])

  useFrameLane({
    id: 'scattered-disc-field',
    lane: 'decorative',
    priority: 82,
  }, ({ laneDelta }) => {
    if (!meshRef.current) return

    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const motionFactor = reducedMotion ? 0.15 : 1
    meshRef.current.rotation.y += (
      laneDelta * 0.0018 * timeSpeed * motionFactor
    )
  })

  return (
    <instancedMesh
      key={effectiveCount}
      ref={meshRef}
      args={[undefined, undefined, effectiveCount]}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#8899AA"
        roughness={0.94}
        metalness={0.03}
        transparent
        opacity={0.55}
      />
    </instancedMesh>
  )
}

export default function ScatteredDiscBelt() {
  const showScatteredDisc = useSolarSystemStore((state) => state.showScatteredDisc)

  if (!showScatteredDisc) return null

  return <ScatteredDiscBeltInner />
}
