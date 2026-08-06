'use client'

import { useRef } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { getSpawnedObjectVisualPosition } from './ephemeris'
import { useExperienceStore } from './experience-store'
import { useFrameLane } from './FrameUpdateLanes'
import PlanetLabel from './PlanetLabel'
import { DAY_MS, J2000_UNIX_MS } from './simulation-clock'
import { useSolarSystemStore, type SpawnedObject } from './store'

function SpawnedObjectMesh({ object }: { object: SpawnedObject }) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const positionRef = useRef(new THREE.Vector3())
  const mode = useExperienceStore((state) => state.mode)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)
  const selected = selectedBody === object.id

  useFrameLane({
    id: `spawned-object:${object.id}`,
    lane: selected ? 'critical' : 'ephemeris',
    priority: selected ? -20 : 60,
  }, ({ simulationDateMs }) => {
    if (groupRef.current) {
      groupRef.current.position.copy(
        getSpawnedObjectVisualPosition(
          object,
          simulationDateMs,
          mode,
          positionRef.current
        )
      )
    }
    if (meshRef.current) {
      const days = (simulationDateMs - J2000_UNIX_MS) / DAY_MS
      meshRef.current.rotation.set(days * 0.19, days * 0.31, days * 0.11)
    }
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    setSelectedBody(object.id)
    setFocusTarget(object.id)
  }

  return (
    <group ref={groupRef} name={`spawned:${object.id}`}>
      <mesh ref={meshRef} onClick={handleClick}>
        {object.type === 'asteroid' ? (
          <dodecahedronGeometry args={[object.radius, 1]} />
        ) : (
          <sphereGeometry args={[object.radius, 18, 14]} />
        )}
        <meshStandardMaterial
          color={object.color}
          emissive={object.color}
          emissiveIntensity={object.type === 'comet' ? 0.2 : 0.08}
          roughness={0.76}
          metalness={0.08}
        />
      </mesh>

      <mesh onClick={handleClick}>
        <sphereGeometry args={[Math.max(object.radius * 3, 0.25), 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {(object.type === 'comet' || object.type === 'interstellar') && (
        <mesh position={[0, 0, object.radius * 8]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[object.radius * 1.5, object.radius * 14, 14, 1, true]} />
          <meshBasicMaterial
            color={object.color}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[object.radius * 1.8, object.radius * 2.15, 36]} />
          <meshBasicMaterial
            color="#fbbf24"
            transparent
            opacity={0.82}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      <PlanetLabel
        name={object.name}
        offset={object.radius + 0.35}
        bodyId={object.id}
      />
    </group>
  )
}

export default function EphemerisSpawnedObjects() {
  const spawnedObjects = useSolarSystemStore((state) => state.spawnedObjects)
  if (spawnedObjects.length === 0) return null

  return (
    <>
      {spawnedObjects.map((object) => (
        <SpawnedObjectMesh key={object.id} object={object} />
      ))}
    </>
  )
}
