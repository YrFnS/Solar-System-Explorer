'use client'

import { useCallback, useEffect, useRef } from 'react'
import { FlyControls, OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  getBodyRadius,
  getBodyVisualPosition,
  getSpawnedObjectVisualPosition,
} from './ephemeris'
import {
  activateExperienceMode,
  useExperienceStore,
} from './experience-store'
import {
  DAY_MS,
  getSimulationDateMs,
  setSimulationDateMs as setClockDateMs,
} from './simulation-clock'
import { useSolarSystemStore } from './store'

const WARP_PRESETS = [0, 1, 60, 1_440, 43_200, 525_600]

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2
}

export function SimulationKeyboardControls() {
  const navigateNext = useSolarSystemStore((state) => state.navigateNext)
  const navigatePrev = useSolarSystemStore((state) => state.navigatePrev)
  const setTimeSpeed = useSolarSystemStore((state) => state.setTimeSpeed)
  const timeSpeed = useSolarSystemStore((state) => state.timeSpeed)
  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const resetCamera = useSolarSystemStore((state) => state.resetCamera)
  const setCameraPosition = useSolarSystemStore((state) => state.setCameraPosition)
  const startTour = useSolarSystemStore((state) => state.startTour)
  const stopTour = useSolarSystemStore((state) => state.stopTour)
  const isTourMode = useSolarSystemStore((state) => state.isTourMode)
  const nextTourStep = useSolarSystemStore((state) => state.nextTourStep)
  const prevTourStep = useSolarSystemStore((state) => state.prevTourStep)
  const toggleAutoRotate = useSolarSystemStore((state) => state.toggleAutoRotate)
  const setScreenshotMode = useSolarSystemStore((state) => state.setScreenshotMode)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const toggleFollowMode = useSolarSystemStore((state) => state.toggleFollowMode)
  const cameraMode = useSolarSystemStore((state) => state.cameraMode)
  const setCameraMode = useSolarSystemStore((state) => state.setCameraMode)
  const setCustomDate = useSolarSystemStore((state) => state.setCustomDate)
  const publishDate = useExperienceStore((state) => state.setSimulationDateMs)
  const lastSpeedRef = useRef(1_440)

  useEffect(() => {
    if (!isPaused && timeSpeed !== 0) lastSpeedRef.current = timeSpeed
  }, [isPaused, timeSpeed])

  useEffect(() => {
    const setDate = (dateMs: number) => {
      setClockDateMs(dateMs)
      publishDate(dateMs)
      setCustomDate(new Date(dateMs))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          if (isTourMode) nextTourStep()
          else navigateNext()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          if (isTourMode) prevTourStep()
          else navigatePrev()
          break
        case '+':
        case '=': {
          event.preventDefault()
          const next = WARP_PRESETS.find((preset) => preset > timeSpeed) ?? WARP_PRESETS.at(-1)!
          setTimeSpeed(next)
          break
        }
        case '-':
        case '_': {
          event.preventDefault()
          const previous = [...WARP_PRESETS].reverse().find((preset) => preset < timeSpeed) ?? 0
          setTimeSpeed(previous)
          break
        }
        case ' ':
          event.preventDefault()
          if (isPaused || timeSpeed === 0) setTimeSpeed(lastSpeedRef.current || 1_440)
          else {
            lastSpeedRef.current = timeSpeed
            setTimeSpeed(0)
          }
          break
        case '[':
          event.preventDefault()
          setDate(getSimulationDateMs() - DAY_MS)
          break
        case ']':
          event.preventDefault()
          setDate(getSimulationDateMs() + DAY_MS)
          break
        case 'Escape':
          event.preventDefault()
          if (isTourMode) stopTour()
          else {
            resetCamera()
            setCameraPosition([80, 60, 80])
          }
          break
        case 't':
        case 'T':
          event.preventDefault()
          if (isTourMode) stopTour()
          else startTour()
          break
        case 'r':
        case 'R':
          event.preventDefault()
          toggleAutoRotate()
          break
        case 's':
        case 'S':
          event.preventDefault()
          setScreenshotMode(!screenshotMode)
          break
        case 'f':
        case 'F':
          event.preventDefault()
          toggleFollowMode()
          break
        case 'm':
        case 'M':
          event.preventDefault()
          setCameraMode(cameraMode === 'orbit' ? 'fly' : 'orbit')
          break
        case '1':
          activateExperienceMode('explore')
          break
        case '2':
          activateExperienceMode('scientific')
          break
        case '3':
          activateExperienceMode('sandbox')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    cameraMode,
    isPaused,
    isTourMode,
    navigateNext,
    navigatePrev,
    nextTourStep,
    prevTourStep,
    publishDate,
    resetCamera,
    screenshotMode,
    setCameraMode,
    setCameraPosition,
    setCustomDate,
    setScreenshotMode,
    setTimeSpeed,
    startTour,
    stopTour,
    timeSpeed,
    toggleAutoRotate,
    toggleFollowMode,
  ])

  return null
}

export default function EphemerisCameraController() {
  const controlsRef = useRef<any>(null)
  const focusTarget = useSolarSystemStore((state) => state.focusTarget)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const autoRotate = useSolarSystemStore((state) => state.autoRotate)
  const cameraPosition = useSolarSystemStore((state) => state.cameraPosition)
  const setCameraPosition = useSolarSystemStore((state) => state.setCameraPosition)
  const cameraMode = useSolarSystemStore((state) => state.cameraMode)
  const followMode = useSolarSystemStore((state) => state.followMode)
  const spawnedObjects = useSolarSystemStore((state) => state.spawnedObjects)
  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const mode = useExperienceStore((state) => state.mode)
  const { camera, invalidate } = useThree()

  const animatingRef = useRef(false)
  const progressRef = useRef(0)
  const startRef = useRef(new THREE.Vector3())
  const endRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const bodyPositionRef = useRef(new THREE.Vector3())
  const directionRef = useRef(new THREE.Vector3())

  const resolveBodyPosition = useCallback(
    (bodyId: string, target: THREE.Vector3) => {
      const spawned = spawnedObjects.find((object) => object.id === bodyId)
      if (spawned) {
        return getSpawnedObjectVisualPosition(
          spawned,
          getSimulationDateMs(),
          mode,
          target
        )
      }
      return getBodyVisualPosition(bodyId, getSimulationDateMs(), mode, target)
    },
    [mode, spawnedObjects]
  )

  const resolveBodyRadius = useCallback(
    (bodyId: string) => {
      const spawned = spawnedObjects.find((object) => object.id === bodyId)
      return spawned?.radius ?? getBodyRadius(bodyId)
    },
    [spawnedObjects]
  )

  useEffect(() => {
    if (!focusTarget) return

    const position = resolveBodyPosition(focusTarget, bodyPositionRef.current)
    const radius = resolveBodyRadius(focusTarget)
    const viewDistance = Math.max(1.8, radius * 7 + 0.8)
    const elevation = Math.max(0.75, radius * 2.4)

    directionRef.current.copy(camera.position).sub(position)
    if (directionRef.current.lengthSq() < 0.001) {
      directionRef.current.set(1, 0.55, 1)
    }
    directionRef.current.normalize()

    startRef.current.copy(camera.position)
    endRef.current
      .copy(position)
      .addScaledVector(directionRef.current, viewDistance)
    endRef.current.y += elevation
    targetRef.current.copy(position)
    progressRef.current = 0
    animatingRef.current = true
    setSelectedBody(focusTarget)
    invalidate()
  }, [
    camera,
    focusTarget,
    invalidate,
    resolveBodyPosition,
    resolveBodyRadius,
    setSelectedBody,
  ])

  useEffect(() => {
    if (!cameraPosition) return
    startRef.current.copy(camera.position)
    endRef.current.fromArray(cameraPosition)
    targetRef.current.set(0, 0, 0)
    progressRef.current = 0
    animatingRef.current = true
    setCameraPosition(null)
    invalidate()
  }, [camera, cameraPosition, invalidate, setCameraPosition])

  useFrame((_, delta) => {
    if (animatingRef.current) {
      if (focusTarget) {
        resolveBodyPosition(focusTarget, targetRef.current)
      }
      progressRef.current += delta * 0.9
      const progress = Math.min(1, progressRef.current)
      const eased = easeInOutCubic(progress)
      camera.position.lerpVectors(startRef.current, endRef.current, eased)

      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetRef.current, 0.16)
        controlsRef.current.update()
      }

      if (progress >= 1) animatingRef.current = false
      else invalidate()
      return
    }

    if (followMode && selectedBody && controlsRef.current) {
      resolveBodyPosition(selectedBody, targetRef.current)
      controlsRef.current.target.lerp(targetRef.current, 0.12)
      controlsRef.current.update()
    }
  }, -20)

  if (cameraMode === 'fly') {
    return (
      <FlyControls
        movementSpeed={50}
        rollSpeed={0.45}
        dragToLook
        makeDefault
      />
    )
  }

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan
      enableZoom
      enableRotate
      minDistance={1.2}
      maxDistance={8_000}
      zoomSpeed={1.15}
      rotateSpeed={0.48}
      panSpeed={0.75}
      enableDamping={!isPaused}
      dampingFactor={0.05}
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
      onChange={() => invalidate()}
    />
  )
}
