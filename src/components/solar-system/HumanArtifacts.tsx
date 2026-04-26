'use client'

import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { humanArtifacts, planets } from './data'
import { useSolarSystemStore } from './store'

function ISSArtifact({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[0]
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(Math.random() * Math.PI * 2)
  const parentAngleRef = useRef(Math.random() * Math.PI * 2)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current && planet) {
      parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
      const parentAngle = parentAngleRef.current
      const parentX = Math.cos(parentAngle) * planet.orbitRadius
      const parentZ = Math.sin(parentAngle) * planet.orbitRadius

      orbitAngleRef.current += delta * artifact.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current
      groupRef.current.position.x = parentX + Math.cos(angle) * artifact.orbitRadius
      groupRef.current.position.z = parentZ + Math.sin(angle) * artifact.orbitRadius
      groupRef.current.position.y = Math.sin(angle * 2) * 0.05

      // ISS slowly tumbles
      groupRef.current.rotation.x += delta * 0.3
      groupRef.current.rotation.z += delta * 0.2
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(artifact.id)
  }

  return (
    <group ref={groupRef}>
      <group onClick={handleClick}>
        {/* Main body - habitat modules */}
        <mesh>
          <capsuleGeometry args={[0.015, 0.04, 4, 8]} />
          <meshStandardMaterial
            color="#CCCCCC"
            emissive="#AAAACC"
            emissiveIntensity={0.2}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        {/* Solar panels */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.002, 0.03]} />
          <meshStandardMaterial
            color="#2244AA"
            emissive="#1133AA"
            emissiveIntensity={0.3}
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
        {/* Glow for visibility */}
        <pointLight color="#8888FF" intensity={0.15} distance={1.5} />
      </group>
    </group>
  )
}

function VoyagerArtifact({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[0]
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(Math.random() * Math.PI * 2)
  const parentAngleRef = useRef(Math.random() * Math.PI * 2)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current && planet) {
      parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
      const parentAngle = parentAngleRef.current
      const parentX = Math.cos(parentAngle) * planet.orbitRadius
      const parentZ = Math.sin(parentAngle) * planet.orbitRadius

      orbitAngleRef.current += delta * artifact.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current

      // Voyager is far from its parent planet
      groupRef.current.position.x = Math.cos(angle) * artifact.orbitRadius
      groupRef.current.position.z = Math.sin(angle) * artifact.orbitRadius
      groupRef.current.position.y = Math.sin(angle * 0.5) * 0.5
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(artifact.id)
  }

  return (
    <group ref={groupRef}>
      <group onClick={handleClick}>
        {/* Spacecraft body */}
        <mesh>
          <boxGeometry args={[0.03, 0.02, 0.04]} />
          <meshStandardMaterial
            color="#D4A050"
            emissive="#D4A050"
            emissiveIntensity={0.4}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        {/* Antenna dish */}
        <mesh position={[0, 0.02, 0]} rotation={[0.3, 0, 0]}>
          <coneGeometry args={[0.02, 0.015, 8]} />
          <meshStandardMaterial
            color="#CCCCCC"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* Signal glow */}
        <pointLight color="#FFD700" intensity={0.3} distance={3} />
      </group>
    </group>
  )
}

function HubbleArtifact({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[0]
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(Math.random() * Math.PI * 2)
  const parentAngleRef = useRef(Math.random() * Math.PI * 2)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current && planet) {
      parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
      const parentAngle = parentAngleRef.current
      const parentX = Math.cos(parentAngle) * planet.orbitRadius
      const parentZ = Math.sin(parentAngle) * planet.orbitRadius

      orbitAngleRef.current += delta * artifact.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current
      groupRef.current.position.x = parentX + Math.cos(angle) * artifact.orbitRadius
      groupRef.current.position.z = parentZ + Math.sin(angle) * artifact.orbitRadius
      groupRef.current.position.y = Math.sin(angle * 3) * 0.03

      groupRef.current.rotation.y += delta * 0.1
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(artifact.id)
  }

  return (
    <group ref={groupRef}>
      <group onClick={handleClick}>
        {/* Telescope tube */}
        <mesh>
          <cylinderGeometry args={[0.015, 0.02, 0.05, 8]} />
          <meshStandardMaterial
            color="#AABBCC"
            emissive="#8899BB"
            emissiveIntensity={0.2}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* Solar panels */}
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.08, 0.002, 0.025]} />
          <meshStandardMaterial
            color="#3344AA"
            emissive="#2233AA"
            emissiveIntensity={0.3}
          />
        </mesh>
        <pointLight color="#6688FF" intensity={0.12} distance={1.5} />
      </group>
    </group>
  )
}

export default function HumanArtifacts() {
  return (
    <group>
      {humanArtifacts.map((artifact) => {
        if (artifact.id === 'iss') {
          return <ISSArtifact key={artifact.id} artifact={artifact} />
        }
        if (artifact.id.startsWith('voyager')) {
          return <VoyagerArtifact key={artifact.id} artifact={artifact} />
        }
        if (artifact.id === 'hubble') {
          return <HubbleArtifact key={artifact.id} artifact={artifact} />
        }
        return null
      })}
    </group>
  )
}
