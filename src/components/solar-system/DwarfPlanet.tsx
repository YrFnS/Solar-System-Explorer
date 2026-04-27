'use client'

import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { DwarfPlanetData, MoonData } from './data'
import { useSolarSystemStore } from './store'
import PlanetLabel from './PlanetLabel'
import MoonComponent from './Moon'

interface DwarfPlanetProps {
  data: DwarfPlanetData
}

function TexturedDwarfPlanetSurface({ data }: { data: DwarfPlanetData }) {
  const texture = useTexture(data.textureUrl!)
  return (
    <mesh>
      <sphereGeometry args={[data.radius, 64, 64]} />
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0.1} />
    </mesh>
  )
}

function DwarfPlanetSurface({ data }: { data: DwarfPlanetData }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const material = useMemo(() => {
    const baseColor = new THREE.Color(data.color)

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: baseColor },
        lightDir: { value: new THREE.Vector3(0, 0, 1).normalize() },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform float time;
        uniform vec3 baseColor;
        uniform vec3 lightDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          vec3 normal = normalize(vNormal);
          float diff = max(dot(normal, lightDir), 0.0);
          float ambient = 0.15;

          vec2 uv = vUv;
          float n = fbm(uv * 12.0 + time * 0.005);
          float n2 = fbm(uv * 20.0 - time * 0.003);

          vec3 color = baseColor;

          // Cratered terrain (similar to Mercury but more varied)
          vec3 light = baseColor * 1.15;
          vec3 dark = baseColor * 0.55;
          color = mix(light, dark, n);

          // Subtle craters
          float craters = fbm(uv * 25.0);
          color = mix(color, color * 0.65, smoothstep(0.55, 0.62, craters) * 0.5);

          // Ice patches for Pluto-like bodies (lighter color)
          float ice = fbm(uv * 8.0 + vec2(0.3, 0.7));
          vec3 iceColor = mix(baseColor, vec3(0.9, 0.88, 0.85), 0.5);
          color = mix(color, iceColor, smoothstep(0.55, 0.65, ice) * 0.3);

          // Apply lighting
          vec3 lit = color * (ambient + diff * 0.85);

          // Subtle rim light
          float rim = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
          lit += baseColor * rim * 0.15;

          gl_FragColor = vec4(lit, 1.0);
        }
      `,
    })
  }, [data.color])

  useFrame((_, delta) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
  })

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[data.radius, 32, 32]} />
    </mesh>
  )
}

function DwarfSelectionRings({ color, radius }: { color: string; radius: number }) {
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
        <ringGeometry args={[radius + 0.1, radius + 0.16, 64]} />
        <meshBasicMaterial ref={innerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Outer pulsing ring (counter-phase) */}
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.22, radius + 0.26, 64]} />
        <meshBasicMaterial ref={outerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  )
}

export default function DwarfPlanet({ data }: DwarfPlanetProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const spinRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(data.initialAngle)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const showLabels = useSolarSystemStore((s) => s.showLabels)
  const customDateAngleBase = useSolarSystemStore((s) => s.customDateAngleBase)

  // Convert inclination to radians
  const inclinationRad = (data.orbitInclination * Math.PI) / 180

  // Special handling for Pluto-Charon binary system
  const isPlutoBinary = data.id === 'pluto' && data.moons && data.moons.length > 0

  useFrame((_, delta) => {
    if (groupRef.current) {
      orbitAngleRef.current += delta * data.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current + customDateAngleBase * data.orbitSpeed
      // Orbital position with inclination
      groupRef.current.position.x = Math.cos(angle) * data.orbitRadius
      groupRef.current.position.z = Math.sin(angle) * data.orbitRadius
      groupRef.current.position.y = Math.sin(angle) * Math.sin(inclinationRad) * data.orbitRadius * 0.3
    }
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * data.rotationSpeed * 0.5 * timeSpeed
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(data.id)
  }

  const isSelected = selectedBody === data.id

  // Pluto-Charon barycenter parameters
  // The barycenter is ~0.6 Pluto radii from Pluto's center toward Charon
  // (Charon mass is ~11.6% of Pluto, but for visual purposes we use 0.18 ratio)
  const BARYCENTER_RATIO = 0.18 // offset from Pluto toward Charon as fraction of orbit radius

  return (
    <group ref={groupRef}>
      {isPlutoBinary ? (
        // Pluto-Charon binary system: both orbit the barycenter
        <PlutoCharonSystem
          data={data}
          moons={data.moons!}
          spinRef={spinRef}
          isSelected={isSelected}
          handleClick={handleClick}
          BARYCENTER_RATIO={BARYCENTER_RATIO}
          showLabels={showLabels}
        />
      ) : (
        // Normal dwarf planet (single body)
        <group ref={spinRef} onClick={handleClick}>
          {data.textureUrl ? (
            <TexturedDwarfPlanetSurface data={data} />
          ) : (
            <DwarfPlanetSurface data={data} />
          )}
          {/* Clickable hit area - larger invisible sphere for easier selection */}
          <mesh>
            <sphereGeometry args={[Math.max(data.radius * 2.5, 0.4), 16, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* Selection indicator - animated pulsing rings */}
      {isSelected && <DwarfSelectionRings color={data.color} radius={data.radius} />}
      {/* Point light on selected dwarf planet */}
      {isSelected && (
        <pointLight color={data.color} intensity={0.5} distance={6} />
      )}

      {/* Subtle glow for visibility */}
      <pointLight
        color={data.color}
        intensity={0.08}
        distance={2}
      />

      {showLabels && !isPlutoBinary && (
        <PlanetLabel name={data.name} offset={data.radius + 0.3} bodyId={data.id} />
      )}
    </group>
  )
}

// Separate component for Pluto-Charon binary system
interface PlutoCharonSystemProps {
  data: DwarfPlanetData
  moons: MoonData[]
  spinRef: React.RefObject<THREE.Group>
  isSelected: boolean
  handleClick: (e: ThreeEvent<MouseEvent>) => void
  BARYCENTER_RATIO: number
  showLabels: boolean
}

function PlutoCharonSystem({ data, moons, spinRef, isSelected, handleClick, BARYCENTER_RATIO, showLabels }: PlutoCharonSystemProps) {
  const charonRef = useRef<THREE.Group>(null!)
  const charonLabelRef = useRef<THREE.Group>(null!)
  // Charon starts opposite to Pluto's initial position (pi offset)
  const charonAngleRef = useRef(Math.PI * 0.5 + data.initialAngle)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)

  const charon = moons.find(m => m.name === 'Charon')

  useFrame((_, delta) => {
    if (charonRef.current && charon) {
      // Charon orbits the barycenter
      charonAngleRef.current += delta * (charon?.orbitSpeed || 0.15) * 0.05 * timeSpeed
      const angle = charonAngleRef.current

      // Distance from barycenter to Charon (Charon's full orbit radius minus barycenter offset)
      const charonDistFromBarycenter = charon!.orbitRadius * (1 - BARYCENTER_RATIO)

      charonRef.current.position.x = Math.cos(angle) * charonDistFromBarycenter
      charonRef.current.position.z = Math.sin(angle) * charonDistFromBarycenter

      // Sync label position with Charon mesh
      if (charonLabelRef.current) {
        charonLabelRef.current.position.x = charonRef.current.position.x
        charonLabelRef.current.position.z = charonRef.current.position.z
      }
    }

    // Pluto wobbles around the barycenter (opposite to Charon's direction)
    // The barycenter is at the group's position, and we offset Pluto slightly
    if (spinRef.current && charon) {
      // Pluto orbits the barycenter at BARYCENTER_RATIO * orbitRadius, opposite to Charon
      const plutoDistFromBarycenter = charon!.orbitRadius * BARYCENTER_RATIO
      const charonAngle = charonAngleRef.current
      // Pluto moves opposite to Charon (180 degrees out of phase)
      spinRef.current.position.x = -Math.cos(charonAngle) * plutoDistFromBarycenter
      spinRef.current.position.z = -Math.sin(charonAngle) * plutoDistFromBarycenter
    }
  })

  if (!charon) return null

  return (
    <>
      {/* Pluto (with spinRef handling the wobble) */}
      <group ref={spinRef} onClick={handleClick}>
        {data.textureUrl ? (
          <TexturedDwarfPlanetSurface data={data} />
        ) : (
          <DwarfPlanetSurface data={data} />
        )}
        <mesh>
          <sphereGeometry args={[Math.max(data.radius * 2.5, 0.4), 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* Charon orbiting the barycenter */}
      <group ref={charonRef}>
        <mesh onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          useSolarSystemStore.getState().setSelectedBody('pluto-charon')
        }}>
          <sphereGeometry args={[charon.radius, 32, 32]} />
          <meshStandardMaterial color={charon.color} roughness={0.9} metalness={0.1} />
        </mesh>
      </group>

      {/* Pluto label */}
      {showLabels && (
        <PlanetLabel name="Pluto" offset={data.radius + 0.3} bodyId={data.id} />
      )}
      {/* Charon label */}
      {showLabels && charon && (
        <group ref={charonLabelRef}>
          <PlanetLabel name="Charon" offset={charon.radius + 0.2} bodyId="pluto-charon" />
        </group>
      )}
    </>
  )
}
