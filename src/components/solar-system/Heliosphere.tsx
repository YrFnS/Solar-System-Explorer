'use client'

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'

function HeliosphereShell({
  radius,
  color,
  opacity,
  scaleX,
  wireframe,
}: {
  radius: number
  color: string
  opacity: number
  scaleX: number
  wireframe: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrameLane({
    id: `heliosphere:${radius}:${wireframe ? 'wire' : 'shell'}`,
    lane: 'decorative',
    priority: 88,
  }, ({ nowMs }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = (nowMs / 1_000) * 0.002
    }
  })

  return (
    <mesh ref={meshRef} scale={[scaleX, 1, 1]}>
      <sphereGeometry args={[radius, 64, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        wireframe={wireframe}
      />
    </mesh>
  )
}

export default function Heliosphere() {
  const showHeliosphere = useSolarSystemStore((s) => s.showHeliosphere)

  if (!showHeliosphere) return null

  return (
    <group>
      <HeliosphereShell
        radius={55}
        color="#E8A060"
        opacity={0.02}
        scaleX={1.1}
        wireframe={false}
      />
      <HeliosphereShell
        radius={55}
        color="#E8A060"
        opacity={0.015}
        scaleX={1.1}
        wireframe={true}
      />
      <HeliosphereShell
        radius={65}
        color="#6090C8"
        opacity={0.02}
        scaleX={1.1}
        wireframe={false}
      />
      <HeliosphereShell
        radius={65}
        color="#6090C8"
        opacity={0.015}
        scaleX={1.1}
        wireframe={true}
      />
    </group>
  )
}
