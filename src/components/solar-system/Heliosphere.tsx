'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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

  useFrame(({ clock }) => {
    if (meshRef.current) {
      // Very slow subtle rotation
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.002
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
      {/* Inner shell - Termination Shock */}
      <HeliosphereShell
        radius={55}
        color="#E8A060"
        opacity={0.02}
        scaleX={1.1}
        wireframe={false}
      />
      {/* Wireframe overlay on termination shock */}
      <HeliosphereShell
        radius={55}
        color="#E8A060"
        opacity={0.015}
        scaleX={1.1}
        wireframe={true}
      />
      {/* Outer shell - Heliopause */}
      <HeliosphereShell
        radius={65}
        color="#6090C8"
        opacity={0.02}
        scaleX={1.1}
        wireframe={false}
      />
      {/* Wireframe overlay on heliopause */}
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
