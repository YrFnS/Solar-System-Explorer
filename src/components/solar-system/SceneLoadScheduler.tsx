'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'

export const SCENE_LOAD_STAGES = {
  core: 0,
  background: 1,
  phenomena: 2,
  smallBodies: 3,
  outerFields: 4,
  sandbox: 5,
  artifacts: 6,
} as const

export type SceneLoadStage =
  (typeof SCENE_LOAD_STAGES)[keyof typeof SCENE_LOAD_STAGES]

type SceneLoadPhase =
  | 'core'
  | 'background'
  | 'phenomena'
  | 'small-bodies'
  | 'outer-fields'
  | 'sandbox'
  | 'artifacts'

type SceneLoadWaitReason =
  | 'first-frame'
  | 'frame-samples'
  | 'interaction-idle'
  | 'frame-health'
  | 'browser-idle'
  | 'complete'

type SceneLoadTransitionReason = 'frame-health' | 'deferred-deadline'

interface SceneLoadTransition {
  stage: SceneLoadStage
  phase: SceneLoadPhase
  reason: SceneLoadTransitionReason
  atMs: number
  sampleCount: number
  averageFrameMs: number
  p95FrameMs: number
}

export interface SceneLoadDiagnostics {
  runId: number
  stage: SceneLoadStage
  phase: SceneLoadPhase
  complete: boolean
  quality: EffectiveQuality
  waitingFor: SceneLoadWaitReason
  firstFrameMs: number | null
  averageFrameMs: number | null
  p95FrameMs: number | null
  sampleCount: number
  transitions: SceneLoadTransition[]
}

declare global {
  interface Window {
    __SOLAR_SCENE_LOADING__?: SceneLoadDiagnostics
  }
}

interface IdleDeadlineLike {
  didTimeout: boolean
  timeRemaining: () => number
}

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: { timeout: number }
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

interface LoadPolicy {
  requiredSamples: number
  maxAverageFrameMs: number
  maxP95FrameMs: number
  maxDeferralMs: number
  interactionQuietMs: number
}

const FINAL_STAGE = SCENE_LOAD_STAGES.artifacts
const FRAME_WINDOW_SIZE = 48
const DIAGNOSTIC_PUBLISH_INTERVAL_MS = 250
const IDLE_CALLBACK_TIMEOUT_MS = 1_200

const PHASE_BY_STAGE: Record<SceneLoadStage, SceneLoadPhase> = {
  [SCENE_LOAD_STAGES.core]: 'core',
  [SCENE_LOAD_STAGES.background]: 'background',
  [SCENE_LOAD_STAGES.phenomena]: 'phenomena',
  [SCENE_LOAD_STAGES.smallBodies]: 'small-bodies',
  [SCENE_LOAD_STAGES.outerFields]: 'outer-fields',
  [SCENE_LOAD_STAGES.sandbox]: 'sandbox',
  [SCENE_LOAD_STAGES.artifacts]: 'artifacts',
}

const BASE_SAMPLES_BY_STAGE: Record<SceneLoadStage, number> = {
  [SCENE_LOAD_STAGES.core]: 0,
  [SCENE_LOAD_STAGES.background]: 8,
  [SCENE_LOAD_STAGES.phenomena]: 10,
  [SCENE_LOAD_STAGES.smallBodies]: 12,
  [SCENE_LOAD_STAGES.outerFields]: 16,
  [SCENE_LOAD_STAGES.sandbox]: 10,
  [SCENE_LOAD_STAGES.artifacts]: 10,
}

const SAMPLE_MULTIPLIER: Record<EffectiveQuality, number> = {
  eco: 1.25,
  balanced: 1,
  ultra: 0.85,
}

const HEALTH_LIMITS: Record<
  EffectiveQuality,
  Omit<LoadPolicy, 'requiredSamples'>
> = {
  eco: {
    maxAverageFrameMs: 58,
    maxP95FrameMs: 110,
    maxDeferralMs: 7_000,
    interactionQuietMs: 800,
  },
  balanced: {
    maxAverageFrameMs: 42,
    maxP95FrameMs: 80,
    maxDeferralMs: 5_500,
    interactionQuietMs: 700,
  },
  ultra: {
    maxAverageFrameMs: 32,
    maxP95FrameMs: 62,
    maxDeferralMs: 4_500,
    interactionQuietMs: 600,
  },
}

const SceneLoadStageContext = createContext<SceneLoadStage>(SCENE_LOAD_STAGES.core)
let nextRunId = 1

function getLoadPolicy(
  quality: EffectiveQuality,
  nextStage: SceneLoadStage
): LoadPolicy {
  return {
    ...HEALTH_LIMITS[quality],
    requiredSamples: Math.max(
      6,
      Math.ceil(BASE_SAMPLES_BY_STAGE[nextStage] * SAMPLE_MULTIPLIER[quality])
    ),
  }
}

function summarizeFrameWindow(samples: number[]) {
  if (samples.length === 0) {
    return {
      averageFrameMs: null,
      p95FrameMs: null,
    }
  }

  const averageFrameMs = samples.reduce((total, sample) => total + sample, 0)
    / samples.length
  const sorted = [...samples].sort((left, right) => left - right)
  const p95Index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  )

  return {
    averageFrameMs,
    p95FrameMs: sorted[p95Index],
  }
}

export function useSceneLoadStage() {
  return useContext(SceneLoadStageContext)
}

/**
 * Advances optional scene groups from one measured stage to the next. Every
 * transition requires fresh rendered frames, a quiet interaction window, and
 * browser idle time. Poor frame health defers the next group rather than
 * allowing independent timers to mount several expensive systems together.
 */
export default function SceneLoadScheduler({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<SceneLoadStage>(SCENE_LOAD_STAGES.core)
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const quality = getEffectiveQuality({ preset, autoQuality })
  const invalidate = useThree((state) => state.invalidate)

  const runIdRef = useRef<number | null>(null)
  if (runIdRef.current === null) {
    runIdRef.current = nextRunId
    nextRunId += 1
  }
  const runId = runIdRef.current

  const mountedAtRef = useRef(performance.now())
  const mountedRef = useRef(false)
  const stageRef = useRef<SceneLoadStage>(SCENE_LOAD_STAGES.core)
  const qualityRef = useRef<EffectiveQuality>(quality)
  const stageStartedAtRef = useRef(mountedAtRef.current)
  const firstFrameMsRef = useRef<number | null>(null)
  const frameSamplesRef = useRef<number[]>([])
  const transitionsRef = useRef<SceneLoadTransition[]>([])
  const lastInteractionAtRef = useRef(Number.NEGATIVE_INFINITY)
  const lastDiagnosticPublishAtRef = useRef(Number.NEGATIVE_INFINITY)
  const transitionPendingRef = useRef(false)
  const idleHandleRef = useRef<number | null>(null)

  const publishDiagnostics = useCallback((
    waitingFor: SceneLoadWaitReason,
    averageFrameMs: number | null = null,
    p95FrameMs: number | null = null
  ) => {
    if (typeof window === 'undefined') return

    const currentStage = stageRef.current
    window.__SOLAR_SCENE_LOADING__ = {
      runId,
      stage: currentStage,
      phase: PHASE_BY_STAGE[currentStage],
      complete: currentStage >= FINAL_STAGE,
      quality: qualityRef.current,
      waitingFor,
      firstFrameMs: firstFrameMsRef.current,
      averageFrameMs,
      p95FrameMs,
      sampleCount: frameSamplesRef.current.length,
      transitions: [...transitionsRef.current],
    }
    lastDiagnosticPublishAtRef.current = performance.now()
  }, [runId])

  const requestTransition = useCallback((
    nextStage: SceneLoadStage,
    reason: SceneLoadTransitionReason,
    sampleCount: number,
    averageFrameMs: number,
    p95FrameMs: number
  ) => {
    if (transitionPendingRef.current || nextStage > FINAL_STAGE) return

    transitionPendingRef.current = true
    publishDiagnostics('browser-idle', averageFrameMs, p95FrameMs)

    const commit = () => {
      idleHandleRef.current = null

      if (!mountedRef.current || document.hidden) {
        transitionPendingRef.current = false
        return
      }

      const policy = getLoadPolicy(qualityRef.current, nextStage)
      if (performance.now() - lastInteractionAtRef.current < policy.interactionQuietMs) {
        transitionPendingRef.current = false
        publishDiagnostics('interaction-idle', averageFrameMs, p95FrameMs)
        return
      }

      const now = performance.now()
      transitionsRef.current.push({
        stage: nextStage,
        phase: PHASE_BY_STAGE[nextStage],
        reason,
        atMs: now - mountedAtRef.current,
        sampleCount,
        averageFrameMs,
        p95FrameMs,
      })
      stageRef.current = nextStage
      stageStartedAtRef.current = now
      frameSamplesRef.current = []
      transitionPendingRef.current = false
      setStage(nextStage)
      publishDiagnostics(nextStage >= FINAL_STAGE ? 'complete' : 'frame-samples')
      invalidate()
    }

    const idleWindow = window as IdleWindow
    if (idleWindow.requestIdleCallback) {
      idleHandleRef.current = idleWindow.requestIdleCallback(
        () => commit(),
        { timeout: IDLE_CALLBACK_TIMEOUT_MS }
      )
      return
    }

    queueMicrotask(commit)
  }, [invalidate, publishDiagnostics])

  useEffect(() => {
    mountedRef.current = true
    publishDiagnostics('first-frame')

    return () => {
      mountedRef.current = false
      const idleWindow = window as IdleWindow
      if (idleHandleRef.current !== null) {
        idleWindow.cancelIdleCallback?.(idleHandleRef.current)
      }
      if (window.__SOLAR_SCENE_LOADING__?.runId === runId) {
        delete window.__SOLAR_SCENE_LOADING__
      }
    }
  }, [publishDiagnostics, runId])

  useEffect(() => {
    qualityRef.current = quality
    frameSamplesRef.current = []
    stageStartedAtRef.current = performance.now()
    publishDiagnostics(stageRef.current >= FINAL_STAGE ? 'complete' : 'frame-samples')
    invalidate()
  }, [invalidate, publishDiagnostics, quality])

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = performance.now()
      if (stageRef.current < FINAL_STAGE) {
        publishDiagnostics('interaction-idle')
      }
    }
    const markPointerMove = (event: PointerEvent) => {
      if (event.buttons > 0) markInteraction()
    }

    window.addEventListener('pointerdown', markInteraction, { passive: true })
    window.addEventListener('pointermove', markPointerMove, { passive: true })
    window.addEventListener('wheel', markInteraction, { passive: true })
    window.addEventListener('touchstart', markInteraction, { passive: true })
    window.addEventListener('keydown', markInteraction)

    return () => {
      window.removeEventListener('pointerdown', markInteraction)
      window.removeEventListener('pointermove', markPointerMove)
      window.removeEventListener('wheel', markInteraction)
      window.removeEventListener('touchstart', markInteraction)
      window.removeEventListener('keydown', markInteraction)
    }
  }, [publishDiagnostics])

  useEffect(() => {
    if (stage >= FINAL_STAGE) return

    let animationFrame = 0
    const keepSampling = () => {
      if (!document.hidden) invalidate()
      animationFrame = window.requestAnimationFrame(keepSampling)
    }
    animationFrame = window.requestAnimationFrame(keepSampling)

    return () => window.cancelAnimationFrame(animationFrame)
  }, [invalidate, stage])

  useFrame((_, delta) => {
    if (stageRef.current >= FINAL_STAGE || transitionPendingRef.current || document.hidden) {
      return
    }
    if (!Number.isFinite(delta) || delta <= 0 || delta > 1) return

    const now = performance.now()
    if (firstFrameMsRef.current === null) {
      firstFrameMsRef.current = now - mountedAtRef.current
    }

    const samples = frameSamplesRef.current
    samples.push(Math.min(250, delta * 1_000))
    if (samples.length > FRAME_WINDOW_SIZE) samples.shift()

    const nextStage = (stageRef.current + 1) as SceneLoadStage
    const policy = getLoadPolicy(qualityRef.current, nextStage)
    const { averageFrameMs, p95FrameMs } = summarizeFrameWindow(samples)

    if (samples.length < policy.requiredSamples) {
      if (now - lastDiagnosticPublishAtRef.current >= DIAGNOSTIC_PUBLISH_INTERVAL_MS) {
        publishDiagnostics('frame-samples', averageFrameMs, p95FrameMs)
      }
      return
    }

    if (now - lastInteractionAtRef.current < policy.interactionQuietMs) {
      if (now - lastDiagnosticPublishAtRef.current >= DIAGNOSTIC_PUBLISH_INTERVAL_MS) {
        publishDiagnostics('interaction-idle', averageFrameMs, p95FrameMs)
      }
      return
    }

    if (averageFrameMs === null || p95FrameMs === null) return

    const healthy = averageFrameMs <= policy.maxAverageFrameMs
      && p95FrameMs <= policy.maxP95FrameMs
    const deadlineReached = now - stageStartedAtRef.current >= policy.maxDeferralMs

    if (!healthy && !deadlineReached) {
      if (now - lastDiagnosticPublishAtRef.current >= DIAGNOSTIC_PUBLISH_INTERVAL_MS) {
        publishDiagnostics('frame-health', averageFrameMs, p95FrameMs)
      }
      return
    }

    requestTransition(
      nextStage,
      healthy ? 'frame-health' : 'deferred-deadline',
      samples.length,
      averageFrameMs,
      p95FrameMs
    )
  })

  return (
    <SceneLoadStageContext.Provider value={stage}>
      {children}
    </SceneLoadStageContext.Provider>
  )
}
