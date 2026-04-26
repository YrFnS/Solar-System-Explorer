'use client'

import { useRef, useMemo } from 'react'
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

function EnceladusGeysers() {
  const geyserRef = useRef<THREE.Points>(null!)
  const particleCount = 60

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    const vel = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      // Spawn near top of moon
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * 0.06
      pos[i * 3] = Math.cos(angle) * r
      pos[i * 3 + 1] = 0.08 + Math.random() * 0.02
      pos[i * 3 + 2] = Math.sin(angle) * r

      // Velocity upward and outward
      vel[i * 3] = (Math.random() - 0.5) * 0.15
      vel[i * 3 + 1] = 0.3 + Math.random() * 0.2
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.15
    }

    return [pos, vel]
  }, [])

  const sizes = useMemo(() => {
    const s = new Float32Array(particleCount)
    for (let i = 0; i < particleCount; i++) {
      s[i] = Math.random() * 0.04 + 0.01
    }
    return s
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        varying float vAlpha;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (5.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
          vAlpha = 0.8;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(0.9, 0.95, 1.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  useFrame((_, delta) => {
    if (geyserRef.current) {
      const mat = geyserRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta

      const posAttr = geyserRef.current.geometry.attributes.position
      for (let i = 0; i < particleCount; i++) {
        let y = posAttr.getY(i)
        if (y > 0.5 || y < 0.05) {
          // Reset particle
          const angle = Math.random() * Math.PI * 2
          const r = Math.random() * 0.06
          posAttr.setXYZ(i, Math.cos(angle) * r, 0.08, Math.sin(angle) * r)
        } else {
          posAttr.setY(i, y + delta * (0.3 + Math.random() * 0.1))
          const x = posAttr.getX(i) + delta * (Math.random() - 0.5) * 0.1
          const z = posAttr.getZ(i) + delta * (Math.random() - 0.5) * 0.1
          posAttr.setX(i, x)
          posAttr.setZ(i, z)
        }
      }
      posAttr.needsUpdate = true
    }
  })

  return (
    <points ref={geyserRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
    </points>
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
      {moonData.name === 'Enceladus' && <EnceladusGeysers />}
    </group>
  )
}
