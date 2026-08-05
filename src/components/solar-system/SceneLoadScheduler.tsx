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
  warmRebuild: boolean
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

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
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
const DIAGNOSTIC_INTERVAL_MS = 250
const IDLE_TIMEOUT_MS = 1_200
const WARM_IDLE_TIMEOUT_MS = 500
const WARM_MAX_DEFERRAL_MS = 1_200
const WARM_INTERACTION_QUIET_MS = 350
const WARM_SAMPLE_SCALE = 0.6
const SETTLED_SESSION_KEY = 'solar-explorer-scene-settled-v1'

const PHASE_BY_STAGE: Record<SceneLoadStage, SceneLoadPhase> = {
  [SCENE_LOAD_STAGES.core]: 'core',
  [SCENE_LOAD_STAGES.background]: 'background',
  [SCENE_LOAD_STAGES.phenomena]: 'phenomena',
  [SCENE_LOAD_STAGES.smallBodies]: 'small-bodies',
  [SCENE_LOAD_STAGES.outerFields]: 'outer-fields',
  [SCENE_LOAD_STAGES.sandbox]: 'sandbox',
  [SCENE_LOAD_STAGES.artifacts]: 'artifacts',
}

const BASE_SAMPLES: Record<SceneLoadStage, number> = {
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

function getPolicy(
  quality: EffectiveQuality,
  nextStage: SceneLoadStage,
  warmRebuild: boolean
): LoadPolicy {
  const health = HEALTH_LIMITS[quality]
  const sampleScale = warmRebuild ? WARM_SAMPLE_SCALE : 1

  return {
    maxAverageFrameMs: health.maxAverageFrameMs,
    maxP95FrameMs: health.maxP95FrameMs,
    maxDeferralMs: warmRebuild
      ? Math.min(health.maxDeferralMs, WARM_MAX_DEFERRAL_MS)
      : health.maxDeferralMs,
    interactionQuietMs: warmRebuild
      ? Math.min(health.interactionQuietMs, WARM_INTERACTION_QUIET_MS)
      : health.interactionQuietMs,
    requiredSamples: Math.max(
      6,
      Math.ceil(
        BASE_SAMPLES[nextStage]
        * SAMPLE_MULTIPLIER[quality]
        * sampleScale
      )
    ),
  }
}

function summarize(samples: number[]) {
  if (samples.length === 0) {
    return { averageFrameMs: null, p95FrameMs: null }
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
 * Admits optional scene groups one at a time. Each transition requires fresh
 * rendered frames, a quiet interaction window, acceptable frame health, and a
 * browser-idle callback. A bounded deadline prevents permanently missing scene
 * features on unusually slow but functional devices. After one complete load,
 * renderer-only rebuilds retain the same safeguards with shorter cached-work
 * deadlines instead of replaying the cold-start wait.
 */
export default function SceneLoadScheduler({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<SceneLoadStage>(SCENE_LOAD_STAGES.core)
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const quality = getEffectiveQuality({ preset, autoQuality })
  const invalidate = useThree((state) => state.invalidate)

  const runIdRef = useRef(0)
  const mountedAtRef = useRef(0)
  const mountedRef = useRef(false)
  const warmRebuildRef = useRef(false)
  const stageRef = useRef<SceneLoadStage>(SCENE_LOAD_STAGES.core)
  const qualityRef = useRef<EffectiveQuality>(quality)
  const stageStartedAtRef = useRef(0)
  const firstFrameMsRef = useRef<number | null>(null)
  const samplesRef = useRef<number[]>([])
  const transitionsRef = useRef<SceneLoadTransition[]>([])
  const lastInteractionAtRef = useRef(Number.NEGATIVE_INFINITY)
  const lastPublishAtRef = useRef(Number.NEGATIVE_INFINITY)
  const transitionPendingRef = useRef(false)
  const idleHandleRef = useRef<number | null>(null)

  const publish = useCallback((
    waitingFor: SceneLoadWaitReason,
    averageFrameMs: number | null = null,
    p95FrameMs: number | null = null
  ) => {
    if (typeof window === 'undefined') return

    const currentStage = stageRef.current
    window.__SOLAR_SCENE_LOADING__ = {
      runId: runIdRef.current,
      stage: currentStage,
      phase: PHASE_BY_STAGE[currentStage],
      complete: currentStage >= FINAL_STAGE,
      quality: qualityRef.current,
      warmRebuild: warmRebuildRef.current,
      waitingFor,
      firstFrameMs: firstFrameMsRef.current,
      averageFrameMs,
      p95FrameMs,
      sampleCount: samplesRef.current.length,
      transitions: [...transitionsRef.current],
    }
    lastPublishAtRef.current = performance.now()
  }, [])

  const requestTransition = useCallback((
    nextStage: SceneLoadStage,
    reason: SceneLoadTransitionReason,
    sampleCount: number,
    averageFrameMs: number,
    p95FrameMs: number
  ) => {
    if (transitionPendingRef.current || nextStage > FINAL_STAGE) return

    transitionPendingRef.current = true
    publish('browser-idle', averageFrameMs, p95FrameMs)

    const commit = () => {
      idleHandleRef.current = null

      if (!mountedRef.current || document.hidden) {
        transitionPendingRef.current = false
        return
      }

      const policy = getPolicy(
        qualityRef.current,
        nextStage,
        warmRebuildRef.current
      )
      if (performance.now() - lastInteractionAtRef.current < policy.interactionQuietMs) {
        transitionPendingRef.current = false
        publish('interaction-idle', averageFrameMs, p95FrameMs)
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
      samplesRef.current = []
      transitionPendingRef.current = false
      setStage(nextStage)

      if (nextStage >= FINAL_STAGE) {
        warmRebuildRef.current = true
        try {
          window.sessionStorage.setItem(SETTLED_SESSION_KEY, 'complete')
        } catch {
          // Session storage is an optimization hint, not a runtime dependency.
        }
      }

      publish(nextStage >= FINAL_STAGE ? 'complete' : 'frame-samples')
      invalidate()
    }

    const idleWindow = window as IdleWindow
    if (idleWindow.requestIdleCallback) {
      idleHandleRef.current = idleWindow.requestIdleCallback(commit, {
        timeout: warmRebuildRef.current
          ? WARM_IDLE_TIMEOUT_MS
          : IDLE_TIMEOUT_MS,
      })
    } else {
      queueMicrotask(commit)
    }
  }, [invalidate, publish])

  useEffect(() => {
    const now = performance.now()
    try {
      warmRebuildRef.current = window.sessionStorage.getItem(SETTLED_SESSION_KEY)
        === 'complete'
    } catch {
      warmRebuildRef.current = false
    }
    runIdRef.current = performance.timeOrigin + now
    mountedAtRef.current = now
    stageStartedAtRef.current = now
    mountedRef.current = true
    publish('first-frame')

    return () => {
      mountedRef.current = false
      const idleWindow = window as IdleWindow
      if (idleHandleRef.current !== null) {
        idleWindow.cancelIdleCallback?.(idleHandleRef.current)
      }
      if (window.__SOLAR_SCENE_LOADING__?.runId === runIdRef.current) {
        delete window.__SOLAR_SCENE_LOADING__
      }
    }
  }, [publish])

  useEffect(() => {
    qualityRef.current = quality
    samplesRef.current = []
    stageStartedAtRef.current = performance.now()
    publish(stageRef.current >= FINAL_STAGE ? 'complete' : 'frame-samples')
    invalidate()
  }, [invalidate, publish, quality])

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = performance.now()
      if (stageRef.current < FINAL_STAGE) publish('interaction-idle')
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
  }, [publish])

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

    const samples = samplesRef.current
    samples.push(Math.min(250, delta * 1_000))
    if (samples.length > FRAME_WINDOW_SIZE) samples.shift()

    const nextStage = (stageRef.current + 1) as SceneLoadStage
    const policy = getPolicy(
      qualityRef.current,
      nextStage,
      warmRebuildRef.current
    )
    const { averageFrameMs, p95FrameMs } = summarize(samples)

    if (samples.length < policy.requiredSamples) {
      if (now - lastPublishAtRef.current >= DIAGNOSTIC_INTERVAL_MS) {
        publish('frame-samples', averageFrameMs, p95FrameMs)
      }
      return
    }

    if (now - lastInteractionAtRef.current < policy.interactionQuietMs) {
      if (now - lastPublishAtRef.current >= DIAGNOSTIC_INTERVAL_MS) {
        publish('interaction-idle', averageFrameMs, p95FrameMs)
      }
      return
    }

    if (averageFrameMs === null || p95FrameMs === null) return

    const healthy = averageFrameMs <= policy.maxAverageFrameMs
      && p95FrameMs <= policy.maxP95FrameMs
    const deadlineReached = now - stageStartedAtRef.current >= policy.maxDeferralMs

    if (!healthy && !deadlineReached) {
      if (now - lastPublishAtRef.current >= DIAGNOSTIC_INTERVAL_MS) {
        publish('frame-health', averageFrameMs, p95FrameMs)
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
