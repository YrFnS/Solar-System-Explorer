'use client'

import { useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { MoonData } from './data'
import { useSolarSystemStore } from './store'

interface MoonProps {
  moonData: MoonData
  parentId: string
}

import { useTexture } from '@react-three/drei'

function TexturedMoon({ moonData, meshRef, handleClick }: any) {
  const texture = useTexture(moonData.textureUrl!) as THREE.Texture
  return (
    <mesh ref={meshRef} onClick={handleClick}>
      <sphereGeometry args={[moonData.radius, 32, 32]} />
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0.1} />
    </mesh>
  )
}

function ColorMoon({ moonData, meshRef, handleClick }: any) {
  return (
    <mesh ref={meshRef} onClick={handleClick}>
      <sphereGeometry args={[moonData.radius, 16, 16]} />
      <meshStandardMaterial color={moonData.color} roughness={0.9} metalness={0.1} />
    </mesh>
  )
}

export default function MoonComponent({ moonData, parentId }: MoonProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const meshRef = useRef<THREE.Mesh>(null)
  const orbitAngleRef = useRef(Math.PI * 0.5)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  useFrame((_, delta) => {
    if (groupRef.current) {
      orbitAngleRef.current += delta * moonData.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current
      groupRef.current.position.x = Math.cos(angle) * moonData.orbitRadius
      groupRef.current.position.z = Math.sin(angle) * moonData.orbitRadius
    }
    // Moons are tidally locked — rotation period ≈ orbital period
    // Use inverse of orbital period for visible rotation
    if (meshRef.current) {
      const rotationFactor = 50 / Math.max(moonData.orbitalPeriod, 1)
      meshRef.current.rotation.y += delta * rotationFactor * timeSpeed
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(`${parentId}-${moonData.name.toLowerCase()}`)
  }

  return (
    <group ref={groupRef}>
      {moonData.textureUrl ? (
        <TexturedMoon moonData={moonData} meshRef={meshRef} handleClick={handleClick} />
      ) : (
        <ColorMoon moonData={moonData} meshRef={meshRef} handleClick={handleClick} />
      )}
    </group>
  )
}
