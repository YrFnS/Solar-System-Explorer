'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { useFrame, type RootState } from '@react-three/fiber'
import * as THREE from 'three'
import {
  FRAME_PACING_RESUME_EVENT,
  requestPacedFrame,
} from './FramePacingController'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'
import { getSimulationDateMs } from './simulation-clock'

export type FrameUpdateLane = 'critical' | 'ephemeris' | 'decorative'
export type FrameLaneInvalidationTarget = FrameUpdateLane | 'all'

export interface FrameLaneTick {
  state: RootState
  quality: EffectiveQuality
  renderDelta: number
  laneDelta: number
  simulationDateMs: number
  frame: number
  nowMs: number
  invalidateLane: (
    lane: FrameLaneInvalidationTarget,
    reason?: string
  ) => void
}

type FrameLaneCallback = (tick: FrameLaneTick) => void

interface FrameLaneRegistration {
  key: string
  label: string
  lane: FrameUpdateLane
  priority: number
  callbackRef: { current: FrameLaneCallback }
  enabledRef: { current: boolean }
}

interface FrameLaneRegistryApi {
  register: (registration: FrameLaneRegistration) => () => void
  invalidate: (
    lane: FrameLaneInvalidationTarget,
    reason?: string,
    requestFrame?: boolean
  ) => void
}

interface UseFrameLaneOptions {
  id: string
  lane: FrameUpdateLane
  priority?: number
  enabled?: boolean
}

interface FrameLaneRuntimeStats {
  ticks: number
  callbackExecutions: number
  skippedFrames: number
  totalMs: number
  lastMs: number
  maxMs: number
}

interface CameraSnapshot {
  initialized: boolean
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  zoom: number
  fov: number
}

interface LaneDiagnostics {
  registered: number
  enabled: number
  ticks: number
  callbackExecutions: number
  skippedFrames: number
  averageMs: number
  lastMs: number
  maxMs: number
  labels: string[]
}

export interface SolarFrameLaneDiagnostics {
  quality: EffectiveQuality
  dispatcherCallbacks: number
  registeredCallbacks: number
  enabledCallbacks: number
  criticalCallbacks: number
  ephemerisCallbacks: number
  decorativeCallbacks: number
  renderFrames: number
  sharedClockReads: number
  ephemerisDateChanges: number
  cameraInvalidations: number
  qualityInvalidations: number
  registrationInvalidations: number
  externalInvalidations: number
  decorativeTargetHz: number
  lastSimulationDateMs: number
  averageDispatchMs: number
  lastDispatchMs: number
  maxDispatchMs: number
  lanes: Record<FrameUpdateLane, LaneDiagnostics>
  lastInvalidationReason: string
  updatedAt: number
}

declare global {
  interface Window {
    __SOLAR_FRAME_LANES__?: SolarFrameLaneDiagnostics
  }
}

interface FrameLaneEventDetail {
  lane?: FrameLaneInvalidationTarget
  reason?: string
}

export const FRAME_LANE_INVALIDATE_EVENT = 'solar-explorer:frame-lane-invalidate'

const LANES: FrameUpdateLane[] = ['critical', 'ephemeris', 'decorative']
const DECORATIVE_TARGET_HZ: Record<EffectiveQuality, number> = {
  eco: 10,
  balanced: 15,
  ultra: 24,
}
const CAMERA_POSITION_EPSILON_SQ = 0.00000025
const CAMERA_QUATERNION_EPSILON = 0.0000001
const DIAGNOSTIC_PUBLISH_INTERVAL_MS = 500

const FrameLaneRegistryContext = createContext<FrameLaneRegistryApi | null>(null)

function createLaneMaps<T>(factory: () => T): Record<FrameUpdateLane, T> {
  return {
    critical: factory(),
    ephemeris: factory(),
    decorative: factory(),
  }
}

function createLaneStats(): Record<FrameUpdateLane, FrameLaneRuntimeStats> {
  return createLaneMaps(() => ({
    ticks: 0,
    callbackExecutions: 0,
    skippedFrames: 0,
    totalMs: 0,
    lastMs: 0,
    maxMs: 0,
  }))
}

function sortRegistrations(registrations: FrameLaneRegistration[]) {
  registrations.sort((left, right) => (
    left.priority - right.priority
    || left.label.localeCompare(right.label)
    || left.key.localeCompare(right.key)
  ))
  return registrations
}

export function requestFrameLaneUpdate(
  lane: FrameLaneInvalidationTarget = 'all',
  reason = 'external'
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<FrameLaneEventDetail>(
    FRAME_LANE_INVALIDATE_EVENT,
    { detail: { lane, reason } }
  ))
}

/**
 * Registers scene work with the single production dispatcher. Components keep
 * their local refs and update logic, but no longer add independent callbacks to
 * React Three Fiber's global frame subscriber list.
 */
export function useFrameLane(
  {
    id,
    lane,
    priority = 0,
    enabled = true,
  }: UseFrameLaneOptions,
  callback: FrameLaneCallback
) {
  const registry = useContext(FrameLaneRegistryContext)
  const reactId = useId()
  const callbackRef = useRef(callback)
  const enabledRef = useRef(enabled)

  if (!registry) {
    throw new Error('useFrameLane must be used inside FrameUpdateLanes')
  }

  const registrationKey = `${id}:${reactId}`

  useLayoutEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useLayoutEffect(() => registry.register({
    key: registrationKey,
    label: id,
    lane,
    priority,
    callbackRef,
    enabledRef,
  }), [lane, priority, registrationKey, registry])

  useEffect(() => {
    enabledRef.current = enabled
    registry.invalidate(lane, `${id}:enabled`, true)
  }, [enabled, id, lane, registry])
}

function cameraChanged(
  camera: RootState['camera'],
  snapshot: CameraSnapshot
) {
  const zoom = 'zoom' in camera ? camera.zoom : 1
  const fov = 'fov' in camera ? camera.fov : Number.NaN
  const changed = !snapshot.initialized
    || snapshot.position.distanceToSquared(camera.position) > CAMERA_POSITION_EPSILON_SQ
    || 1 - Math.abs(snapshot.quaternion.dot(camera.quaternion)) > CAMERA_QUATERNION_EPSILON
    || Math.abs(snapshot.zoom - zoom) > 0.000001
    || (
      Number.isFinite(snapshot.fov)
      && Number.isFinite(fov)
      && Math.abs(snapshot.fov - fov) > 0.000001
    )

  if (!changed) return false

  snapshot.initialized = true
  snapshot.position.copy(camera.position)
  snapshot.quaternion.copy(camera.quaternion)
  snapshot.zoom = zoom
  snapshot.fov = fov
  return true
}

/**
 * Owns one R3F callback and dispatches scene work through explicit lanes:
 * critical work at render cadence, ephemeris work only when the authoritative
 * simulation date changes, and decorative work at a quality-bounded cadence.
 */
export default function FrameUpdateLanes({ children }: { children: ReactNode }) {
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)

  const registrationsRef = useRef(
    createLaneMaps(() => new Map<string, FrameLaneRegistration>())
  )
  const orderedRef = useRef(createLaneMaps<FrameLaneRegistration[]>(() => []))
  const dirtyRef = useRef(createLaneMaps(() => true))
  const lastLaneAtRef = useRef(createLaneMaps(() => Number.NEGATIVE_INFINITY))
  const lastEphemerisDateRef = useRef(Number.NaN)
  const frameRef = useRef(0)
  const lastPublishAtRef = useRef(Number.NEGATIVE_INFINITY)
  const lastDispatchMsRef = useRef(0)
  const totalDispatchMsRef = useRef(0)
  const maxDispatchMsRef = useRef(0)
  const sharedClockReadsRef = useRef(0)
  const ephemerisDateChangesRef = useRef(0)
  const cameraInvalidationsRef = useRef(0)
  const qualityInvalidationsRef = useRef(0)
  const registrationInvalidationsRef = useRef(0)
  const externalInvalidationsRef = useRef(0)
  const lastInvalidationReasonRef = useRef('initial')
  const laneStatsRef = useRef(createLaneStats())
  const qualityRef = useRef(quality)
  const reducedMotionRef = useRef(reducedMotion)
  const diagnosticsEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false
    return navigator.webdriver
      || new URLSearchParams(window.location.search).get('diagnostics') === '1'
  }, [])
  const cameraSnapshotRef = useRef<CameraSnapshot>({
    initialized: false,
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    zoom: Number.NaN,
    fov: Number.NaN,
  })

  const rebuildLane = useCallback((lane: FrameUpdateLane) => {
    orderedRef.current[lane] = sortRegistrations(
      [...registrationsRef.current[lane].values()]
    )
  }, [])

  const invalidate = useCallback((
    lane: FrameLaneInvalidationTarget,
    reason = 'external',
    requestFrame = true
  ) => {
    if (lane === 'all') {
      LANES.forEach((entry) => {
        dirtyRef.current[entry] = true
      })
    } else {
      dirtyRef.current[lane] = true
    }

    lastInvalidationReasonRef.current = reason
    if (reason.startsWith('registration:')) {
      registrationInvalidationsRef.current += 1
    } else if (reason === 'quality') {
      qualityInvalidationsRef.current += 1
    } else if (reason !== 'camera') {
      externalInvalidationsRef.current += 1
    }

    if (requestFrame) requestPacedFrame(`frame-lane:${reason}`, 700)
  }, [])

  const register = useCallback((registration: FrameLaneRegistration) => {
    const laneRegistrations = registrationsRef.current[registration.lane]
    laneRegistrations.set(registration.key, registration)
    rebuildLane(registration.lane)
    invalidate(
      registration.lane,
      `registration:add:${registration.label}`,
      true
    )

    return () => {
      laneRegistrations.delete(registration.key)
      rebuildLane(registration.lane)
      invalidate(
        registration.lane,
        `registration:remove:${registration.label}`,
        true
      )
    }
  }, [invalidate, rebuildLane])

  const registryApi = useMemo<FrameLaneRegistryApi>(() => ({
    register,
    invalidate,
  }), [invalidate, register])

  const publishDiagnostics = useCallback((
    simulationDateMs: number,
    nowMs = performance.now()
  ) => {
    if (!diagnosticsEnabled) return

    const decorativeTargetHz = reducedMotionRef.current
      ? Math.min(8, DECORATIVE_TARGET_HZ[qualityRef.current])
      : DECORATIVE_TARGET_HZ[qualityRef.current]
    const laneDiagnostics = {} as Record<FrameUpdateLane, LaneDiagnostics>
    let registeredCallbacks = 0
    let enabledCallbacks = 0

    for (const lane of LANES) {
      const registrations = orderedRef.current[lane]
      const enabledRegistrations = registrations.filter(
        (entry) => entry.enabledRef.current
      )
      const stats = laneStatsRef.current[lane]
      registeredCallbacks += registrations.length
      enabledCallbacks += enabledRegistrations.length
      laneDiagnostics[lane] = {
        registered: registrations.length,
        enabled: enabledRegistrations.length,
        ticks: stats.ticks,
        callbackExecutions: stats.callbackExecutions,
        skippedFrames: stats.skippedFrames,
        averageMs: stats.ticks > 0 ? stats.totalMs / stats.ticks : 0,
        lastMs: stats.lastMs,
        maxMs: stats.maxMs,
        labels: registrations.map((entry) => entry.label),
      }
    }

    window.__SOLAR_FRAME_LANES__ = {
      quality: qualityRef.current,
      dispatcherCallbacks: 1,
      registeredCallbacks,
      enabledCallbacks,
      criticalCallbacks: laneDiagnostics.critical.registered,
      ephemerisCallbacks: laneDiagnostics.ephemeris.registered,
      decorativeCallbacks: laneDiagnostics.decorative.registered,
      renderFrames: frameRef.current,
      sharedClockReads: sharedClockReadsRef.current,
      ephemerisDateChanges: ephemerisDateChangesRef.current,
      cameraInvalidations: cameraInvalidationsRef.current,
      qualityInvalidations: qualityInvalidationsRef.current,
      registrationInvalidations: registrationInvalidationsRef.current,
      externalInvalidations: externalInvalidationsRef.current,
      decorativeTargetHz,
      lastSimulationDateMs: simulationDateMs,
      averageDispatchMs: frameRef.current > 0
        ? totalDispatchMsRef.current / frameRef.current
        : 0,
      lastDispatchMs: lastDispatchMsRef.current,
      maxDispatchMs: maxDispatchMsRef.current,
      lanes: laneDiagnostics,
      lastInvalidationReason: lastInvalidationReasonRef.current,
      updatedAt: Date.now(),
    }
    lastPublishAtRef.current = nowMs
  }, [diagnosticsEnabled])

  useEffect(() => {
    qualityRef.current = quality
    reducedMotionRef.current = reducedMotion
    invalidate('all', 'quality', true)
  }, [invalidate, quality, reducedMotion])

  useEffect(() => {
    const handleExternalInvalidation = (event: Event) => {
      const detail = (event as CustomEvent<FrameLaneEventDetail>).detail
      invalidate(
        detail?.lane ?? 'all',
        detail?.reason ?? 'external',
        true
      )
    }
    const handleResume = () => {
      lastLaneAtRef.current = createLaneMaps(() => Number.NEGATIVE_INFINITY)
      lastEphemerisDateRef.current = Number.NaN
      cameraSnapshotRef.current.initialized = false
      invalidate('all', 'visibility-resume', true)
    }

    window.addEventListener(
      FRAME_LANE_INVALIDATE_EVENT,
      handleExternalInvalidation
    )
    window.addEventListener(FRAME_PACING_RESUME_EVENT, handleResume)

    return () => {
      window.removeEventListener(
        FRAME_LANE_INVALIDATE_EVENT,
        handleExternalInvalidation
      )
      window.removeEventListener(FRAME_PACING_RESUME_EVENT, handleResume)
    }
  }, [invalidate])

  useFrame((state, renderDelta) => {
    const dispatchStartedAt = diagnosticsEnabled ? performance.now() : 0
    const nowMs = performance.now()
    const simulationDateMs = getSimulationDateMs()
    frameRef.current += 1
    sharedClockReadsRef.current += 1

    const runLane = (lane: FrameUpdateLane) => {
      const registrations = orderedRef.current[lane]
      dirtyRef.current[lane] = false
      const previousAt = lastLaneAtRef.current[lane]
      const laneDelta = Number.isFinite(previousAt)
        ? Math.min(0.5, Math.max(0, (nowMs - previousAt) / 1_000))
        : Math.max(0, renderDelta)
      lastLaneAtRef.current[lane] = nowMs

      const laneStartedAt = diagnosticsEnabled ? performance.now() : 0
      let callbackExecutions = 0
      const tick: FrameLaneTick = {
        state,
        quality: qualityRef.current,
        renderDelta,
        laneDelta,
        simulationDateMs,
        frame: frameRef.current,
        nowMs,
        invalidateLane: invalidate,
      }

      for (const registration of registrations) {
        if (!registration.enabledRef.current) continue
        registration.callbackRef.current(tick)
        callbackExecutions += 1
      }

      const stats = laneStatsRef.current[lane]
      stats.ticks += 1
      stats.callbackExecutions += callbackExecutions
      if (diagnosticsEnabled) {
        const duration = performance.now() - laneStartedAt
        stats.totalMs += duration
        stats.lastMs = duration
        stats.maxMs = Math.max(stats.maxMs, duration)
      }
    }

    runLane('critical')

    if (cameraChanged(state.camera, cameraSnapshotRef.current)) {
      dirtyRef.current.decorative = true
      cameraInvalidationsRef.current += 1
      lastInvalidationReasonRef.current = 'camera'
    }

    const ephemerisChanged = simulationDateMs !== lastEphemerisDateRef.current
    if (dirtyRef.current.ephemeris || ephemerisChanged) {
      if (ephemerisChanged && Number.isFinite(lastEphemerisDateRef.current)) {
        ephemerisDateChangesRef.current += 1
      }
      lastEphemerisDateRef.current = simulationDateMs
      runLane('ephemeris')
    } else {
      laneStatsRef.current.ephemeris.skippedFrames += 1
    }

    const decorativeTargetHz = reducedMotionRef.current
      ? Math.min(8, DECORATIVE_TARGET_HZ[qualityRef.current])
      : DECORATIVE_TARGET_HZ[qualityRef.current]
    const decorativeIntervalMs = 1_000 / decorativeTargetHz
    const decorativeDue = (
      nowMs - lastLaneAtRef.current.decorative
    ) >= decorativeIntervalMs

    if (dirtyRef.current.decorative || decorativeDue) {
      runLane('decorative')
    } else {
      laneStatsRef.current.decorative.skippedFrames += 1
    }

    if (diagnosticsEnabled) {
      const dispatchMs = performance.now() - dispatchStartedAt
      lastDispatchMsRef.current = dispatchMs
      totalDispatchMsRef.current += dispatchMs
      maxDispatchMsRef.current = Math.max(maxDispatchMsRef.current, dispatchMs)

      if (
        frameRef.current <= 2
        || nowMs - lastPublishAtRef.current >= DIAGNOSTIC_PUBLISH_INTERVAL_MS
      ) {
        publishDiagnostics(simulationDateMs, nowMs)
      }
    }
  }, -90)

  useEffect(() => () => {
    delete window.__SOLAR_FRAME_LANES__
  }, [])

  return (
    <FrameLaneRegistryContext.Provider value={registryApi}>
      {children}
    </FrameLaneRegistryContext.Provider>
  )
}
