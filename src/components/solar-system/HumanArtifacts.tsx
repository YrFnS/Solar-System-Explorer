'use client'

import {
  Component,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { humanArtifacts } from './data'
import { getBodyVisualPosition } from './ephemeris'
import { useExperienceStore } from './experience-store'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'

class CatchBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function GLTFModel({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => scene.clone(), [scene])
  return <primitive object={clone} scale={scale} />
}

function ArtifactRenderer({
  artifact,
  fallback,
}: {
  artifact: (typeof humanArtifacts)[number]
  fallback: ReactNode
}) {
  if (!artifact.modelUrl) return <>{fallback}</>

  return (
    <CatchBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GLTFModel url={artifact.modelUrl} scale={artifact.size || 1} />
      </Suspense>
    </CatchBoundary>
  )
}

function SolarPanel({
  position,
  scale = 1,
  rotation,
}: {
  position: [number, number, number]
  scale?: number
  rotation?: [number, number, number]
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={[0.11 * scale, 0.004 * scale, 0.045 * scale]} />
      <meshStandardMaterial
        color="#1b3d82"
        emissive="#10265c"
        emissiveIntensity={0.28}
        metalness={0.55}
        roughness={0.38}
      />
    </mesh>
  )
}

function ISSFallback() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.22, 0.008, 0.008]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.016, 0.016, 0.065, 10]} />
        <meshStandardMaterial color="#eeeeee" metalness={0.7} roughness={0.3} />
      </mesh>
      <SolarPanel position={[0.085, 0, 0]} scale={0.9} rotation={[0, 0, Math.PI / 2]} />
      <SolarPanel position={[-0.085, 0, 0]} scale={0.9} rotation={[0, 0, Math.PI / 2]} />
      <pointLight color="#8ea5ff" intensity={0.15} distance={1.5} />
    </group>
  )
}

function VoyagerFallback() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.04, 0.025, 0.06]} />
        <meshStandardMaterial
          color="#d4a050"
          emissive="#8a5f20"
          emissiveIntensity={0.32}
          metalness={0.75}
          roughness={0.28}
        />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[1.2, 0, 0]}>
        <coneGeometry args={[0.038, 0.018, 18]} />
        <meshStandardMaterial color="#ffd36a" metalness={0.9} roughness={0.12} />
      </mesh>
      <mesh position={[-0.045, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.09, 8]} />
        <meshStandardMaterial color="#777777" metalness={0.72} roughness={0.3} />
      </mesh>
      <pointLight color="#ffd36a" intensity={0.24} distance={2.5} />
    </group>
  )
}

function TelescopeFallback({ color = '#aabbcc' }: { color?: string }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.027, 0.075, 16]} />
        <meshStandardMaterial color={color} metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0, 0.039]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.003, 18]} />
        <meshStandardMaterial color="#ffd35a" metalness={1} roughness={0.08} />
      </mesh>
      <SolarPanel position={[0.06, 0, 0]} scale={0.7} />
      <SolarPanel position={[-0.06, 0, 0]} scale={0.7} />
    </group>
  )
}

function JWSTFallback() {
  return (
    <group scale={0.55}>
      {[0, 1, 2, 3, 4].map((layer) => (
        <mesh
          key={layer}
          position={[0, -0.08 + layer * 0.008, 0]}
          scale={[1 - layer * 0.04, 1, 1 - layer * 0.04]}
        >
          <boxGeometry args={[0.62, 0.003, 0.36]} />
          <meshStandardMaterial
            color={layer % 2 === 0 ? '#f3f0dc' : '#dedcc8'}
            metalness={0.35}
            roughness={0.58}
            transparent
            opacity={0.88 - layer * 0.09}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <mesh position={[0, -0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.014, 6]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#b8860b"
          emissiveIntensity={0.42}
          metalness={1}
          roughness={0.08}
        />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[0.13, 0.06, 0.11]} />
        <meshStandardMaterial color="#858585" metalness={0.68} roughness={0.4} />
      </mesh>
      <pointLight color="#ffd700" intensity={0.22} distance={1.5} />
    </group>
  )
}

function ParkerFallback() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.024, 0.018, 0.024]} />
        <meshStandardMaterial
          color="#ff6347"
          emissive="#ff4500"
          emissiveIntensity={0.3}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, -0.014, 0]}>
        <coneGeometry args={[0.018, 0.012, 12]} />
        <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.62} />
      </mesh>
      <pointLight color="#ff6347" intensity={0.14} distance={1.5} />
    </group>
  )
}

function SatelliteFallback({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[number]
}) {
  const scale = Math.max(0.04, artifact.size)

  if (artifact.id === 'iss') return <ISSFallback />
  if (artifact.id.startsWith('voyager')) return <VoyagerFallback />
  if (artifact.id === 'hubble') return <TelescopeFallback />
  if (artifact.id === 'chandra') return <TelescopeFallback color="#aa8844" />
  if (artifact.id === 'jwst') return <JWSTFallback />
  if (artifact.id === 'parker') return <ParkerFallback />

  return (
    <group>
      <mesh>
        <boxGeometry args={[scale * 0.58, scale * 0.42, scale * 0.62]} />
        <meshStandardMaterial
          color={artifact.color}
          emissive={artifact.color}
          emissiveIntensity={0.14}
          metalness={0.62}
          roughness={0.38}
        />
      </mesh>
      <SolarPanel position={[scale * 0.72, 0, 0]} scale={scale * 5.5} />
      <SolarPanel position={[-scale * 0.72, 0, 0]} scale={scale * 5.5} />
    </group>
  )
}

function getArtifactVerticalOffset(
  artifact: (typeof humanArtifacts)[number],
  angle: number
) {
  if (artifact.id === 'jwst') return Math.sin(angle * 2) * 0.1
  if (artifact.id === 'parker') return Math.sin(angle * 3) * 0.3
  if (artifact.id === 'hubble') return Math.sin(angle * 3) * 0.03
  if (artifact.id.startsWith('voyager')) return Math.sin(angle * 0.5) * 0.5
  return Math.sin(angle * 2) * 0.05
}

function ArtifactNode({
  artifact,
  register,
}: {
  artifact: (typeof humanArtifacts)[number]
  register: (artifactId: string, group: THREE.Group | null) => void
}) {
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    setSelectedBody(artifact.id)
  }

  return (
    <group
      ref={(group) => register(artifact.id, group)}
      name={`artifact:${artifact.id}`}
    >
      <group onClick={handleClick}>
        <ArtifactRenderer
          artifact={artifact}
          fallback={<SatelliteFallback artifact={artifact} />}
        />
      </group>
    </group>
  )
}

export default function HumanArtifacts() {
  const groupsRef = useRef(new Map<string, THREE.Group>())
  const parentPositionRef = useRef(new THREE.Vector3())
  const mode = useExperienceStore((state) => state.mode)

  const register = useCallback((artifactId: string, group: THREE.Group | null) => {
    if (group) groupsRef.current.set(artifactId, group)
    else groupsRef.current.delete(artifactId)
  }, [])

  useFrameLane({
    id: 'human-artifacts',
    lane: 'ephemeris',
    priority: 70,
    enabled: humanArtifacts.length > 0,
  }, ({ simulationDateMs }) => {
    const simulatedMinutes = simulationDateMs / 60_000

    for (let index = 0; index < humanArtifacts.length; index += 1) {
      const artifact = humanArtifacts[index]
      const group = groupsRef.current.get(artifact.id)
      if (!group) continue

      const parentPosition = parentPositionRef.current.set(0, 0, 0)
      if (artifact.parentId && artifact.parentId !== 'sun') {
        getBodyVisualPosition(
          artifact.parentId,
          simulationDateMs,
          mode,
          parentPosition
        )
      }

      const phase = 0.31 + index * 0.83
      const angle = phase + simulatedMinutes * artifact.orbitSpeed * 0.05
      group.position.set(
        parentPosition.x + Math.cos(angle) * artifact.orbitRadius,
        parentPosition.y + getArtifactVerticalOffset(artifact, angle),
        parentPosition.z + Math.sin(angle) * artifact.orbitRadius
      )
      group.rotation.set(
        Math.sin(angle * 0.37) * 0.18,
        angle * 0.14,
        Math.cos(angle * 0.23) * 0.16
      )
    }
  })

  return (
    <group name="human-artifacts">
      {humanArtifacts.map((artifact) => (
        <ArtifactNode
          key={artifact.id}
          artifact={artifact}
          register={register}
        />
      ))}
    </group>
  )
}
