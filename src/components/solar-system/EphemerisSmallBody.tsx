'use client'

import { useMemo, useRef, type RefObject } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type {
  CentaurData,
  CometData,
  DwarfPlanetData,
  InterstellarObjectData,
  ScatteredDiscObjectData,
} from './data'
import {
  getBodyVisualPosition,
  getBodyVisualVelocity,
} from './ephemeris'
import EphemerisMoon from './EphemerisMoon'
import { useExperienceStore } from './experience-store'
import { useFrameLane } from './FrameUpdateLanes'
import PlanetLabel from './PlanetLabel'
import Rings from './Rings'
import { J2000_UNIX_MS, DAY_MS } from './simulation-clock'
import { useSolarSystemStore } from './store'
import { useAdaptiveTexture } from './textures/useAdaptiveTexture'
import VelocityVector from './VelocityVector'

export type EphemerisSmallBodyData =
  | DwarfPlanetData
  | CometData
  | InterstellarObjectData
  | CentaurData
  | ScatteredDiscObjectData

interface EphemerisSmallBodyProps {
  body: EphemerisSmallBodyData
}

function TexturedSurface({ body }: { body: DwarfPlanetData }) {
  const texture = useAdaptiveTexture(body.textureUrl!, { anisotropy: 4 })
  return (
    <mesh>
      <sphereGeometry args={[body.radius, 32, 24]} />
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0.02} />
    </mesh>
  )
}

function ProceduralSurface({ body }: { body: EphemerisSmallBodyData }) {
  const elongated = body.id === 'oumuamua'
  const rocky =
    body.type.includes('Asteroid') ||
    body.type === 'Centaur' ||
    body.type === 'Interstellar Object'

  return (
    <mesh scale={elongated ? [2.5, 0.65, 0.65] : [1, 1, 1]}>
      {rocky ? (
        <dodecahedronGeometry args={[body.radius, 1]} />
      ) : (
        <sphereGeometry args={[body.radius, 24, 18]} />
      )}
      <meshStandardMaterial color={body.color} roughness={0.9} metalness={0.04} />
    </mesh>
  )
}

function Tail({
  body,
  groupRef,
}: {
  body: CometData | InterstellarObjectData
  groupRef: RefObject<THREE.Group | null>
}) {
  const tailColor = 'tailColor' in body && body.tailColor ? body.tailColor : body.color
  const length = body.type === 'Interstellar Object' ? 2.2 : 3.8

  return (
    <group ref={groupRef}>
      <mesh position={[0, length * 0.48, 0]}>
        <coneGeometry args={[body.radius * 1.8, length, 18, 1, true]} />
        <meshBasicMaterial
          color={tailColor}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function SelectionMarker({ body }: { body: EphemerisSmallBodyData }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[body.radius * 1.7 + 0.05, body.radius * 2 + 0.07, 40]} />
      <meshBasicMaterial
        color="#fbbf24"
        transparent
        opacity={0.78}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

export default function EphemerisSmallBody({ body }: EphemerisSmallBodyProps) {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const tailRef = useRef<THREE.Group>(null)
  const positionRef = useRef(new THREE.Vector3())
  const velocityRef = useRef(new THREE.Vector3())
  const directionRef = useRef(new THREE.Vector3())
  const quaternionRef = useRef(new THREE.Quaternion())
  const upRef = useRef(new THREE.Vector3(0, 1, 0))
  const mode = useExperienceStore((state) => state.mode)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)
  const showLabels = useSolarSystemStore((state) => state.showLabels)
  const selected = selectedBody === body.id
  const isComet = body.type.includes('Comet') || body.type === 'Interstellar Object'
  const hasRings = 'hasRings' in body && Boolean(body.hasRings)
  const moons = 'moons' in body ? body.moons ?? [] : []

  useFrameLane({
    id: `small-body-detail:${body.id}`,
    lane: 'critical',
    priority: -25,
  }, ({ simulationDateMs }) => {
    if (groupRef.current) {
      groupRef.current.position.copy(
        getBodyVisualPosition(body.id, simulationDateMs, mode, positionRef.current)
      )
    }
    if (spinRef.current) {
      const days = (simulationDateMs - J2000_UNIX_MS) / DAY_MS
      const speed = 'rotationSpeed' in body ? body.rotationSpeed : 0.08
      spinRef.current.rotation.y = days * speed * 0.35
      spinRef.current.rotation.x = days * 0.018
    }

    if (!isComet || !tailRef.current) return
    getBodyVisualVelocity(
      body.id,
      simulationDateMs,
      mode,
      velocityRef.current
    )
    if (velocityRef.current.lengthSq() < 1e-8) return

    directionRef.current.copy(velocityRef.current).normalize().negate()
    quaternionRef.current.setFromUnitVectors(
      upRef.current,
      directionRef.current
    )
    tailRef.current.quaternion.copy(quaternionRef.current)
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    setSelectedBody(body.id)
    setFocusTarget(body.id)
  }

  const texturedDwarf =
    'textureUrl' in body && Boolean(body.textureUrl)
      ? (body as DwarfPlanetData)
      : null

  return (
    <group ref={groupRef} name={`small-body:${body.id}`}>
      <group ref={spinRef} onClick={handleClick}>
        {texturedDwarf ? (
          <TexturedSurface body={texturedDwarf} />
        ) : (
          <ProceduralSurface body={body} />
        )}
        <mesh>
          <sphereGeometry args={[Math.max(body.radius * 2.2, 0.14), 10, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {isComet && (
        <Tail
          body={body as CometData | InterstellarObjectData}
          groupRef={tailRef}
        />
      )}

      {hasRings && (
        <Rings
          innerRadius={body.radius * 1.45}
          outerRadius={body.radius * 2.25}
          color={body.color}
          opacity={0.48}
          planetRadius={body.radius}
        />
      )}

      {selected && <SelectionMarker body={body} />}
      <VelocityVector bodyId={body.id} color={body.color} scale={0.75} />

      {moons.map((moon) => (
        <EphemerisMoon key={moon.name} moon={moon} parentId={body.id} />
      ))}

      {showLabels && (mode === 'scientific' || selected || body.radius >= 0.08) && (
        <PlanetLabel
          name={body.name}
          offset={body.radius + 0.25}
          bodyId={body.id}
        />
      )}
    </group>
  )
}
