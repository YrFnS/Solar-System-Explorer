'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  activateExperienceMode,
  useExperienceStore,
} from './experience-store'
import {
  advanceSimulationClock,
  getSimulationDateMs,
  MINUTE_MS,
  setSimulationDateMs,
} from './simulation-clock'
import {
  FRAME_PACING_RESUME_EVENT,
  requestPacedFrame,
} from './FramePacingController'
import { useSolarSystemStore } from './store'

const NORMAL_UI_PUBLISH_INTERVAL_SECONDS = 1
const HIGH_WARP_UI_PUBLISH_INTERVAL_SECONDS = 0.25
const HIGH_WARP_THRESHOLD = 43_200
const MAX_VISIBLE_WALL_DELTA_SECONDS = 0.75

export interface SolarSimulationTimingDiagnostics {
  dateMs: number
  timeSpeed: number
  paused: boolean
  renderFrames: number
  activeWallSeconds: number
  simulatedMinutes: number
  lastWallDeltaSeconds: number
  uiPublishIntervalSeconds: number
  visibilityResets: number
  updatedAt: number
}

declare global {
  interface Window {
    __SOLAR_SIMULATION_TIMING__?: SolarSimulationTimingDiagnostics
  }
}

/**
 * Advances the authoritative ephemeris clock from monotonic wall time rather
 * than assuming a fixed amount of simulation work per rendered frame. A 24,
 * 30, 45, or 60 FPS render cadence therefore advances the same simulated time.
 */
export default function SimulationController() {
  const timeSpeed = useSolarSystemStore((state) => state.timeSpeed)
  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const customDate = useSolarSystemStore((state) => state.customDate)
  const setElapsedTime = useSolarSystemStore((state) => state.setElapsedTime)
  const mode = useExperienceStore((state) => state.mode)
  const publishDate = useExperienceStore((state) => state.setSimulationDateMs)

  const publishElapsedRef = useRef(Number.POSITIVE_INFINITY)
  const initializedModeRef = useRef(false)
  const lastWallTimeRef = useRef<number | null>(null)
  const renderFramesRef = useRef(0)
  const activeWallSecondsRef = useRef(0)
  const simulatedMinutesRef = useRef(0)
  const visibilityResetsRef = useRef(0)

  const customDateMs = customDate?.getTime() ?? null

  useEffect(() => {
    if (initializedModeRef.current) return
    initializedModeRef.current = true
    activateExperienceMode(mode)
    requestPacedFrame('experience-initialized', 500)
  }, [mode])

  useEffect(() => {
    const nextDateMs = customDateMs ?? Date.now()
    setSimulationDateMs(nextDateMs)
    publishDate(nextDateMs)
    setElapsedTime(nextDateMs)
    publishElapsedRef.current = 0
    lastWallTimeRef.current = performance.now()
    requestPacedFrame('simulation-date-change', 650)
  }, [customDateMs, publishDate, setElapsedTime])

  useEffect(() => {
    const resetWallBaseline = () => {
      lastWallTimeRef.current = performance.now()
      visibilityResetsRef.current += 1
    }

    const handleVisibility = () => {
      if (!document.hidden) resetWallBaseline()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener(FRAME_PACING_RESUME_EVENT, resetWallBaseline)
    resetWallBaseline()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener(FRAME_PACING_RESUME_EVENT, resetWallBaseline)
    }
  }, [])

  useFrame(() => {
    const now = performance.now()
    const previous = lastWallTimeRef.current ?? now
    lastWallTimeRef.current = now

    const rawWallDelta = Math.max(0, (now - previous) / 1_000)
    const wallDelta = Math.min(
      MAX_VISIBLE_WALL_DELTA_SECONDS,
      rawWallDelta
    )
    const beforeDateMs = getSimulationDateMs()
    const dateMs = advanceSimulationClock(wallDelta, timeSpeed, isPaused)
    const simulatedDeltaMinutes = (dateMs - beforeDateMs) / MINUTE_MS
    const uiPublishInterval = Math.abs(timeSpeed) >= HIGH_WARP_THRESHOLD
      ? HIGH_WARP_UI_PUBLISH_INTERVAL_SECONDS
      : NORMAL_UI_PUBLISH_INTERVAL_SECONDS

    renderFramesRef.current += 1
    publishElapsedRef.current += wallDelta
    if (!isPaused && timeSpeed !== 0) {
      activeWallSecondsRef.current += wallDelta
      simulatedMinutesRef.current += simulatedDeltaMinutes
    }

    window.__SOLAR_SIMULATION_TIMING__ = {
      dateMs,
      timeSpeed,
      paused: isPaused,
      renderFrames: renderFramesRef.current,
      activeWallSeconds: activeWallSecondsRef.current,
      simulatedMinutes: simulatedMinutesRef.current,
      lastWallDeltaSeconds: wallDelta,
      uiPublishIntervalSeconds: uiPublishInterval,
      visibilityResets: visibilityResetsRef.current,
      updatedAt: Date.now(),
    }

    if (publishElapsedRef.current < uiPublishInterval) return

    publishElapsedRef.current = 0
    publishDate(dateMs)
    setElapsedTime(dateMs)
  }, -100)

  useEffect(() => {
    const dateMs = getSimulationDateMs()
    publishDate(dateMs)
    setElapsedTime(dateMs)

    return () => {
      delete window.__SOLAR_SIMULATION_TIMING__
    }
  }, [publishDate, setElapsedTime])

  return null
}
