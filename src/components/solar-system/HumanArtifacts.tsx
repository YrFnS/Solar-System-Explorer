'use client'

import { useRef, useMemo, Suspense, Component } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { humanArtifacts, planets } from './data'
import { useSolarSystemStore } from './store'

class CatchBoundary extends Component<{fallback: React.ReactNode, children: React.ReactNode}, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

function GLTFModel({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => scene.clone(), [scene])
  return <primitive object={clone} scale={scale} />
}

function ArtifactRenderer({ artifact, fallback }: { artifact: any, fallback: React.ReactNode }) {
  if (artifact.modelUrl) {
    return (
      <CatchBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <GLTFModel url={artifact.modelUrl} scale={artifact.size || 1} />
        </Suspense>
      </CatchBoundary>
    )
  }
  return <>{fallback}</>
}

function ISSArtifact({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[0]
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(0.5)
  const parentAngleRef = useRef(0.3)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current) {
      let parentX = 0
      let parentZ = 0

      if (planet) {
        parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
        const parentAngle = parentAngleRef.current
        parentX = Math.cos(parentAngle) * planet.orbitRadius
        parentZ = Math.sin(parentAngle) * planet.orbitRadius
      }

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
        <ArtifactRenderer
          artifact={artifact}
          fallback={
            <>
              {/* Main truss backbone */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.18, 0.008, 0.008]} />
                <meshStandardMaterial color="#CCCCCC" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Central module (Unity node) */}
              <mesh>
                <cylinderGeometry args={[0.012, 0.012, 0.025, 8]} />
                <meshStandardMaterial color="#EEEEEE" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Starboard solar array */}
              <mesh position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.005, 0.06, 0.03]} />
                <meshStandardMaterial color="#1a3a7a" metalness={0.5} roughness={0.4} emissive="#0a1a3a" emissiveIntensity={0.3} />
              </mesh>
              {/* Port solar array */}
              <mesh position={[-0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.005, 0.06, 0.03]} />
                <meshStandardMaterial color="#1a3a7a" metalness={0.5} roughness={0.4} emissive="#0a1a3a" emissiveIntensity={0.3} />
              </mesh>
              {/* Zarya module */}
              <mesh position={[0.05, 0, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.015, 8]} />
                <meshStandardMaterial color="#AAAAAA" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Destiny lab */}
              <mesh position={[-0.05, 0, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
                <meshStandardMaterial color="#EEEEEE" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Quest airlock */}
              <mesh position={[0, 0, 0.01]}>
                <cylinderGeometry args={[0.006, 0.006, 0.01, 8]} />
                <meshStandardMaterial color="#DDDDDD" metalness={0.6} roughness={0.4} />
              </mesh>
              <pointLight color="#8888FF" intensity={0.15} distance={1.5} />
            </>
          }
        />
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
  const orbitAngleRef = useRef(0.5)
  const parentAngleRef = useRef(0.3)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  // Voyager orbits the Sun directly - find planet parent or handle 'sun' case
  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current) {
      let parentX = 0
      let parentZ = 0
      let parentOrbitSpeed = artifact.orbitSpeed

      if (planet) {
        parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
        const parentAngle = parentAngleRef.current
        parentX = Math.cos(parentAngle) * planet.orbitRadius
        parentZ = Math.sin(parentAngle) * planet.orbitRadius
        parentOrbitSpeed = planet.orbitSpeed
      }

      orbitAngleRef.current += delta * artifact.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current

      // Voyager orbits the Sun at vast distances
      groupRef.current.position.x = parentX + Math.cos(angle) * artifact.orbitRadius
      groupRef.current.position.z = parentZ + Math.sin(angle) * artifact.orbitRadius
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
        <ArtifactRenderer
          artifact={artifact}
          fallback={
            <>
              {/* Main bus body */}
              <mesh>
                <boxGeometry args={[0.04, 0.025, 0.06]} />
                <meshStandardMaterial color="#D4A050" emissive="#D4A050" emissiveIntensity={0.4} metalness={0.7} roughness={0.3} />
              </mesh>
              {/* High-gain dish antenna (gold) */}
              <mesh position={[0, 0.025, 0]} rotation={[1.2, 0, 0]}>
                <coneGeometry args={[0.035, 0.015, 16]} />
                <meshStandardMaterial color="#FFD700" emissive="#DAA520" emissiveIntensity={0.5} metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Gold Record (圆盘) */}
              <mesh position={[0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.015, 0.015, 0.003, 16]} />
                <meshStandardMaterial color="#CC9966" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Nuclear power source (RTG) */}
              <mesh position={[-0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.008, 0.008, 0.04, 8]} />
                <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Magnetometer boom */}
              <mesh position={[0, -0.02, 0.03]} rotation={[0.3, 0, 0]}>
                <boxGeometry args={[0.002, 0.002, 0.06]} />
                <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
              </mesh>
              <pointLight color="#FFD700" intensity={0.3} distance={3} />
            </>
          }
        />
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
  const orbitAngleRef = useRef(0.5)
  const parentAngleRef = useRef(0.3)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current) {
      let parentX = 0
      let parentZ = 0

      if (planet) {
        parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
        const parentAngle = parentAngleRef.current
        parentX = Math.cos(parentAngle) * planet.orbitRadius
        parentZ = Math.sin(parentAngle) * planet.orbitRadius
      }

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
        <ArtifactRenderer
          artifact={artifact}
          fallback={
            <>
              {/* Main telescope tube */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.025, 0.07, 16]} />
                <meshStandardMaterial color="#AABBCC" emissive="#8899BB" emissiveIntensity={0.2} metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Primary mirror (gold, at bottom) */}
              <mesh position={[0, 0, 0.036]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.002, 16]} />
                <meshStandardMaterial color="#FFD700" emissive="#DAA520" emissiveIntensity={0.5} metalness={1.0} roughness={0.1} />
              </mesh>
              {/* Secondary mirror support */}
              <mesh position={[0, 0, -0.04]}>
                <cylinderGeometry args={[0.005, 0.005, 0.015, 8]} />
                <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Solar panels (bus-mounted) */}
              <mesh position={[0, 0, 0.01]} rotation={[0, Math.PI / 2, 0]}>
                <boxGeometry args={[0.06, 0.001, 0.02]} />
                <meshStandardMaterial color="#3344AA" emissive="#2233AA" emissiveIntensity={0.3} metalness={0.5} roughness={0.4} />
              </mesh>
              <pointLight color="#6688FF" intensity={0.12} distance={1.5} />
            </>
          }
        />
      </group>
    </group>
  )
}

function JWSTArtifact({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[0]
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(0.5)
  const parentAngleRef = useRef(0.3)
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
      groupRef.current.position.y = Math.sin(angle * 2) * 0.1

      groupRef.current.rotation.y += delta * 0.02
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(artifact.id)
  }

  // JWST sunshield dimensions: ~22m x 12m (tennis court size)
  // Primary mirror: 6.5m diameter, 18 hexagonal segments
  const sunshieldWidth = 0.6
  const sunshieldDepth = 0.35
  const sunshieldGap = 0.008

  return (
    <group ref={groupRef}>
      <group onClick={handleClick}>
        <ArtifactRenderer
          artifact={artifact}
          fallback={
            <group scale={0.5}>
              {/* Sunshield booms (left and right extentions) */}
              <mesh position={[0, -0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[sunshieldWidth * 1.1, 0.006, 0.008]} />
                <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.3} />
              </mesh>

              {/* Sunshield layers - 5 distinct layers (layer 1 = top, layer 5 = bottom) */}
              {[0, 1, 2, 3, 4].map((i) => {
                const scale = 1 - i * 0.04
                const yPos = -0.08 + i * sunshieldGap
                const opacity = 0.85 - i * 0.1
                const color = i % 2 === 0 ? '#F5F5DC' : '#E8E8D0'
                return (
                  <mesh key={`sunshield-${i}`} position={[0, yPos, 0]} scale={[scale, 1, scale]}>
                    <boxGeometry args={[sunshieldWidth, 0.003, sunshieldDepth]} />
                    <meshStandardMaterial
                      color={color}
                      metalness={0.3}
                      roughness={0.6}
                      transparent
                      opacity={opacity}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                )
              })}

              {/* Sunshield frame edges */}
              <mesh position={[sunshieldWidth / 2, -0.08, 0]}>
                <boxGeometry args={[0.005, 0.04, sunshieldDepth * 1.02]} />
                <meshStandardMaterial color="#666666" metalness={0.7} roughness={0.4} />
              </mesh>
              <mesh position={[-sunshieldWidth / 2, -0.08, 0]}>
                <boxGeometry args={[0.005, 0.04, sunshieldDepth * 1.02]} />
                <meshStandardMaterial color="#666666" metalness={0.7} roughness={0.4} />
              </mesh>

              {/* Spacecraft bus (center module below sunshield) */}
              <mesh position={[0, -0.13, 0]}>
                <boxGeometry args={[0.12, 0.06, 0.1]} />
                <meshStandardMaterial color="#8B8B8B" metalness={0.7} roughness={0.4} />
              </mesh>

              {/* Solar panels on bus */}
              <mesh position={[0, -0.16, 0.06]} rotation={[0.3, 0, 0]}>
                <boxGeometry args={[0.2, 0.002, 0.08]} />
                <meshStandardMaterial color="#1a1a4a" emissive="#0a0a2a" emissiveIntensity={0.2} metalness={0.5} roughness={0.5} />
              </mesh>
              <mesh position={[0, -0.16, -0.06]} rotation={[-0.3, 0, 0]}>
                <boxGeometry args={[0.2, 0.002, 0.08]} />
                <meshStandardMaterial color="#1a1a4a" emissive="#0a0a2a" emissiveIntensity={0.2} metalness={0.5} roughness={0.5} />
              </mesh>

              {/* Primary mirror backplane (gold coated support structure) */}
              <mesh position={[0, -0.08, 0]}>
                <cylinderGeometry args={[0.25, 0.25, 0.015, 6]} />
                <meshStandardMaterial color="#B8860B" metalness={0.9} roughness={0.2} />
              </mesh>

              {/* Primary mirror - 18 hexagonal segments arranged in honeycomb */}
              {Array.from({ length: 3 }).map((_, ring) => {
                const segmentsInRing = ring === 0 ? 1 : ring === 1 ? 6 : 12
                const radius = ring * 0.082
                return Array.from({ length: segmentsInRing }).map((__, j) => {
                  const angleOffset = ring === 1 ? (Math.PI / 6) : 0
                  const angle = angleOffset + (j / segmentsInRing) * Math.PI * 2
                  const x = Math.cos(angle) * radius
                  const z = Math.sin(angle) * radius
                  const hexSize = ring === 0 ? 0.075 : ring === 1 ? 0.072 : 0.068
                  return (
                    <mesh key={`mirror-${ring}-${j}`} position={[x, -0.09, z]} rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[hexSize, hexSize, 0.012, 6]} />
                      <meshStandardMaterial
                        color="#FFD700"
                        emissive="#DAA520"
                        emissiveIntensity={0.4}
                        metalness={1.0}
                        roughness={0.1}
                      />
                    </mesh>
                  )
                })
              })}

              {/* Primary mirror center segment */}
              <mesh position={[0, -0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.065, 0.065, 0.012, 6]} />
                <meshStandardMaterial color="#FFD700" emissive="#DAA520" emissiveIntensity={0.4} metalness={1.0} roughness={0.1} />
              </mesh>

              {/* Secondary mirror tripod struts */}
              <mesh position={[0.05, -0.06, 0.05]} rotation={[0.5, 0, 0.3]}>
                <cylinderGeometry args={[0.003, 0.003, 0.18, 6]} />
                <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[-0.05, -0.06, 0.05]} rotation={[0.5, 0, -0.3]}>
                <cylinderGeometry args={[0.003, 0.003, 0.18, 6]} />
                <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.06, -0.06]} rotation={[-0.5, 0, 0]}>
                <cylinderGeometry args={[0.003, 0.003, 0.15, 6]} />
                <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.3} />
              </mesh>

              {/* Secondary mirror (gold coated circle) */}
              <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 0.008, 16]} />
                <meshStandardMaterial color="#FFD700" emissive="#DAA520" emissiveIntensity={0.5} metalness={1.0} roughness={0.05} />
              </mesh>

              {/* Secondary mirror support ring */}
              <mesh position={[0, -0.02, 0]}>
                <torusGeometry args={[0.04, 0.004, 8, 16]} />
                <meshStandardMaterial color="#666666" metalness={0.8} roughness={0.3} />
              </mesh>

              {/* Gold tint light */}
              <pointLight color="#FFD700" intensity={0.25} distance={1.5} />
            </group>
          }
        />
      </group>
    </group>
  )
}

function EarthOrbitArtifact({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[0]
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(Math.random() * Math.PI * 2)
  const parentAngleRef = useRef(0.3)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current) {
      let parentX = 0
      let parentZ = 0

      if (planet) {
        parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
        const parentAngle = parentAngleRef.current
        parentX = Math.cos(parentAngle) * planet.orbitRadius
        parentZ = Math.sin(parentAngle) * planet.orbitRadius
      }

      orbitAngleRef.current += delta * artifact.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current
      groupRef.current.position.x = parentX + Math.cos(angle) * artifact.orbitRadius
      groupRef.current.position.z = parentZ + Math.sin(angle) * artifact.orbitRadius
      groupRef.current.position.y = Math.sin(angle * 2) * 0.05

      groupRef.current.rotation.y += delta * 0.2
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(artifact.id)
  }

  // Build shape based on artifact type
  const renderFallback = () => {
    const s = artifact.size

    // GPS satellite - bus with solar panels
    if (artifact.id === 'gps') {
      return (
        <>
          <mesh>
            <boxGeometry args={[s * 0.6, s * 0.5, s * 0.4]} />
            <meshStandardMaterial color={artifact.color} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, s * 0.3, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[s * 1.8, s * 0.05, s * 0.6]} />
            <meshStandardMaterial color="#1a3a6a" metalness={0.5} roughness={0.4} emissive="#0a1a3a" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, -s * 0.3, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[s * 1.8, s * 0.05, s * 0.6]} />
            <meshStandardMaterial color="#1a3a6a" metalness={0.5} roughness={0.4} emissive="#0a1a3a" emissiveIntensity={0.2} />
          </mesh>
        </>
      )
    }

    // Tiangong - space station module
    if (artifact.id === 'tiangong') {
      return (
        <>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[s * 0.4, s * 0.4, s * 1.5, 16]} />
            <meshStandardMaterial color={artifact.color} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[s * 0.6, 0, 0]}>
            <cylinderGeometry args={[s * 0.25, s * 0.25, s * 0.6, 16]} />
            <meshStandardMaterial color="#CCCCCC" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-s * 0.6, 0, 0]}>
            <cylinderGeometry args={[s * 0.25, s * 0.25, s * 0.6, 16]} />
            <meshStandardMaterial color="#CCCCCC" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, s * 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[s * 0.05, s * 1.2, s * 0.3]} />
            <meshStandardMaterial color="#1a3a7a" metalness={0.5} roughness={0.4} />
          </mesh>
        </>
      )
    }

    // Chandra - X-ray telescope (similar to Hubble but different proportions)
    if (artifact.id === 'chandra') {
      return (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[s * 0.3, s * 0.4, s * 1.2, 12]} />
            <meshStandardMaterial color="#AA8844" metalness={0.8} roughness={0.2} emissive="#664422" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 0, s * 0.65]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[s * 0.35, s * 0.3, 12]} />
            <meshStandardMaterial color="#FFD700" metalness={0.9} roughness={0.1} emissive="#DAA520" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, s * 0.35, s * 0.8]}>
            <boxGeometry args={[s * 0.08, s * 0.7, s * 0.03]} />
            <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
          </mesh>
        </>
      )
    }

    // Starlink - flat rectangular satellite with phased array
    if (artifact.id?.startsWith('starlink')) {
      return (
        <>
          <mesh>
            <boxGeometry args={[s * 0.4, s * 0.15, s * 0.5]} />
            <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, s * 0.1, 0]}>
            <boxGeometry args={[s * 0.35, s * 0.02, s * 0.45]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} emissive="#111111" emissiveIntensity={0.1} />
          </mesh>
          <mesh position={[0, -s * 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[s * 0.08, s * 0.01, s * 0.3]} />
            <meshStandardMaterial color="#2244AA" emissive="#1122AA" emissiveIntensity={0.3} metalness={0.5} roughness={0.3} />
          </mesh>
        </>
      )
    }

    // Default satellite
    return (
      <>
        <mesh>
          <boxGeometry args={[s * 0.5, s * 0.4, s * 0.6]} />
          <meshStandardMaterial color={artifact.color} metalness={0.6} roughness={0.4} emissive={artifact.color} emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, s * 0.35, 0]}>
          <boxGeometry args={[s * 1.2, s * 0.05, s * 0.4]} />
          <meshStandardMaterial color="#1a3a7a" metalness={0.5} roughness={0.4} emissive="#0a1a3a" emissiveIntensity={0.2} />
        </mesh>
      </>
    )
  }

  return (
    <group ref={groupRef}>
      <group onClick={handleClick}>
        <ArtifactRenderer
          artifact={artifact}
          fallback={renderFallback()}
        />
      </group>
    </group>
  )
}

function ParkerArtifact({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[0]
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(0.5)
  const parentAngleRef = useRef(0.3)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current) {
      let parentX = 0
      let parentZ = 0

      if (planet) {
        parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
        const parentAngle = parentAngleRef.current
        parentX = Math.cos(parentAngle) * planet.orbitRadius
        parentZ = Math.sin(parentAngle) * planet.orbitRadius
      }

      orbitAngleRef.current += delta * artifact.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current
      groupRef.current.position.x = parentX + Math.cos(angle) * artifact.orbitRadius
      groupRef.current.position.z = parentZ + Math.sin(angle) * artifact.orbitRadius
      groupRef.current.position.y = Math.sin(angle * 3) * 0.3
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(artifact.id)
  }

  return (
    <group ref={groupRef}>
      <group onClick={handleClick}>
        <ArtifactRenderer
          artifact={artifact}
          fallback={
            <>
              <mesh>
                <boxGeometry args={[0.02, 0.015, 0.02]} />
                <meshStandardMaterial color="#FF6347" emissive="#FF4500" emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Heat shield (white) */}
              <mesh position={[0, -0.012, 0]}>
                <coneGeometry args={[0.015, 0.01, 8]} />
                <meshStandardMaterial color="#FFFFFF" metalness={0.3} roughness={0.6} />
              </mesh>
              <pointLight color="#FF6347" intensity={0.15} distance={1.5} />
            </>
          }
        />
      </group>
    </group>
  )
}

function GenericOrbitArtifact({
  artifact,
}: {
  artifact: (typeof humanArtifacts)[0]
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(1.2)
  const parentAngleRef = useRef(0.8)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const planet = planets.find((p) => p.id === artifact.parentId)

  useFrame((_, delta) => {
    if (groupRef.current) {
      let parentX = 0
      let parentZ = 0

      if (planet) {
        parentAngleRef.current += delta * planet.orbitSpeed * 0.05 * timeSpeed
        const parentAngle = parentAngleRef.current
        parentX = Math.cos(parentAngle) * planet.orbitRadius
        parentZ = Math.sin(parentAngle) * planet.orbitRadius
      }

      orbitAngleRef.current += delta * artifact.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current
      groupRef.current.position.x = parentX + Math.cos(angle) * artifact.orbitRadius
      groupRef.current.position.z = parentZ + Math.sin(angle) * artifact.orbitRadius
      groupRef.current.position.y = Math.sin(angle) * 0.1
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(artifact.id)
  }

  return (
    <group ref={groupRef}>
      <group onClick={handleClick}>
        <ArtifactRenderer
          artifact={artifact}
          fallback={
            <mesh>
              <boxGeometry args={[artifact.size, artifact.size * 0.5, artifact.size * 0.3]} />
              <meshStandardMaterial color={artifact.color} emissive={artifact.color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
            </mesh>
          }
        />
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
        if (artifact.id === 'jwst') {
          return <JWSTArtifact key={artifact.id} artifact={artifact} />
        }
        if (artifact.id === 'parker') {
          return <ParkerArtifact key={artifact.id} artifact={artifact} />
        }
        if (artifact.id.startsWith('starlink') || artifact.id === 'gps' || artifact.id === 'tiangong' || artifact.id === 'chandra') {
          return <EarthOrbitArtifact key={artifact.id} artifact={artifact} />
        }
        return <GenericOrbitArtifact key={artifact.id} artifact={artifact} />
      })}
    </group>
  )
}
