'use client'

import { useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore, SpawnedObject } from './store'
import PlanetLabel from './PlanetLabel'

interface SpawnedObjectProps {
  obj: SpawnedObject
}

function SpawnedObjectMesh({ obj }: SpawnedObjectProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const meshRef = useRef<THREE.Mesh>(null)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const isPaused = useSolarSystemStore((s) => s.isPaused)

  useFrame((_, delta) => {
    if (groupRef.current && !isPaused) {
      // Calculate position based on orbit type
      if (obj.type === 'interstellar') {
        // Hyperbolic trajectory
        const angle = Date.now() * 0.0001 * obj.orbitSpeed + obj.initialAngle
        const e = obj.orbitEccentricity
        const a = obj.orbitRadius
        const denom = 1 + e * Math.cos(angle)
        const r = denom > 0.1 ? Math.min(a * (e * e - 1) / denom, 100) : 100
        groupRef.current.position.x = Math.cos(angle) * r
        groupRef.current.position.z = Math.sin(angle) * r
        groupRef.current.position.y = Math.sin(angle) * obj.orbitInclination * 0.1
      } else {
        // Elliptical orbit
        const angle = Date.now() * 0.0001 * obj.orbitSpeed + obj.initialAngle
        const e = obj.orbitEccentricity
        const a = obj.orbitRadius
        const r = a * (1 - e * e) / (1 + e * Math.cos(angle))
        groupRef.current.position.x = Math.cos(angle) * r
        groupRef.current.position.z = Math.sin(angle) * r
        groupRef.current.position.y = Math.sin(angle) * obj.orbitInclination * 0.1
      }

      // Rotate the object
      if (meshRef.current) {
        meshRef.current.rotation.y += delta * 0.5 * timeSpeed
      }
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(obj.id)
  }

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} onClick={handleClick}>
        <sphereGeometry args={[obj.radius, 16, 16]} />
        <meshStandardMaterial
          color={obj.color}
          emissive={obj.color}
          emissiveIntensity={0.3}
          roughness={0.7}
          metalness={0.2}
        />
      </mesh>
      {/* Hit area */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[obj.radius * 3, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <PlanetLabel name={obj.name} offset={obj.radius + 0.5} bodyId={obj.id} />
    </group>
  )
}

export default function SpawnedObjects() {
  const spawnedObjects = useSolarSystemStore((s) => s.spawnedObjects)

  if (spawnedObjects.length === 0) return null

  return (
    <>
      {spawnedObjects.map((obj) => (
        <SpawnedObjectMesh key={obj.id} obj={obj} />
      ))}
    </>
  )
}
