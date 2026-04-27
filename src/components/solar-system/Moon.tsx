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
  const particleCount = 180

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

      // Velocity upward and outward with more variety
      vel[i * 3] = (Math.random() - 0.5) * 0.25
      vel[i * 3 + 1] = 0.25 + Math.random() * 0.35
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.25
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
        varying float vDist;
        void main() {
          vAlpha = 0.6 + 0.4 * size;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (8.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 12.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, d) * vAlpha;
          // Ice blue-white color with slight sparkle
          vec3 iceColor = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 1.0, 1.0), smoothstep(0.2, 0.0, d));
          gl_FragColor = vec4(iceColor, alpha);
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
  const tidalOffsetRef = useRef(0)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  useFrame((_, delta) => {
    if (groupRef.current) {
      orbitAngleRef.current += delta * moonData.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current
      groupRef.current.position.x = Math.cos(angle) * moonData.orbitRadius
      groupRef.current.position.z = Math.sin(angle) * moonData.orbitRadius
    }
    // Tidal locking: moon rotates such that the same face always points to the planet
    // Rotation period equals orbital period
    if (meshRef.current) {
      const angle = orbitAngleRef.current
      // Set rotation to face the planet - the negative orbital angle keeps the same face toward the parent
      // tidalOffsetRef accounts for initial orientation so the correct "leading" face points to planet
      meshRef.current.rotation.y = -angle + tidalOffsetRef.current
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
