'use client'

import { useMemo, useRef } from 'react'
import { Billboard, useTexture } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlanetData } from './data'
import {
  getMajorPlanetVisualPosition,
  getPlanetRotationAngle,
} from './ephemeris'
import EphemerisMoon from './EphemerisMoon'
import { useExperienceStore } from './experience-store'
import PlanetLabel from './PlanetLabel'
import Rings from './Rings'
import { getSimulationDateMs } from './simulation-clock'
import { useSolarSystemStore } from './store'
import VelocityVector from './VelocityVector'

interface EphemerisPlanetProps {
  data: PlanetData
}

function TexturedSurface({ data }: { data: PlanetData }) {
  const texture = useTexture(data.textureUrl!)

  return (
    <mesh>
      <sphereGeometry args={[data.radius, 64, 48]} />
      <meshStandardMaterial
        map={texture}
        roughness={data.type.includes('Giant') ? 0.55 : 0.82}
        metalness={0.02}
      />
    </mesh>
  )
}

function ColorSurface({ data }: { data: PlanetData }) {
  return (
    <mesh>
      <sphereGeometry args={[data.radius, 40, 30]} />
      <meshStandardMaterial color={data.color} roughness={0.82} metalness={0.03} />
    </mesh>
  )
}

function CloudLayer({ data }: { data: PlanetData }) {
  const texture = useTexture(data.cloudMapUrl!)
  const ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!ref.current) return
    const dateMs = getSimulationDateMs()
    ref.current.rotation.y = ((dateMs / 3_600_000) * 0.026) % (Math.PI * 2)
  })

  return (
    <mesh ref={ref} scale={1.012}>
      <sphereGeometry args={[data.radius, 48, 36]} />
      <meshStandardMaterial
        map={texture}
        transparent
        opacity={0.56}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

function Atmosphere({ data }: { data: PlanetData }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          atmosphereColor: {
            value: new THREE.Color(data.atmosphereColor ?? data.color),
          },
          intensity: {
            value:
              data.id === 'earth'
                ? 0.95
                : data.id === 'venus'
                  ? 0.72
                  : 0.52,
          },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDirection;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vNormal = normalize(mat3(modelMatrix) * normal);
            vViewDirection = normalize(cameraPosition - worldPosition.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vViewDirection;
          uniform vec3 atmosphereColor;
          uniform float intensity;
          void main() {
            float fresnel = pow(1.0 - max(dot(vNormal, vViewDirection), 0.0), 2.35);
            gl_FragColor = vec4(atmosphereColor, fresnel * intensity);
          }
        `,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [data.atmosphereColor, data.color, data.id]
  )

  const scale =
    data.id === 'earth'
      ? 1.11
      : data.id === 'venus'
        ? 1.14
        : data.atmosphereScale ?? 1.06

  return (
    <mesh material={material} scale={scale}>
      <sphereGeometry args={[data.radius, 32, 24]} />
    </mesh>
  )
}

function PlanetGlow({ color, radius }: { color: string; radius: number }) {
  return (
    <Billboard>
      <mesh>
        <circleGeometry args={[radius * 2.7, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.045}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  )
}

function SelectionIndicator({ data }: { data: PlanetData }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[data.radius * 1.35, data.radius * 1.48, 64]} />
        <meshBasicMaterial
          color={data.color}
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[data.radius * 1.72, data.radius * 1.78, 64]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function AxialTiltGuide({ data }: { data: PlanetData }) {
  const height = Math.max(0.8, data.radius * 4)
  const radius = Math.max(0.008, data.radius * 0.018)

  return (
    <group rotation={[0, 0, THREE.MathUtils.degToRad(data.axialTilt)]}>
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 8]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.56}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default function EphemerisPlanet({ data }: EphemerisPlanetProps) {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const positionRef = useRef(new THREE.Vector3())
  const mode = useExperienceStore((state) => state.mode)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)
  const showLabels = useSolarSystemStore((state) => state.showLabels)
  const selected = selectedBody === data.id

  useFrame(() => {
    const dateMs = getSimulationDateMs()
    if (groupRef.current) {
      groupRef.current.position.copy(
        getMajorPlanetVisualPosition(data, dateMs, mode, positionRef.current)
      )
    }
    if (spinRef.current) {
      spinRef.current.rotation.y = getPlanetRotationAngle(data, dateMs)
    }
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    setSelectedBody(data.id)
    setFocusTarget(data.id)
  }

  return (
    <group ref={groupRef}>
      <group rotation={[0, 0, THREE.MathUtils.degToRad(data.axialTilt)]}>
        <group ref={spinRef} onClick={handleClick}>
          {data.textureUrl ? <TexturedSurface data={data} /> : <ColorSurface data={data} />}

          <mesh>
            <sphereGeometry args={[Math.max(data.radius * 1.75, 0.42), 14, 10]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {data.cloudMapUrl && <CloudLayer data={data} />}
          {data.hasAtmosphere && data.atmosphereColor && <Atmosphere data={data} />}
        </group>

        {data.hasRings && (
          <Rings
            innerRadius={data.ringInnerRadius ?? data.radius * 1.25}
            outerRadius={data.ringOuterRadius ?? data.radius * 2}
            color={data.ringColor ?? '#d4c090'}
            opacity={data.ringOpacity ?? 0.55}
            planetRadius={data.radius}
            textureUrl={data.ringTextureUrl}
          />
        )}
      </group>

      <PlanetGlow color={data.color} radius={data.radius} />
      {selected && <SelectionIndicator data={data} />}
      {selected && mode === 'scientific' && <AxialTiltGuide data={data} />}
      {selected && <pointLight color={data.color} intensity={0.45} distance={8} />}

      <VelocityVector bodyId={data.id} color={data.color} scale={1.2} />

      {data.moons.map((moon) => (
        <EphemerisMoon key={moon.name} moon={moon} parentId={data.id} />
      ))}

      {showLabels && (
        <PlanetLabel
          name={data.name}
          offset={data.radius + 0.5}
          bodyId={data.id}
        />
      )}
    </group>
  )
}
