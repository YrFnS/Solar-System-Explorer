'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, FlyControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import Sun from './Sun'
import Planet from './Planet'
import DwarfPlanet from './DwarfPlanet'
import Comet from './Comet'
import InterstellarObject from './InterstellarObject'
import Centaur from './Centaur'
import ScatteredDiscObject from './ScatteredDiscObject'
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
import OrbitLine from './OrbitLine'
import SolarWind from './SolarWind'
import ZodiacalLight from './ZodiacalLight'
import NearEarthObjects from './NearEarthObjects'
import SpawnedObjects from './SpawnedObjects'
import CollisionDetector from './CollisionDetector'
import ExplosionsRenderer from './ExplosionsRenderer'
import GalacticNeighborhood from './GalacticNeighborhood'
import SoundManager from './SoundManager'
import { planets, sunData, dwarfPlanets, comets, interstellarObjects, centaurs, scatteredDiscObjects, blackHoles, wormholes } from './data'
import { useSolarSystemStore } from './store'

function ReferenceGrid() {
  const showOrbitLines = useSolarSystemStore((s) => s.showOrbitLines)

  if (!showOrbitLines) return null

  // Build a grid using line segments
  const gridSize = 60
  const gridDivisions = 30
  const step = (gridSize * 2) / gridDivisions
  const points: number[] = []

  for (let i = 0; i <= gridDivisions; i++) {
    const pos = -gridSize + i * step
    // Lines along X
    points.push(-gridSize, 0, pos, gridSize, 0, pos)
    // Lines along Z
    points.push(pos, 0, -gridSize, pos, 0, gridSize)
  }

  const positions = new Float32Array(points)

  return (
    <lineSegments position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#4466aa" transparent opacity={0.03} depthWrite={false} />
    </lineSegments>
  )
}

function CameraController() {
  const controlsRef = useRef<any>(null)
  const focusTarget = useSolarSystemStore((s) => s.focusTarget)
  const setFocusTarget = useSolarSystemStore((s) => s.setFocusTarget)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const autoRotate = useSolarSystemStore((s) => s.autoRotate)
  const cameraPosition = useSolarSystemStore((s) => s.cameraPosition)
  const setCameraPosition = useSolarSystemStore((s) => s.setCameraPosition)
  const cameraMode = useSolarSystemStore((s) => s.cameraMode)
  const { camera } = useThree()

  const isAnimating = useRef(false)
  const animProgress = useRef(0)
  const animStart = useRef(new THREE.Vector3())
  const animEnd = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3())

  // Use a consistent time source that matches planet positions
  const elapsedTimeRef = useRef(0)

  const getBodyPosition = useCallback((id: string): THREE.Vector3 | null => {
    const time = elapsedTimeRef.current
    const dateOffset = useSolarSystemStore.getState().customDateAngleBase
    if (id === 'sun') {
      return new THREE.Vector3(0, 0, 0)
    }
    const planet = planets.find((p) => p.id === id)
    if (planet) {
      const angle = time * planet.orbitSpeed * 0.05 + dateOffset * planet.orbitSpeed + planet.initialAngle
      return new THREE.Vector3(
        Math.cos(angle) * planet.orbitRadius,
        0,
        Math.sin(angle) * planet.orbitRadius
      )
    }
    const dwarfPlanet = dwarfPlanets.find((d) => d.id === id)
    if (dwarfPlanet) {
      const angle = time * dwarfPlanet.orbitSpeed * 0.05 + dateOffset * dwarfPlanet.orbitSpeed + dwarfPlanet.initialAngle
      const incl = (dwarfPlanet.orbitInclination * Math.PI) / 180
      return new THREE.Vector3(
        Math.cos(angle) * dwarfPlanet.orbitRadius,
        Math.sin(angle) * Math.sin(incl) * dwarfPlanet.orbitRadius * 0.3,
        Math.sin(angle) * dwarfPlanet.orbitRadius
      )
    }
    const comet = comets.find((c) => c.id === id)
    if (comet) {
      const angle = time * comet.orbitSpeed * 0.05 + dateOffset * comet.orbitSpeed
      const e = comet.orbitEccentricity
      const a = comet.orbitRadius
      const r = a * (1 - e * e) / (1 + e * Math.cos(angle))
      const incl = (comet.orbitInclination * Math.PI) / 180
      return new THREE.Vector3(
        Math.cos(angle) * r,
        Math.sin(angle) * Math.sin(incl) * r * 0.4,
        Math.sin(angle) * r
      )
    }
    const centaur = centaurs.find((c) => c.id === id)
    if (centaur) {
      const angle = time * centaur.orbitSpeed * 0.05 + dateOffset * centaur.orbitSpeed
      const e = centaur.orbitEccentricity
      const a = centaur.orbitRadius
      const r = a * (1 - e * e) / (1 + e * Math.cos(angle))
      const incl = (centaur.orbitInclination * Math.PI) / 180
      return new THREE.Vector3(
        Math.cos(angle) * r,
        Math.sin(angle) * Math.sin(incl) * r * 0.3,
        Math.sin(angle) * r
      )
    }
    const sdo = scatteredDiscObjects.find((s) => s.id === id)
    if (sdo) {
      const angle = time * sdo.orbitSpeed * 0.05 + dateOffset * sdo.orbitSpeed
      const e = sdo.orbitEccentricity
      const a = sdo.orbitRadius
      const r = a * (1 - e * e) / (1 + e * Math.cos(angle))
      const incl = (sdo.orbitInclination * Math.PI) / 180
      return new THREE.Vector3(
        Math.cos(angle) * r,
        Math.sin(angle) * Math.sin(incl) * r * 0.3,
        Math.sin(angle) * r
      )
    }
    // Black holes are stationary at their fixed positions
    const bh = blackHoles.find((b) => b.id === id)
    if (bh) {
      return new THREE.Vector3(bh.position[0], bh.position[1], bh.position[2])
    }
    // Wormholes are stationary at their fixed positions
    const wh = wormholes.find((w) => w.id === id)
    if (wh) {
      return new THREE.Vector3(wh.position[0], wh.position[1], wh.position[2])
    }
    return null
  }, [])

  const getBodyRadius = useCallback((id: string): number => {
    if (id === 'sun') return sunData.radius
    const planet = planets.find((p) => p.id === id)
    if (planet) return planet.radius
    const dwarfPlanet = dwarfPlanets.find((d) => d.id === id)
    if (dwarfPlanet) return dwarfPlanet.radius
    const comet = comets.find((c) => c.id === id)
    if (comet) return comet.radius
    const centaur = centaurs.find((c) => c.id === id)
    if (centaur) return centaur.radius
    const sdo = scatteredDiscObjects.find((s) => s.id === id)
    if (sdo) return sdo.radius
    const bh = blackHoles.find((b) => b.id === id)
    if (bh) return bh.eventHorizonRadius
    const wh = wormholes.find((w) => w.id === id)
    if (wh) return wh.mouthRadius
    return 1
  }, [])

  useEffect(() => {
    if (focusTarget) {
      const pos = getBodyPosition(focusTarget)
      if (pos) {
        isAnimating.current = true
        animProgress.current = 0
        animStart.current.copy(camera.position)
        lookTarget.current.copy(pos)

        const bodyRadius = getBodyRadius(focusTarget)
        const viewDist = bodyRadius * 5 + 2
        const elevation = bodyRadius * 2 + 1

        animEnd.current.set(
          pos.x + viewDist,
          elevation,
          pos.z + viewDist
        )

        setSelectedBody(focusTarget)
      }
    }
  }, [focusTarget, camera, getBodyPosition, getBodyRadius, setSelectedBody])

  // Handle camera position changes (view mode switches)
  useEffect(() => {
    if (cameraPosition) {
      isAnimating.current = true
      animProgress.current = 0
      animStart.current.copy(camera.position)
      animEnd.current.set(cameraPosition[0], cameraPosition[1], cameraPosition[2])
      lookTarget.current.set(0, 0, 0)
      // Clear the camera position after using it
      setCameraPosition(null)
    }
  }, [cameraPosition, camera, setCameraPosition])

  useFrame((_, delta) => {
    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const isPaused = useSolarSystemStore.getState().isPaused
    if (!isPaused) {
      elapsedTimeRef.current += delta * timeSpeed
    }

    if (isAnimating.current) {
      animProgress.current += delta * 0.8
      const t = Math.min(animProgress.current, 1)
      // Ease in-out cubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

      camera.position.lerpVectors(animStart.current, animEnd.current, eased)

      if (controlsRef.current) {
        controlsRef.current.target.lerp(lookTarget.current, eased * 0.5 + 0.02)
        controlsRef.current.update()
      }

      if (t >= 1) {
        isAnimating.current = false
      }
    }

    // Follow camera mode: continuously track the selected body
    const followMode = useSolarSystemStore.getState().followMode
    const selectedBody = useSolarSystemStore.getState().selectedBody
    if (followMode && selectedBody && !isAnimating.current) {
      const bodyPos = getBodyPosition(selectedBody)
      if (bodyPos && controlsRef.current) {
        controlsRef.current.target.lerp(bodyPos, 0.05)
        controlsRef.current.update()
      }
    }
  })

  if (cameraMode === 'fly') {
    return null // FlyControls handles its own camera
  }

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      enableRotate
      minDistance={1.5}
      maxDistance={8000}
      zoomSpeed={1.2}
      rotateSpeed={0.5}
      panSpeed={0.8}
      enableDamping
      dampingFactor={0.05}
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
    />
  )
}

function KeyboardControls() {
  const navigateNext = useSolarSystemStore((s) => s.navigateNext)
  const navigatePrev = useSolarSystemStore((s) => s.navigatePrev)
  const setTimeSpeed = useSolarSystemStore((s) => s.setTimeSpeed)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const togglePause = useSolarSystemStore((s) => s.togglePause)
  const resetCamera = useSolarSystemStore((s) => s.resetCamera)
  const startTour = useSolarSystemStore((s) => s.startTour)
  const stopTour = useSolarSystemStore((s) => s.stopTour)
  const isTourMode = useSolarSystemStore((s) => s.isTourMode)
  const nextTourStep = useSolarSystemStore((s) => s.nextTourStep)
  const prevTourStep = useSolarSystemStore((s) => s.prevTourStep)
  const toggleAutoRotate = useSolarSystemStore((s) => s.toggleAutoRotate)
  const setScreenshotMode = useSolarSystemStore((s) => s.setScreenshotMode)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)
  const toggleFollowMode = useSolarSystemStore((s) => s.toggleFollowMode)
  const cameraMode = useSolarSystemStore((s) => s.cameraMode)
  const setCameraMode = useSolarSystemStore((s) => s.setCameraMode)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keys when typing in search input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          if (isTourMode) {
            nextTourStep()
          } else {
            navigateNext()
          }
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          if (isTourMode) {
            prevTourStep()
          } else {
            navigatePrev()
          }
          break
        case '+':
        case '=':
          e.preventDefault()
          setTimeSpeed(Math.min(100, timeSpeed + (timeSpeed < 5 ? 0.5 : 5)))
          break
        case '-':
        case '_':
          e.preventDefault()
          setTimeSpeed(Math.max(0, timeSpeed - (timeSpeed <= 5 ? 0.5 : 5)))
          break
        case ' ':
          e.preventDefault()
          togglePause()
          break
        case 'Escape':
          e.preventDefault()
          if (isTourMode) {
            stopTour()
          } else {
            resetCamera()
          }
          break
        case 't':
        case 'T':
          e.preventDefault()
          if (isTourMode) {
            stopTour()
          } else {
            startTour()
          }
          break
        case 'r':
        case 'R':
          e.preventDefault()
          toggleAutoRotate()
          break
        case 's':
        case 'S':
          e.preventDefault()
          setScreenshotMode(!screenshotMode)
          break
        case 'f':
        case 'F':
          e.preventDefault()
          toggleFollowMode()
          break
        case 'm':
        case 'M':
          e.preventDefault()
          setCameraMode(cameraMode === 'orbit' ? 'fly' : 'orbit')
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateNext, navigatePrev, setTimeSpeed, timeSpeed, togglePause, resetCamera, startTour, stopTour, isTourMode, nextTourStep, prevTourStep, toggleAutoRotate, setScreenshotMode, screenshotMode, toggleFollowMode, cameraMode, setCameraMode])

  return null
}

export default function SolarSystem() {
  const showBlackHole = useSolarSystemStore((s) => s.showBlackHole)
  const showWormhole = useSolarSystemStore((s) => s.showWormhole)
  const cameraMode = useSolarSystemStore((s) => s.cameraMode)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const isPaused = useSolarSystemStore((s) => s.isPaused)

  return (
    <>
      {/* Ambient light for minimum visibility */}
      <ambientLight intensity={0.4} color="#ffffff" />

      {/* Camera controller */}
      <CameraController />

      {/* Free fly controls */}
      {cameraMode === 'fly' && (
        <FlyControls
          movementSpeed={50}
          rollSpeed={0.5}
          dragToLook={true}
        />
      )}

      {/* Keyboard controls */}
      <KeyboardControls />

      {/* Sound manager */}
      <SoundManager />

      {/* Reference grid plane */}
      <ReferenceGrid />

      {/* Background nebula/milky way */}
      <Nebula />

      {/* Galactic neighborhood - Alpha Centauri, Galactic Center */}
      <GalacticNeighborhood />

      {/* Background stars */}
      <StarField />

      {/* Solar wind particles */}
      <SolarWind />

      {/* Zodiacal light */}
      <ZodiacalLight />

      {/* Meteor shower */}
      <MeteorShower />
      {/* <Constellations /> */}

      {/* Distance ruler */}
      <DistanceRuler />

      {/* Gravity wells */}
      <GravityWells />

      {/* Sun */}
      <Sun />

      {/* Orbit lines */}
      {planets.map((planet) => (
        <OrbitLine key={`orbit-${planet.id}`} radius={planet.orbitRadius} planetId={planet.id} color={planet.color} />
      ))}

      {/* Planets */}
      {planets.map((planet) => (
        <Planet key={planet.id} data={planet} />
      ))}

      {/* Dwarf Planets */}
      {dwarfPlanets.map((dp) => (
        <DwarfPlanet key={dp.id} data={dp} />
      ))}

      {/* Dwarf planet orbit lines */}
      {dwarfPlanets.map((dp) => (
        <OrbitLine key={`orbit-${dp.id}`} radius={dp.orbitRadius} planetId={dp.id} color={dp.color} opacity={0.05} />
      ))}

      {/* Comets */}
      {comets.map((comet) => (
        <Comet key={comet.id} data={comet} />
      ))}

      {/* Interstellar Objects */}
      {interstellarObjects.map((obj) => (
        <InterstellarObject key={obj.id} data={obj} />
      ))}

      {/* Centaurs */}
      {centaurs.map((centaur) => (
        <Centaur key={centaur.id} data={centaur} />
      ))}
      {/* Centaur orbit lines */}
      {centaurs.map((centaur) => (
        <OrbitLine key={`orbit-${centaur.id}`} radius={centaur.orbitRadius} planetId={centaur.id} color={centaur.color} opacity={0.04} />
      ))}

      {/* Scattered Disc Objects */}
      {scatteredDiscObjects.map((sdo) => (
        <ScatteredDiscObject key={sdo.id} data={sdo} />
      ))}
      {/* Scattered Disc Object orbit lines */}
      {scatteredDiscObjects.map((sdo) => (
        <OrbitLine key={`orbit-${sdo.id}`} radius={sdo.orbitRadius} planetId={sdo.id} color={sdo.color} opacity={0.04} />
      ))}

      {/* Asteroid belt */}
      <AsteroidBelt />

      {/* Near Earth Objects */}
      <NearEarthObjects />

      {/* Trojan Asteroids at Jupiter L4/L5 */}
      <TrojanAsteroids />

      {/* Kuiper belt */}
      <KuiperBelt />

      {/* Centaur Belt */}
      <CentaurBelt />

      {/* Scattered Disc Belt */}
      <ScatteredDiscBelt />

      {/* Heliosphere */}
      <Heliosphere />

      {/* Oort cloud */}
      <OortCloud />

      {/* Spawned objects */}
      <SpawnedObjects />

      {/* Collision detection and explosions */}
      <CollisionDetector />
      <ExplosionsRenderer />

      {/* Black Holes */}
      {showBlackHole && blackHoles.map((bh) => (
        <BlackHole key={bh.id} data={bh} />
      ))}

      {/* Wormholes */}
      {showWormhole && wormholes.map((wh) => (
        <Wormhole key={wh.id} data={wh} />
      ))}

      {/* Human artifacts */}
      <HumanArtifacts />

      {/* Post-processing effects - Commented out to fix black screen issue */}
      {/* <EffectComposer>
        <Bloom
          luminanceThreshold={0.8}
          luminanceSmoothing={0.9}
          intensity={1.5}
        />
      </EffectComposer> */}
    </>
  )
}
