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

const OORT_CLOUD_COUNT = 800
const OORT_CLOUD_INNER_RADIUS = 65
const OORT_CLOUD_OUTER_RADIUS = 80

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x80000000
  }
}

export default function OortCloud() {
  const showKuiperBelt = useSolarSystemStore((state) => state.showKuiperBelt)
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const effectiveCount = Math.max(
    120,
    Math.round(OORT_CLOUD_COUNT * QUALITY_PROFILES[quality].instanceDensity)
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const random = seededRandom(42017)
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

    for (let index = 0; index < effectiveCount; index++) {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      const radius = OORT_CLOUD_INNER_RADIUS
        + random() * (OORT_CLOUD_OUTER_RADIUS - OORT_CLOUD_INNER_RADIUS)
      const sinPhi = Math.sin(phi)

      dummy.position.set(
        Math.cos(theta) * sinPhi * radius,
        Math.cos(phi) * radius,
        Math.sin(theta) * sinPhi * radius
      )
      dummy.scale.setScalar(0.65 + random() * 0.7)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [dummy, effectiveCount])

  useFrameLane({
    id: 'oort-cloud',
    lane: 'decorative',
    priority: 83,
    enabled: showKuiperBelt,
  }, ({ laneDelta }) => {
    if (!meshRef.current) return

    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const motionFactor = reducedMotion ? 0.12 : 1
    meshRef.current.rotation.y += (
      laneDelta * 0.00035 * timeSpeed * motionFactor
    )
  })

  if (!showKuiperBelt) return null

  return (
    <instancedMesh
      key={effectiveCount}
      ref={meshRef}
      args={[undefined, undefined, effectiveCount]}
    >
      <icosahedronGeometry args={[0.08, 0]} />
      <meshBasicMaterial
        color="#C8D8E8"
        transparent
        opacity={0.28}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
