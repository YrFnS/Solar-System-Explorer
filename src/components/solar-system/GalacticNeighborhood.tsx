'use client'

import { useMemo, useRef } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

export default function GalacticNeighborhood() {
  const cloudRef = useRef<THREE.Points>(null)
  const alphaCentauriRef = useRef<THREE.Group>(null)
  const galacticCenterRef = useRef<THREE.Group>(null)
  const showGalactic = useSolarSystemStore((state) => state.showGalacticNeighborhood)
  const isPaused = useSolarSystemStore((state) => state.isPaused)

  const count = 5000
  const cloudRadius = 1000

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const cols = new Float32Array(count * 3)
    const random = seededRandom(456)
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const u = random()
      const v = random()
      const theta = u * 2.0 * Math.PI
      const phi = Math.acos(2.0 * v - 1.0)
      const r = cloudRadius * Math.sqrt(random())

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)

      color.setHSL(0.6, 0.3, random() * 0.2 + 0.1)
      cols[i * 3] = color.r
      cols[i * 3 + 1] = color.g
      cols[i * 3 + 2] = color.b
    }
    return [pos, cols]
  }, [])

  useFrameLane({
    id: 'galactic-neighborhood',
    lane: 'decorative',
    priority: 89,
    enabled: showGalactic,
  }, ({ laneDelta }) => {
    if (cloudRef.current && !isPaused) {
      cloudRef.current.rotation.y += laneDelta * 0.006
    }

    if (galacticCenterRef.current) {
      galacticCenterRef.current.rotation.y += laneDelta * 0.003
    }
  })

  if (!showGalactic) return null

  return (
    <group>
      <points ref={cloudRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={5}
          vertexColors
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      <group position={[800, 200, -500]} ref={alphaCentauriRef}>
        <mesh position={[-2, 0, 0]}>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={1} />
        </mesh>
        <mesh position={[2, 0, 0]}>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshStandardMaterial color="#ffcc99" emissive="#ffcc99" emissiveIntensity={1} />
        </mesh>
        <mesh position={[10, 5, 10]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ff6666" emissive="#ff6666" emissiveIntensity={1} />
        </mesh>
        <mesh position={[10.5, 5, 10.5]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
        <Text position={[0, 5, 0]} fontSize={10} color="white">
          Alpha Centauri System
        </Text>
      </group>

      <group position={[0, 0, -5000]} ref={galacticCenterRef}>
        <mesh>
          <sphereGeometry args={[50, 64, 64]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[100, 20, 16, 100]} />
          <meshBasicMaterial color="#ffaa00" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
        </mesh>
        <Text position={[0, 150, 0]} fontSize={50} color="white">
          Galactic Center (Sagittarius A*)
        </Text>
      </group>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -5000]}>
        <ringGeometry args={[4995, 5005, 128]} />
        <meshBasicMaterial color="#4444ff" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
