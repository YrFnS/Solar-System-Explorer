'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import Sun from './Sun'
import EphemerisPlanet from './EphemerisPlanet'
import EphemerisSmallBody from './EphemerisSmallBody'
import EphemerisOrbitLine from './EphemerisOrbitLine'
import EphemerisCameraController, {
  SimulationKeyboardControls,
} from './EphemerisCameraController'
import EphemerisSpawnedObjects from './EphemerisSpawnedObjects'
import EphemerisCollisionDetector from './EphemerisCollisionDetector'
import { AsteroidBelt, KuiperBelt } from './AsteroidBelt'
import TrojanAsteroids from './TrojanAsteroids'
import OortCloud from './OortCloud'
import Heliosphere from './Heliosphere'
import CentaurBelt from './CentaurBelt'
import ScatteredDiscBelt from './ScatteredDiscBelt'
import StarField from './StarField'
import Constellations from './Constellations'
import DistanceRuler from './DistanceRuler'
import Nebula from './Nebula'
import HumanArtifacts from './HumanArtifacts'
import MeteorShower from './MeteorShower'
import GravityWells from './GravityWells'
import BlackHole from './BlackHole'
import Wormhole from './Wormhole'
import SolarWind from './SolarWind'
import ZodiacalLight from './ZodiacalLight'
import NearEarthObjects from './NearEarthObjects'
import ExplosionsRenderer from './ExplosionsRenderer'
import GalacticNeighborhood from './GalacticNeighborhood'
import SoundManager from './SoundManager'
import {
  blackHoles,
  centaurs,
  comets,
  dwarfPlanets,
  interstellarObjects,
  planets,
  scatteredDiscObjects,
  wormholes,
} from './data'
import { useExperienceStore } from './experience-store'
import { useSolarSystemStore } from './store'

function EclipticReferenceGrid() {
  const mode = useExperienceStore((state) => state.mode)
  const showOrbitalPlanes = useExperienceStore((state) => state.showOrbitalPlanes)
  const positions = useMemo(() => {
    const size = 120
    const divisions = 48
    const step = (size * 2) / divisions
    const values: number[] = []

    for (let index = 0; index <= divisions; index += 1) {
      const offset = -size + index * step
      values.push(-size, 0, offset, size, 0, offset)
      values.push(offset, 0, -size, offset, 0, size)
    }

    return new Float32Array(values)
  }, [])

  if (mode !== 'scientific' || !showOrbitalPlanes) return null

  return (
    <group>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#4f7ecf"
          transparent
          opacity={0.075}
          depthWrite={false}
        />
      </lineSegments>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <circleGeometry args={[118, 96]} />
        <meshBasicMaterial
          color="#18345f"
          transparent
          opacity={0.022}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default function SolarSystemV3() {
  const showBlackHole = useSolarSystemStore((state) => state.showBlackHole)
  const showWormhole = useSolarSystemStore((state) => state.showWormhole)
  const showConstellations = useSolarSystemStore((state) => state.showConstellations)
  const showGalacticNeighborhood = useSolarSystemStore(
    (state) => state.showGalacticNeighborhood
  )
  const mode = useExperienceStore((state) => state.mode)
  const dwarfIds = useMemo(
    () => new Set(dwarfPlanets.map((body) => body.id)),
    []
  )
  const uniqueScatteredObjects = useMemo(
    () => scatteredDiscObjects.filter((body) => !dwarfIds.has(body.id)),
    [dwarfIds]
  )

  return (
    <>
      <ambientLight intensity={mode === 'scientific' ? 0.34 : 0.42} />

      <EphemerisCameraController />
      <SimulationKeyboardControls />
      <SoundManager />
      <EclipticReferenceGrid />

      <Nebula />
      {showGalacticNeighborhood && <GalacticNeighborhood />}
      <StarField />
      {showConstellations && <Constellations />}

      <SolarWind />
      <ZodiacalLight />
      <MeteorShower />
      <DistanceRuler />
      {mode === 'sandbox' && <GravityWells />}

      <Sun />

      {planets.map((planet) => (
        <EphemerisOrbitLine
          key={`orbit-${planet.id}`}
          bodyId={planet.id}
          color={planet.color}
          opacity={0.075}
        />
      ))}
      {planets.map((planet) => (
        <EphemerisPlanet key={planet.id} data={planet} />
      ))}

      {dwarfPlanets.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.color}
          opacity={0.045}
        />
      ))}
      {dwarfPlanets.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      ))}

      {comets.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.tailColor}
          opacity={0.045}
        />
      ))}
      {comets.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      ))}

      {interstellarObjects.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.tailColor ?? body.color}
          opacity={0.04}
        />
      ))}
      {interstellarObjects.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      ))}

      {centaurs.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.color}
          opacity={0.035}
        />
      ))}
      {centaurs.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      ))}

      {uniqueScatteredObjects.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.color}
          opacity={0.03}
        />
      ))}
      {uniqueScatteredObjects.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      ))}

      <AsteroidBelt />
      <NearEarthObjects />
      <TrojanAsteroids />
      <KuiperBelt />
      <CentaurBelt />
      <ScatteredDiscBelt />
      <Heliosphere />
      <OortCloud />

      <EphemerisSpawnedObjects />
      <EphemerisCollisionDetector />
      <ExplosionsRenderer />

      {showBlackHole &&
        blackHoles.map((body) => <BlackHole key={body.id} data={body} />)}
      {showWormhole &&
        wormholes.map((body) => <Wormhole key={body.id} data={body} />)}

      {mode !== 'scientific' && <HumanArtifacts />}
    </>
  )
}
