'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  usePerformanceStore,
} from './performance-store'

const CENTAUR_INNER = 5.2
const CENTAUR_OUTER = 30
const CENTAUR_COUNT = 2000

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function CentaurBeltInner() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const effectiveCount = Math.max(
    180,
    Math.round(CENTAUR_COUNT * QUALITY_PROFILES[quality].instanceDensity)
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const random = seededRandom(8831)
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

    for (let index = 0; index < effectiveCount; index++) {
      const angle = random() * Math.PI * 2
      const radius = CENTAUR_INNER + random() * (CENTAUR_OUTER - CENTAUR_INNER)
      const verticalPosition = (random() - 0.5) * 2
      const scale = (0.3 + random() * 1.2) * 0.05

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
  }, [dummy, effectiveCount])

  useFrame((_, delta) => {
    if (!meshRef.current) return

    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const motionFactor = reducedMotion ? 0.18 : 1
    meshRef.current.rotation.y += delta * 0.0055 * timeSpeed * motionFactor
  })

  return (
    <instancedMesh
      key={effectiveCount}
      ref={meshRef}
      args={[undefined, undefined, effectiveCount]}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#8b7a68"
        roughness={0.92}
        metalness={0.04}
        transparent
        opacity={0.72}
      />
    </instancedMesh>
  )
}

export default function CentaurBelt() {
  const showCentaurs = useSolarSystemStore((state) => state.showCentaurs)

  if (!showCentaurs) return null

  return <CentaurBeltInner />
}
