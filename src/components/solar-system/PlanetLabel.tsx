'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

interface PlanetLabelProps {
  name: string
  offset: number
  bodyId?: string
}

export default function PlanetLabel({ name, offset, bodyId }: PlanetLabelProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const isSelected = bodyId ? selectedBody === bodyId : false

  useFrame(({ camera }) => {
    if (groupRef.current) {
      // Make label always face camera and maintain size
      groupRef.current.lookAt(camera.position)
    }
  })

  const labelWidth = name.length * 0.12 + 0.2
  const bgOpacity = isSelected ? 0.85 : 0.6
  const accentColor = '#fbbf24'

  return (
    <group ref={groupRef} position={[0, offset + 0.5, 0]}>
      {/* Background pill with rounded appearance */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[labelWidth, isSelected ? 0.25 : 0.2]} />
        <meshBasicMaterial color="#000000" transparent opacity={bgOpacity} depthWrite={false} />
      </mesh>
      {/* Colored accent line — brighter when selected */}
      <mesh position={[0, isSelected ? -0.12 : -0.1, -0.004]}>
        <planeGeometry args={[labelWidth * 0.9, isSelected ? 0.025 : 0.015]} />
        <meshBasicMaterial color={accentColor} transparent opacity={isSelected ? 0.8 : 0.5} depthWrite={false} />
      </mesh>
      {/* Label text with strong outline for readability */}
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
    </group>
  )
}
