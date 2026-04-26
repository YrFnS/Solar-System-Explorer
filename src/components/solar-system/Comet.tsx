'use client'

import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { CometData } from './data'
import { useSolarSystemStore } from './store'
import PlanetLabel from './PlanetLabel'

interface CometProps {
  data: CometData
}

function CometTail({ color, size }: { color: string; size: number }) {
  const tailRef = useRef<THREE.Points>(null!)
  const timeRef = useRef(0)

  const [positions, velocities] = useMemo(() => {
    const count = 200
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      // Tail particles start near the comet and spread outward
      const spread = Math.random() * 3 + 0.5
      pos[i * 3] = -spread + (Math.random() - 0.5) * 0.2
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.3
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3

      // Velocity away from the sun (tail always points away)
      vel[i * 3] = -(Math.random() * 0.5 + 0.2)
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.05
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.05
    }

    return [pos, vel]
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        tailColor: { value: new THREE.Color(color) },
      },
      vertexShader: `
        attribute float size;
        uniform float time;
        varying float vAlpha;
        void main() {
          vec3 pos = position;
          float dist = length(pos);
          vAlpha = smoothstep(4.0, 0.0, dist) * 0.6;
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (3.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        uniform vec3 tailColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(tailColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [color])

  const sizes = useMemo(() => {
    const s = new Float32Array(200)
    for (let i = 0; i < 200; i++) {
      s[i] = Math.random() * 0.08 + 0.02
    }
    return s
  }, [])

  useFrame((_, delta) => {
    timeRef.current += delta
    if (tailRef.current) {
      const mat = tailRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value = timeRef.current

      // Animate tail particles
      const posAttr = tailRef.current.geometry.attributes.position
      for (let i = 0; i < 200; i++) {
        const x = posAttr.getX(i)
        const alpha = Math.abs(x) / 4.0
        if (alpha > 1) {
          // Reset particle
          posAttr.setXYZ(i, -0.5 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)
        } else {
          posAttr.setX(i, x - delta * (0.5 + Math.random() * 0.3))
        }
      }
      posAttr.needsUpdate = true
    }
  })

  return (
    <points ref={tailRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
    </points>
  )
}

function CometSelectionRings({ color, radius }: { color: string; radius: number }) {
  const innerRef = useRef<THREE.Mesh>(null!)
  const outerRef = useRef<THREE.Mesh>(null!)
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Inner ring: pulse between 0.3 and 0.8
    const innerOpacity = 0.55 + 0.25 * Math.sin(t * 3)
    if (innerMatRef.current) {
      innerMatRef.current.opacity = innerOpacity
    }
    // Outer ring: counter-phase pulse
    const outerOpacity = 0.55 - 0.25 * Math.sin(t * 3)
    if (outerMatRef.current) {
      outerMatRef.current.opacity = outerOpacity
    }
    // Slight scale pulse on inner ring
    if (innerRef.current) {
      const s = 1 + 0.03 * Math.sin(t * 3)
      innerRef.current.scale.set(s, s, s)
    }
  })

  return (
    <>
      {/* Inner pulsing ring */}
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.08, radius + 0.13, 64]} />
        <meshBasicMaterial ref={innerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Outer pulsing ring (counter-phase) */}
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.18, radius + 0.22, 64]} />
        <meshBasicMaterial ref={outerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  )
}

export default function Comet({ data }: CometProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const meshRef = useRef<THREE.Mesh>(null)
  const orbitAngleRef = useRef(Math.random() * Math.PI * 2)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const showLabels = useSolarSystemStore((s) => s.showLabels)
  const customDateAngleBase = useSolarSystemStore((s) => s.customDateAngleBase)

  const inclinationRad = (data.orbitInclination * Math.PI) / 180

  useFrame((_, delta) => {
    if (groupRef.current) {
      orbitAngleRef.current += delta * data.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current + customDateAngleBase * data.orbitSpeed

      // Elliptical orbit for comets (high eccentricity)
      const e = data.orbitEccentricity
      const a = data.orbitRadius
      const r = a * (1 - e * e) / (1 + e * Math.cos(angle))

      groupRef.current.position.x = Math.cos(angle) * r
      groupRef.current.position.z = Math.sin(angle) * r
      groupRef.current.position.y = Math.sin(angle) * Math.sin(inclinationRad) * r * 0.4
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.01 * timeSpeed
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(data.id)
  }

  const isSelected = selectedBody === data.id

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} onClick={handleClick}>
        <sphereGeometry args={[data.radius, 16, 16]} />
        <meshStandardMaterial
          color={data.color}
          emissive={data.color}
          emissiveIntensity={0.3}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      {/* Clickable hit area */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[Math.max(data.radius * 4, 0.4), 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Comet tail - always points away from sun */}
      <CometTail color={data.tailColor} size={data.radius} />

      {/* Selection indicator - animated pulsing rings */}
      {isSelected && <CometSelectionRings color={data.color} radius={data.radius} />}
      {/* Point light on selected comet */}
      {isSelected && (
        <pointLight color={data.color} intensity={0.5} distance={4} />
      )}

      {/* Coma glow */}
      <pointLight color={data.tailColor} intensity={0.15} distance={3} />

      {showLabels && (
        <PlanetLabel name={data.name} offset={data.radius + 0.3} bodyId={data.id} />
      )}
    </group>
  )
}
