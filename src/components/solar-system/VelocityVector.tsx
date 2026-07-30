'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getBodyVisualVelocity } from './ephemeris'
import { useExperienceStore } from './experience-store'
import { getSimulationDateMs } from './simulation-clock'

interface VelocityVectorProps {
  bodyId: string
  color: string
  scale?: number
}

export default function VelocityVector({
  bodyId,
  color,
  scale = 1,
}: VelocityVectorProps) {
  const mode = useExperienceStore((state) => state.mode)
  const showVelocityVectors = useExperienceStore(
    (state) => state.showVelocityVectors
  )

  const arrow = useMemo(
    () =>
      new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(),
        1,
        new THREE.Color(color).getHex(),
        0.25,
        0.12
      ),
    [color]
  )
  const velocity = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (mode !== 'scientific' || !showVelocityVectors) return

    getBodyVisualVelocity(
      bodyId,
      getSimulationDateMs(),
      mode,
      velocity
    )

    const magnitude = velocity.length()
    if (magnitude < 1e-8) {
      arrow.visible = false
      return
    }

    arrow.visible = true
    arrow.setDirection(velocity.normalize())
    const length = THREE.MathUtils.clamp(magnitude * 7 * scale, 0.65, 4.5)
    arrow.setLength(length, Math.min(0.35, length * 0.3), Math.min(0.18, length * 0.16))
  })

  useEffect(() => {
    return () => {
      arrow.line.geometry.dispose()
      arrow.cone.geometry.dispose()
      ;(arrow.line.material as THREE.Material).dispose()
      ;(arrow.cone.material as THREE.Material).dispose()
    }
  }, [arrow])

  if (mode !== 'scientific' || !showVelocityVectors) return null
  return <primitive object={arrow} />
}
