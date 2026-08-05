'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  type FramePacingMode,
  type RendererPowerPreference,
  usePerformanceStore,
} from './performance-store'
import { getFramePacingTarget } from './frame-pacing-policy'
import {
  SCENE_LOAD_STAGES,
  useSceneLoadStage,
} from './SceneLoadScheduler'
import { useSolarSystemStore } from './store'

export const FRAME_PACING_ACTIVITY_EVENT = 'solar-explorer:frame-activity'
export const FRAME_PACING_RESUME_EVENT = 'solar-explorer:frame-resume'

interface FrameActivityDetail {
  reason?: string
  durationMs?: number
}

export interface SolarFramePacingDiagnostics {
  quality: EffectiveQuality
  mode: FramePacingMode
  targetFps: number
  actualFps: number | null
  p95FrameIntervalMs: number | null
  hidden: boolean
  sceneLoading: boolean
  simulationRunning: boolean
  interactionActive: boolean
  continuousMotion: boolean
  autoBenchmarkActive: boolean
  rendererPowerPreference: RendererPowerPreference
  scheduledFrames: number
  renderedFrames: number
  renderedWhileHidden: number
  suspensions: number
  timerWakeups: number
  lastReason: string
  updatedAt: number
}

declare global {
  interface Window {
    __SOLAR_FRAME_PACING__?: SolarFramePacingDiagnostics
  }
}

export function requestPacedFrame(reason = 'external', durationMs = 900) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<FrameActivityDetail>(
    FRAME_PACING_ACTIVITY_EVENT,
    { detail: { reason, durationMs } }
  ))
}

function percentile95(samples: number[]) {
  if (samples.length === 0) return null
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  )
  return sorted[index]
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return element?.tagName === 'INPUT'
    || element?.tagName === 'TEXTAREA'
    || Boolean(element?.isContentEditable)
}

interface RuntimeState {
  quality: EffectiveQuality
  preset: 'auto' | EffectiveQuality
  autoStatus: string
  reducedMotion: boolean
  sceneLoadStage: number
  isPaused: boolean
  autoRotate: boolean
  followMode: boolean
  isTourMode: boolean
  cameraMode: string
  rendererPowerPreference: RendererPowerPreference
}

interface FramePacingControllerProps {
  rendererPowerPreference: RendererPowerPreference
}

/**
 * Owns the production render loop. Canvas runs in `never` mode so controls,
 * damping, suspense resolution, and legacy invalidations cannot silently
 * restore an uncapped requestAnimationFrame loop.
 */
export default function FramePacingController({
  rendererPowerPreference,
}: FramePacingControllerProps) {
  const advance = useThree((state) => state.advance)
  const sceneLoadStage = useSceneLoadStage()

  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const autoStatus = usePerformanceStore((state) => state.autoStatus)
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const setFramePacingStatus = usePerformanceStore(
    (state) => state.setFramePacingStatus
  )

  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const autoRotate = useSolarSystemStore((state) => state.autoRotate)
  const followMode = useSolarSystemStore((state) => state.followMode)
  const isTourMode = useSolarSystemStore((state) => state.isTourMode)
  const cameraMode = useSolarSystemStore((state) => state.cameraMode)
  const focusTarget = useSolarSystemStore((state) => state.focusTarget)
  const cameraPosition = useSolarSystemStore((state) => state.cameraPosition)

  const quality = getEffectiveQuality({ preset, autoQuality })
  const stateRef = useRef<RuntimeState>({
    quality,
    preset,
    autoStatus,
    reducedMotion,
    sceneLoadStage,
    isPaused,
    autoRotate,
    followMode,
    isTourMode,
    cameraMode,
    rendererPowerPreference,
  })

  const hiddenRef = useRef(false)
  const activityUntilRef = useRef(0)
  const autoBenchmarkUntilRef = useRef(0)
  const lastAdvanceAtRef = useRef(0)
  const lastRenderedAtRef = useRef(0)
  const renderTimesRef = useRef<number[]>([])
  const frameIntervalsRef = useRef<number[]>([])
  const scheduledFramesRef = useRef(0)
  const renderedFramesRef = useRef(0)
  const renderedWhileHiddenRef = useRef(0)
  const suspensionsRef = useRef(0)
  const timerWakeupsRef = useRef(0)
  const actualFpsRef = useRef<number | null>(null)
  const p95FrameIntervalRef = useRef<number | null>(null)
  const lastReasonRef = useRef('startup')
  const lastPublishAtRef = useRef(0)

  const resolveMode = useCallback((now: number): FramePacingMode => {
    const current = stateRef.current
    if (hiddenRef.current) return 'suspended'

    const sceneLoading = current.sceneLoadStage < SCENE_LOAD_STAGES.artifacts
    const continuousMotion = current.autoRotate
      || current.followMode
      || current.isTourMode
      || current.cameraMode === 'fly'
    const autoBenchmarkActive = current.preset === 'auto'
      && now < autoBenchmarkUntilRef.current
    const interactionActive = now < activityUntilRef.current

    if (
      sceneLoading
      || continuousMotion
      || autoBenchmarkActive
      || interactionActive
    ) {
      return 'active'
    }

    return current.isPaused ? 'static' : 'idle'
  }, [])

  const publishDiagnostics = useCallback((now = performance.now()) => {
    const current = stateRef.current
    const mode = resolveMode(now)
    const targetFps = getFramePacingTarget(
      current.quality,
      mode,
      current.reducedMotion
    )
    const sceneLoading = current.sceneLoadStage < SCENE_LOAD_STAGES.artifacts
    const continuousMotion = current.autoRotate
      || current.followMode
      || current.isTourMode
      || current.cameraMode === 'fly'
    const autoBenchmarkActive = current.preset === 'auto'
      && now < autoBenchmarkUntilRef.current
    const interactionActive = now < activityUntilRef.current

    setFramePacingStatus(
      mode,
      targetFps,
      current.rendererPowerPreference
    )

    window.__SOLAR_FRAME_PACING__ = {
      quality: current.quality,
      mode,
      targetFps,
      actualFps: actualFpsRef.current,
      p95FrameIntervalMs: p95FrameIntervalRef.current,
      hidden: hiddenRef.current,
      sceneLoading,
      simulationRunning: !current.isPaused,
      interactionActive,
      continuousMotion,
      autoBenchmarkActive,
      rendererPowerPreference: current.rendererPowerPreference,
      scheduledFrames: scheduledFramesRef.current,
      renderedFrames: renderedFramesRef.current,
      renderedWhileHidden: renderedWhileHiddenRef.current,
      suspensions: suspensionsRef.current,
      timerWakeups: timerWakeupsRef.current,
      lastReason: lastReasonRef.current,
      updatedAt: Date.now(),
    }
  }, [resolveMode, setFramePacingStatus])

  useEffect(() => {
    stateRef.current = {
      quality,
      preset,
      autoStatus,
      reducedMotion,
      sceneLoadStage,
      isPaused,
      autoRotate,
      followMode,
      isTourMode,
      cameraMode,
      rendererPowerPreference,
    }
    requestPacedFrame('runtime-state', 1_800)
  }, [
    autoRotate,
    autoStatus,
    cameraMode,
    followMode,
    isPaused,
    isTourMode,
    preset,
    quality,
    reducedMotion,
    rendererPowerPreference,
    sceneLoadStage,
  ])

  useEffect(() => {
    if (
      preset === 'auto'
      && sceneLoadStage >= SCENE_LOAD_STAGES.artifacts
      && autoStatus !== 'limited'
    ) {
      autoBenchmarkUntilRef.current = performance.now() + 20_000
      requestPacedFrame('auto-benchmark', 20_000)
    }
  }, [autoQuality, autoStatus, preset, sceneLoadStage])

  useEffect(() => {
    requestPacedFrame(
      focusTarget ? 'camera-focus' : cameraPosition ? 'camera-reset' : 'camera-state',
      1_800
    )
  }, [cameraPosition, focusTarget])

  useEffect(() => {
    let cancelled = false
    let timeoutHandle: number | undefined
    let animationHandle: number | undefined

    const clearScheduled = () => {
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle)
        timeoutHandle = undefined
      }
      if (animationHandle !== undefined) {
        window.cancelAnimationFrame(animationHandle)
        animationHandle = undefined
      }
    }

    const schedule = (preferSoon = false) => {
      clearScheduled()
      if (cancelled || hiddenRef.current) {
        publishDiagnostics()
        return
      }

      const now = performance.now()
      const mode = resolveMode(now)
      const targetFps = getFramePacingTarget(
        stateRef.current.quality,
        mode,
        stateRef.current.reducedMotion
      )

      if (targetFps <= 0) {
        publishDiagnostics(now)
        return
      }

      const intervalMs = 1_000 / targetFps
      const earliest = lastAdvanceAtRef.current > 0
        ? lastAdvanceAtRef.current + intervalMs
        : now
      const dueAt = preferSoon ? Math.max(now, earliest) : earliest
      const delayMs = Math.max(0, dueAt - now - 2)

      timeoutHandle = window.setTimeout(() => {
        timeoutHandle = undefined
        timerWakeupsRef.current += 1

        animationHandle = window.requestAnimationFrame((timestamp) => {
          animationHandle = undefined
          if (cancelled || hiddenRef.current) {
            publishDiagnostics(timestamp)
            return
          }

          const currentMode = resolveMode(timestamp)
          const currentTarget = getFramePacingTarget(
            stateRef.current.quality,
            currentMode,
            stateRef.current.reducedMotion
          )
          const minimumInterval = currentTarget > 0
            ? 1_000 / currentTarget
            : Number.POSITIVE_INFINITY
          const sinceLast = timestamp - lastAdvanceAtRef.current

          if (
            lastAdvanceAtRef.current > 0
            && sinceLast + 0.75 < minimumInterval
          ) {
            schedule(false)
            return
          }

          lastAdvanceAtRef.current = timestamp
          scheduledFramesRef.current += 1
          advance(timestamp, true)
          schedule(false)
        })
      }, delayMs)
    }

    const markActivity = (reason: string, durationMs = 900) => {
      activityUntilRef.current = Math.max(
        activityUntilRef.current,
        performance.now() + durationMs
      )
      lastReasonRef.current = reason
      schedule(true)
    }

    const handleFrameActivity = (event: Event) => {
      const detail = (event as CustomEvent<FrameActivityDetail>).detail
      markActivity(detail?.reason ?? 'external', detail?.durationMs ?? 900)
    }

    const handlePointer = (event: PointerEvent) => {
      if (event.type === 'pointermove' && event.buttons === 0) return
      markActivity('pointer', event.type === 'pointermove' ? 700 : 1_100)
    }

    const handleWheel = () => markActivity('wheel', 1_000)
    const handleTouch = () => markActivity('touch', 1_000)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      markActivity('keyboard', 900)
    }

    const handleVisibility = () => {
      const hidden = document.hidden
      if (hidden === hiddenRef.current) return

      hiddenRef.current = hidden
      if (hidden) {
        suspensionsRef.current += 1
        lastReasonRef.current = 'document-hidden'
        clearScheduled()
        publishDiagnostics()
        return
      }

      lastAdvanceAtRef.current = 0
      lastRenderedAtRef.current = 0
      lastReasonRef.current = 'document-visible'
      activityUntilRef.current = performance.now() + 750
      window.dispatchEvent(new Event(FRAME_PACING_RESUME_EVENT))
      schedule(true)
    }

    hiddenRef.current = document.hidden
    window.addEventListener(FRAME_PACING_ACTIVITY_EVENT, handleFrameActivity)
    window.addEventListener('pointerdown', handlePointer, { passive: true })
    window.addEventListener('pointermove', handlePointer, { passive: true })
    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchstart', handleTouch, { passive: true })
    window.addEventListener('touchmove', handleTouch, { passive: true })
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('visibilitychange', handleVisibility)

    schedule(true)

    return () => {
      cancelled = true
      clearScheduled()
      window.removeEventListener(FRAME_PACING_ACTIVITY_EVENT, handleFrameActivity)
      window.removeEventListener('pointerdown', handlePointer)
      window.removeEventListener('pointermove', handlePointer)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouch)
      window.removeEventListener('touchmove', handleTouch)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [advance, publishDiagnostics, resolveMode])

  useFrame(() => {
    const now = performance.now()
    renderedFramesRef.current += 1
    if (document.hidden) renderedWhileHiddenRef.current += 1

    if (lastRenderedAtRef.current > 0) {
      const interval = now - lastRenderedAtRef.current
      if (Number.isFinite(interval) && interval > 0 && interval < 2_000) {
        frameIntervalsRef.current.push(interval)
        if (frameIntervalsRef.current.length > 120) {
          frameIntervalsRef.current.splice(
            0,
            frameIntervalsRef.current.length - 120
          )
        }
      }
    }
    lastRenderedAtRef.current = now

    renderTimesRef.current.push(now)
    while (
      renderTimesRef.current.length > 1
      && now - renderTimesRef.current[0] > 2_000
    ) {
      renderTimesRef.current.shift()
    }

    if (renderTimesRef.current.length > 1) {
      const durationSeconds = (
        renderTimesRef.current.at(-1)! - renderTimesRef.current[0]
      ) / 1_000
      actualFpsRef.current = durationSeconds > 0
        ? (renderTimesRef.current.length - 1) / durationSeconds
        : null
    }
    p95FrameIntervalRef.current = percentile95(frameIntervalsRef.current)

    if (
      renderedFramesRef.current <= 2
      || now - lastPublishAtRef.current >= 500
    ) {
      lastPublishAtRef.current = now
      publishDiagnostics(now)
    }
  }, -1_000)

  useEffect(() => () => {
    delete window.__SOLAR_FRAME_PACING__
  }, [])

  return null
}
