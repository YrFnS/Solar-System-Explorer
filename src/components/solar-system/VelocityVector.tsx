'use client'

import { useMemo, useRef } from 'react'
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
  const arrowRef = useRef<THREE.ArrowHelper>(null)
  const velocityRef = useRef(new THREE.Vector3())
  const colorHex = useMemo(() => new THREE.Color(color).getHex(), [color])
  const mode = useExperienceStore((state) => state.mode)
  const showVelocityVectors = useExperienceStore(
    (state) => state.showVelocityVectors
  )

  useFrame(() => {
    const arrow = arrowRef.current
    if (!arrow || mode !== 'scientific' || !showVelocityVectors) return

    const velocity = velocityRef.current
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
    arrow.setLength(
      length,
      Math.min(0.35, length * 0.3),
      Math.min(0.18, length * 0.16)
    )
  })

  if (mode !== 'scientific' || !showVelocityVectors) return null

  return (
    <arrowHelper
      ref={arrowRef}
      args={[
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(),
        1,
        colorHex,
        0.25,
        0.12,
      ]}
    />
  )
}
