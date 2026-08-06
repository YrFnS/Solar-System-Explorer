'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'
import { getQualityProfile, usePerformanceStore } from './performance-store'
import { useAdaptiveTexture } from './textures/useAdaptiveTexture'

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

export default function NearEarthObjects() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const texture = useAdaptiveTexture('/textures/moon.jpg', { anisotropy: 2 })
  const showPhenomena = useSolarSystemStore((state) => state.showPhenomena)
  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const timeSpeed = useSolarSystemStore((state) => state.timeSpeed)
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const profile = getQualityProfile({ preset, autoQuality })
  const count = Math.max(120, Math.round(1000 * profile.instanceDensity))

  useEffect(() => {
    if (!meshRef.current) return

    const dummy = new THREE.Object3D()
    const random = seededRandom(67890)
    const innerRadius = 5
    const outerRadius = 8

    for (let i = 0; i < count; i++) {
      const distance = innerRadius + random() * (outerRadius - innerRadius)
      const angle = random() * Math.PI * 2
      const y = (random() - 0.5) * 0.5

      dummy.position.set(Math.cos(angle) * distance, y, Math.sin(angle) * distance)
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI)
      const baseScale = random() * 0.05 + 0.01
      dummy.scale.set(
        baseScale * (0.8 + random() * 0.6),
        baseScale * (0.8 + random() * 0.6),
        baseScale * (0.8 + random() * 0.6)
      )
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    meshRef.current.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.computeBoundingSphere()
  }, [count])

  useFrameLane({
    id: 'near-earth-field',
    lane: 'decorative',
    priority: 90,
    enabled: showPhenomena && !isPaused,
  }, ({ laneDelta }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y -= (
      laneDelta * 0.018 * Math.max(0.1, timeSpeed)
    )
  })

  if (!showPhenomena) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.92}
        metalness={0.05}
        color="#aaaaaa"
      />
    </instancedMesh>
  )
}
