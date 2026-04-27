'use client'

import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { InterstellarObjectData } from './data'
import { useSolarSystemStore } from './store'
import PlanetLabel from './PlanetLabel'
import { solveKeplerEquation, calculateTrueAnomaly } from './OrbitalMechanics'

interface InterstellarObjectProps {
  data: InterstellarObjectData
}

function CometTail({ color }: { color: string }) {
  const tailRef = useRef<THREE.Points>(null!)
  const timeRef = useRef(0)

  const [positions] = useMemo(() => {
    const count = 150
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const spread = Math.random() * 3 + 0.5
      pos[i * 3] = -spread + (Math.random() - 0.5) * 0.2
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.3
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3
    }
    return [pos]
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
          vAlpha = smoothstep(4.0, 0.0, dist) * 0.5;
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
    const s = new Float32Array(150)
    for (let i = 0; i < 150; i++) {
      s[i] = Math.random() * 0.07 + 0.02
    }
    return s
  }, [])

  useFrame((_, delta) => {
    timeRef.current += delta
    if (tailRef.current) {
      const mat = tailRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value = timeRef.current

      const posAttr = tailRef.current.geometry.attributes.position
      for (let i = 0; i < 150; i++) {
        const x = posAttr.getX(i)
        const alpha = Math.abs(x) / 4.0
        if (alpha > 1) {
          posAttr.setXYZ(i, -0.5 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)
        } else {
          posAttr.setX(i, x - delta * (0.4 + Math.random() * 0.2))
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

function InterstellarSelectionRings({ color, radius }: { color: string; radius: number }) {
  const innerRef = useRef<THREE.Mesh>(null!)
  const outerRef = useRef<THREE.Mesh>(null!)
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const innerOpacity = 0.55 + 0.25 * Math.sin(t * 3)
    if (innerMatRef.current) innerMatRef.current.opacity = innerOpacity
    const outerOpacity = 0.55 - 0.25 * Math.sin(t * 3)
    if (outerMatRef.current) outerMatRef.current.opacity = outerOpacity
    if (innerRef.current) {
      const s = 1 + 0.03 * Math.sin(t * 3)
      innerRef.current.scale.set(s, s, s)
    }
  })

  return (
    <>
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.08, radius + 0.13, 64]} />
        <meshBasicMaterial ref={innerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.18, radius + 0.22, 64]} />
        <meshBasicMaterial ref={outerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  )
}

export default function InterstellarObject({ data }: InterstellarObjectProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const meshRef = useRef<THREE.Mesh>(null)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const showLabels = useSolarSystemStore((s) => s.showLabels)

  // Hyperbolic trajectory animation
  // Objects come from far away, curve around the Sun, and leave
  // We loop the animation for visibility
  const inclinationRad = (data.orbitInclination * Math.PI) / 180
  // Track time for Kepler solver
  const timeRef = useRef(0)

  // Scale for 'Oumuamua's elongated shape
  const isOumuamua = data.id === 'oumuamua'
  const objectScale = isOumuamua ? new THREE.Vector3(3, 0.3, 0.3) : new THREE.Vector3(1, 1, 1)

  useFrame((_, delta) => {
    timeRef.current += delta * timeSpeed
    if (groupRef.current) {
      // For hyperbolic trajectories, use negative semi-major axis
      // Mean anomaly increases linearly with time
      const M = timeRef.current * data.orbitSpeed * 0.02 % (2 * Math.PI)

      // Solve Kepler's equation for hyperbolic eccentric anomaly
      const H = solveKeplerEquation(M, data.orbitEccentricity)

      // Calculate true anomaly for hyperbolic case
      const nu = calculateTrueAnomaly(H, data.orbitEccentricity)

      // Calculate distance using hyperbolic form
      // r = a * (e^2 - 1) / (1 + e * cos(nu)) where a is negative for hyperbolic
      const e = data.orbitEccentricity
      const a = data.orbitRadius
      const r = Math.min(a * (e * e - 1) / (1 + e * Math.cos(nu)), 80)

      // Position in 3D space with orbital inclination
      groupRef.current.position.x = r * Math.cos(nu)
      groupRef.current.position.z = r * Math.sin(nu) * Math.cos(inclinationRad)
      groupRef.current.position.y = r * Math.sin(nu) * Math.sin(inclinationRad)
    }

    // Tumble for 'Oumuamua
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5 * timeSpeed
      meshRef.current.rotation.z += delta * 0.3 * timeSpeed
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(data.id)
  }

  const isSelected = selectedBody === data.id

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} onClick={handleClick} scale={objectScale}>
        <sphereGeometry args={[data.radius, 16, 16]} />
        <meshStandardMaterial
          color={data.color}
          emissive={data.color}
          emissiveIntensity={0.4}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      {/* Clickable hit area */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[Math.max(data.radius * 4, 0.4), 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Borisov's comet-like tail */}
      {data.tailColor && <CometTail color={data.tailColor} />}

      {/* Selection indicator */}
      {isSelected && <InterstellarSelectionRings color={data.color} radius={data.radius} />}
      {isSelected && (
        <pointLight color={data.color} intensity={0.5} distance={4} />
      )}

      {/* Glow for visibility */}
      <pointLight color={data.color} intensity={0.15} distance={3} />

      {showLabels && (
        <PlanetLabel name={data.name} offset={data.radius + 0.3} bodyId={data.id} />
      )}
    </group>
  )
}
