'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  QUALITY_RANK,
  type AutoQualityStatus,
  type EffectiveQuality,
  type FramePacingMode,
  usePerformanceStore,
} from './performance-store'
import {
  getSceneWorkloadSnapshot,
  type SceneWorkloadSystem,
} from './scene-workload-policy'
import {
  SCENE_LOAD_STAGES,
  useSceneLoadStage,
} from './SceneLoadScheduler'
import { useSolarSystemStore } from './store'

const AUTO_MEASUREMENT_WINDOW_SECONDS = 1.5
const AUTO_DOWNGRADE_COOLDOWN_SECONDS = 7
const AUTO_PROMOTION_COOLDOWN_SECONDS = 12

interface AutoThresholds {
  slowFps: number
  severeFps: number
  slowP95Ms: number
  promotionFps: number | null
  promotionP95Ms: number | null
  promotionWindows: number
}

/**
 * Thresholds follow the paced targets rather than assuming every profile is
 * trying to render at 60 FPS. Eco can prove a stable 30 FPS path, Balanced can
 * earn Ultra near its 45 FPS active cap, and Ultra may idle safely around 45.
 */
const AUTO_THRESHOLDS: Record<EffectiveQuality, AutoThresholds> = {
  eco: {
    slowFps: 0,
    severeFps: 0,
    slowP95Ms: Number.POSITIVE_INFINITY,
    promotionFps: 27,
    promotionP95Ms: 46,
    promotionWindows: 5,
  },
  balanced: {
    slowFps: 23,
    severeFps: 16,
    slowP95Ms: 72,
    promotionFps: 40,
    promotionP95Ms: 36,
    promotionWindows: 8,
  },
  ultra: {
    slowFps: 34,
    severeFps: 24,
    slowP95Ms: 52,
    promotionFps: null,
    promotionP95Ms: null,
    promotionWindows: 0,
  },
}

export interface SolarPerformancePolicyDiagnostics {
  preset: 'auto' | EffectiveQuality
  effectiveQuality: EffectiveQuality
  autoBaseline: EffectiveQuality
  autoCeiling: EffectiveQuality
  autoStatus: AutoQualityStatus
  autoReason: string
  frameMode: FramePacingMode
  frameTargetFps: number
  schedulerStage: number
  schedulerComplete: boolean
  averageFps: number | null
  p95FrameMs: number | null
  requestedSystems: SceneWorkloadSystem[]
  activeSystems: SceneWorkloadSystem[]
  suppressedSystems: SceneWorkloadSystem[]
}

declare global {
  interface Window {
    __SOLAR_PERFORMANCE_POLICY__?: SolarPerformancePolicyDiagnostics
  }
}

function lowerQuality(quality: EffectiveQuality): EffectiveQuality | null {
  if (quality === 'ultra') return 'balanced'
  if (quality === 'balanced') return 'eco'
  return null
}

function higherQuality(
  quality: EffectiveQuality,
  ceiling: EffectiveQuality
): EffectiveQuality | null {
  const candidate = quality === 'eco'
    ? 'balanced'
    : quality === 'balanced'
      ? 'ultra'
      : null

  if (!candidate || QUALITY_RANK[candidate] > QUALITY_RANK[ceiling]) return null
  return candidate
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

export default function ScenePerformanceManager() {
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const autoCeiling = usePerformanceStore((state) => state.autoCeiling)
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const frameMode = usePerformanceStore((state) => state.frameMode)
  const frameTargetFps = usePerformanceStore((state) => state.frameTargetFps)
  const setAutoDecision = usePerformanceStore((state) => state.setAutoDecision)
  const setFps = usePerformanceStore((state) => state.setFps)
  const sceneLoadStage = useSceneLoadStage()

  const elapsedRef = useRef(0)
  const framesRef = useRef(0)
  const frameTimesRef = useRef<number[]>([])
  const slowSamplesRef = useRef(0)
  const fastSamplesRef = useRef(0)
  const cooldownRef = useRef(0)
  const stageRef = useRef(sceneLoadStage)
  const averageFpsRef = useRef<number | null>(null)
  const p95FrameMsRef = useRef<number | null>(null)

  const publishPolicyDiagnostics = useCallback(() => {
    if (typeof window === 'undefined') return

    const performanceState = usePerformanceStore.getState()
    const effectiveQuality = getEffectiveQuality(performanceState)
    const workload = getSceneWorkloadSnapshot(
      effectiveQuality,
      useSolarSystemStore.getState()
    )

    window.__SOLAR_PERFORMANCE_POLICY__ = {
      preset: performanceState.preset,
      effectiveQuality,
      autoBaseline: performanceState.autoBaseline,
      autoCeiling: performanceState.autoCeiling,
      autoStatus: performanceState.autoStatus,
      autoReason: performanceState.autoReason,
      frameMode: performanceState.frameMode,
      frameTargetFps: performanceState.frameTargetFps,
      schedulerStage: stageRef.current,
      schedulerComplete: stageRef.current >= SCENE_LOAD_STAGES.artifacts,
      averageFps: averageFpsRef.current,
      p95FrameMs: p95FrameMsRef.current,
      requestedSystems: workload.requestedSystems,
      activeSystems: workload.activeSystems,
      suppressedSystems: workload.suppressedSystems,
    }
  }, [])

  useEffect(() => {
    const unsubscribePerformance = usePerformanceStore.subscribe(publishPolicyDiagnostics)
    const unsubscribeScene = useSolarSystemStore.subscribe(publishPolicyDiagnostics)
    publishPolicyDiagnostics()

    return () => {
      unsubscribePerformance()
      unsubscribeScene()
      delete window.__SOLAR_PERFORMANCE_POLICY__
    }
  }, [publishPolicyDiagnostics])

  useEffect(() => {
    stageRef.current = sceneLoadStage
    if (preset === 'auto' && sceneLoadStage < SCENE_LOAD_STAGES.artifacts) {
      setAutoDecision(
        autoQuality,
        'warming',
        'Auto is holding its conservative baseline until measured scene loading completes.'
      )
    }
    publishPolicyDiagnostics()
  }, [autoQuality, preset, publishPolicyDiagnostics, sceneLoadStage, setAutoDecision])

  useEffect(() => {
    elapsedRef.current = 0
    framesRef.current = 0
    frameTimesRef.current = []
    slowSamplesRef.current = 0
    fastSamplesRef.current = 0
    averageFpsRef.current = null
    p95FrameMsRef.current = null
    publishPolicyDiagnostics()
  }, [autoQuality, preset, publishPolicyDiagnostics])

  useEffect(() => {
    cooldownRef.current = 0
  }, [preset])

  useEffect(() => {
    if (!reducedMotion) return

    const scene = useSolarSystemStore.getState()
    scene.setAutoRotate(false)
    scene.setShowTrails(false)
  }, [reducedMotion])

  useFrame((_, delta) => {
    if (frameMode === 'static' || frameMode === 'suspended') {
      elapsedRef.current = 0
      framesRef.current = 0
      frameTimesRef.current = []
      slowSamplesRef.current = 0
      fastSamplesRef.current = 0
      publishPolicyDiagnostics()
      return
    }

    if (!Number.isFinite(delta) || delta <= 0 || delta > 1) return

    elapsedRef.current += delta
    framesRef.current += 1
    frameTimesRef.current.push(Math.min(250, delta * 1_000))
    cooldownRef.current = Math.max(0, cooldownRef.current - delta)

    if (elapsedRef.current < AUTO_MEASUREMENT_WINDOW_SECONDS) return

    const measuredFps = framesRef.current / elapsedRef.current
    const roundedFps = Math.max(1, Math.min(120, Math.round(measuredFps)))
    const p95FrameMs = percentile95(frameTimesRef.current)
    averageFpsRef.current = measuredFps
    p95FrameMsRef.current = p95FrameMs
    setFps(roundedFps)

    elapsedRef.current = 0
    framesRef.current = 0
    frameTimesRef.current = []

    if (preset !== 'auto' || p95FrameMs === null) {
      publishPolicyDiagnostics()
      return
    }

    const thresholds = AUTO_THRESHOLDS[autoQuality]
    const lower = lowerQuality(autoQuality)
    const severeRegression = lower !== null && (
      measuredFps < thresholds.severeFps
      || p95FrameMs > thresholds.slowP95Ms * 1.45
    )
    const slowRegression = lower !== null && (
      measuredFps < thresholds.slowFps
      || p95FrameMs > thresholds.slowP95Ms
    )

    if (slowRegression) {
      slowSamplesRef.current += 1
      fastSamplesRef.current = 0
    } else {
      slowSamplesRef.current = 0
    }

    if (lower && (severeRegression || slowSamplesRef.current >= 2)) {
      setAutoDecision(
        lower,
        'cooldown',
        `Auto reduced detail after ${Math.round(measuredFps)} FPS against a ${frameTargetFps} FPS cap and ${Math.round(p95FrameMs)} ms P95.`
      )
      slowSamplesRef.current = 0
      fastSamplesRef.current = 0
      cooldownRef.current = AUTO_DOWNGRADE_COOLDOWN_SECONDS
      publishPolicyDiagnostics()
      return
    }

    if (cooldownRef.current > 0) {
      setAutoDecision(
        autoQuality,
        'cooldown',
        `Auto is observing the ${QUALITY_PROFILES[autoQuality].label} profile after a recent change.`
      )
      publishPolicyDiagnostics()
      return
    }

    if (stageRef.current < SCENE_LOAD_STAGES.artifacts) {
      fastSamplesRef.current = 0
      setAutoDecision(
        autoQuality,
        'warming',
        'Auto promotion is locked until every measured scene stage has completed.'
      )
      publishPolicyDiagnostics()
      return
    }

    const higher = higherQuality(autoQuality, autoCeiling)
    if (!higher) {
      const limitedByDevice = QUALITY_RANK[autoCeiling] < QUALITY_RANK.ultra
      setAutoDecision(
        autoQuality,
        limitedByDevice ? 'limited' : 'stable',
        limitedByDevice
          ? `Auto is holding ${QUALITY_PROFILES[autoQuality].label} at this device's safe ceiling.`
          : 'Auto has completed its paced benchmark and Ultra remains stable.'
      )
      publishPolicyDiagnostics()
      return
    }

    const promotionHealthy = thresholds.promotionFps !== null
      && thresholds.promotionP95Ms !== null
      && measuredFps >= thresholds.promotionFps
      && p95FrameMs <= thresholds.promotionP95Ms

    if (!promotionHealthy) {
      fastSamplesRef.current = 0
      setAutoDecision(
        autoQuality,
        'stable',
        `Auto is holding ${QUALITY_PROFILES[autoQuality].label}; the ${frameTargetFps} FPS paced window was not stable enough to promote.`
      )
      publishPolicyDiagnostics()
      return
    }

    fastSamplesRef.current += 1
    if (fastSamplesRef.current < thresholds.promotionWindows) {
      setAutoDecision(
        autoQuality,
        'measuring',
        `Promotion sample ${fastSamplesRef.current}/${thresholds.promotionWindows} passed at ${Math.round(measuredFps)} of ${frameTargetFps} FPS.`
      )
      publishPolicyDiagnostics()
      return
    }

    setAutoDecision(
      higher,
      'cooldown',
      `Auto promoted to ${QUALITY_PROFILES[higher].label} after sustained post-warmup paced frame health.`
    )
    fastSamplesRef.current = 0
    slowSamplesRef.current = 0
    cooldownRef.current = AUTO_PROMOTION_COOLDOWN_SECONDS
    publishPolicyDiagnostics()
  })

  return null
}
