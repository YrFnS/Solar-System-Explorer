'use client'

import { useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'

interface PlanetLabelProps {
  name: string
  offset: number
  bodyId?: string
}

const MAX_LABEL_DISTANCE: Record<EffectiveQuality, number> = {
  eco: 320,
  balanced: 900,
  ultra: 2500,
}

export default function PlanetLabel({ name, offset, bodyId }: PlanetLabelProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const worldPositionRef = useRef(new THREE.Vector3())
  const projectedPositionRef = useRef(new THREE.Vector3())

  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const quality = getEffectiveQuality({ preset, autoQuality })
  const isSelected = bodyId ? selectedBody === bodyId : false
  const labelId = bodyId ?? name.toLowerCase().replace(/\s+/g, '-')

  useFrameLane({
    id: `label:${labelId}`,
    lane: isSelected ? 'critical' : 'decorative',
    priority: isSelected ? -10 : 40,
  }, ({ state }) => {
    if (!groupRef.current) return

    if (isSelected) {
      groupRef.current.visible = true
      return
    }

    const worldPosition = groupRef.current.getWorldPosition(worldPositionRef.current)
    const cameraDistance = state.camera.position.distanceTo(worldPosition)
    const projected = projectedPositionRef.current.copy(worldPosition).project(state.camera)
    const insideViewport =
      projected.z >= -1 &&
      projected.z <= 1 &&
      Math.abs(projected.x) <= 1.12 &&
      Math.abs(projected.y) <= 1.12

    groupRef.current.visible =
      insideViewport && cameraDistance <= MAX_LABEL_DISTANCE[quality]
  })

  const labelWidth = name.length * 0.12 + 0.2
  const bgOpacity = isSelected ? 0.85 : 0.6
  const accentColor = '#fbbf24'

  return (
    <group ref={groupRef} position={[0, offset + 0.5, 0]}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[labelWidth, isSelected ? 0.25 : 0.2]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={bgOpacity}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, isSelected ? -0.12 : -0.1, -0.004]}>
          <planeGeometry args={[labelWidth * 0.9, isSelected ? 0.025 : 0.015]} />
          <meshBasicMaterial
            color={accentColor}
            transparent
            opacity={isSelected ? 0.8 : 0.5}
            depthWrite={false}
          />
        </mesh>
        <Text
          fontSize={isSelected ? 0.14 : 0.12}
          color={isSelected ? '#fbbf24' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
          font={undefined}
        >
          {name}
        </Text>
      </Billboard>
    </group>
  )
}
