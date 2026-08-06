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

const JUPITER_ORBIT_RADIUS = 15.9
const JUPITER_ORBIT_SPEED = 0.44
const JUPITER_INITIAL_ANGLE = 0.6
const TROJANS_PER_SWARM = 250
const TOTAL_TROJANS = TROJANS_PER_SWARM * 2

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 48271) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function TrojanSwarm() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const density = QUALITY_PROFILES[quality].instanceDensity
  const effectiveCount = Math.max(80, Math.round((TOTAL_TROJANS * density) / 2) * 2)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const random = seededRandom(12011)
    const perSwarm = effectiveCount / 2
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    mesh.rotation.y = JUPITER_INITIAL_ANGLE

    for (let index = 0; index < effectiveCount; index++) {
      const isLeadingSwarm = index < perSwarm
      const lagrangeOffset = isLeadingSwarm ? Math.PI / 3 : -Math.PI / 3
      const angleOffset = (random() - 0.5) * ((16 * Math.PI) / 180)
      const radius = JUPITER_ORBIT_RADIUS + (random() - 0.5) * 2
      const angle = lagrangeOffset + angleOffset

      dummy.position.set(
        Math.cos(angle) * radius,
        (random() - 0.5) * 0.6,
        Math.sin(angle) * radius
      )
      dummy.rotation.set(
        random() * Math.PI * 2,
        random() * Math.PI * 2,
        random() * Math.PI * 2
      )
      dummy.scale.setScalar(0.02 + random() * 0.03)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [dummy, effectiveCount])

  useFrameLane({
    id: 'trojan-swarms',
    lane: 'decorative',
    priority: 84,
  }, ({ laneDelta }) => {
    if (!meshRef.current) return

    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const motionFactor = reducedMotion ? 0.18 : 1
    meshRef.current.rotation.y += (
      laneDelta * JUPITER_ORBIT_SPEED * 0.05 * timeSpeed * motionFactor
    )
  })

  return (
    <instancedMesh
      key={effectiveCount}
      ref={meshRef}
      args={[undefined, undefined, effectiveCount]}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#888888"
        roughness={0.92}
        metalness={0.04}
        transparent
        opacity={0.58}
      />
    </instancedMesh>
  )
}

export default function TrojanAsteroids() {
  const showTrojans = useSolarSystemStore((state) => state.showTrojans)
  const showAsteroidBelt = useSolarSystemStore((state) => state.showAsteroidBelt)

  if (!showTrojans || !showAsteroidBelt) return null

  return <TrojanSwarm />
}
