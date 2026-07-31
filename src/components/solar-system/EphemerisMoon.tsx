'use client'

import { useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { MoonData } from './data'
import {
  getMoonLocalPosition,
  getMoonRotationAngle,
} from './ephemeris'
import { useExperienceStore } from './experience-store'
import PlanetLabel from './PlanetLabel'
import { getSimulationDateMs } from './simulation-clock'
import { useSolarSystemStore } from './store'

interface EphemerisMoonProps {
  moon: MoonData
  parentId: string
}

function TexturedMoonSurface({
  moon,
  meshRef,
  onClick,
}: {
  moon: MoonData
  meshRef: React.RefObject<THREE.Mesh | null>
  onClick: (event: ThreeEvent<MouseEvent>) => void
}) {
  const texture = useTexture(moon.textureUrl!)

  return (
    <mesh ref={meshRef} onClick={onClick}>
      <sphereGeometry args={[moon.radius, 28, 20]} />
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0.05} />
    </mesh>
  )
}

function ColorMoonSurface({
  moon,
  meshRef,
  onClick,
}: {
  moon: MoonData
  meshRef: React.RefObject<THREE.Mesh | null>
  onClick: (event: ThreeEvent<MouseEvent>) => void
}) {
  return (
    <mesh ref={meshRef} onClick={onClick}>
      <sphereGeometry args={[moon.radius, 16, 12]} />
      <meshStandardMaterial color={moon.color} roughness={0.92} metalness={0.03} />
    </mesh>
  )
}

export default function EphemerisMoon({ moon, parentId }: EphemerisMoonProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const positionRef = useRef(new THREE.Vector3())
  const mode = useExperienceStore((state) => state.mode)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)
  const showLabels = useSolarSystemStore((state) => state.showLabels)
  const moonId = `${parentId}-${moon.name.toLowerCase().replace(/\s+/g, '-')}`
  const selected = selectedBody === moonId

  useFrame(() => {
    const dateMs = getSimulationDateMs()
    if (groupRef.current) {
      groupRef.current.position.copy(
        getMoonLocalPosition(
          moon,
          parentId,
          dateMs,
          mode,
          positionRef.current
        )
      )
    }
    if (meshRef.current) {
      meshRef.current.rotation.y = getMoonRotationAngle(moon, dateMs)
    }
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    setSelectedBody(moonId)
    setFocusTarget(moonId)
  }

  return (
    <group ref={groupRef}>
      {moon.textureUrl ? (
        <TexturedMoonSurface moon={moon} meshRef={meshRef} onClick={handleClick} />
      ) : (
        <ColorMoonSurface moon={moon} meshRef={meshRef} onClick={handleClick} />
      )}

      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[moon.radius * 1.45, moon.radius * 1.65, 32]} />
          <meshBasicMaterial
            color="#fbbf24"
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {showLabels && (selected || mode === 'scientific') && (
        <PlanetLabel
          name={moon.name}
          offset={moon.radius + 0.12}
          bodyId={moonId}
        />
      )}
    </group>
  )
}
