'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'

const DEFAULTS_KEY = 'solar-explorer-performance-defaults-v1'
const CAMERA_ACTIVITY_WINDOW_MS = 1800

function lowerQuality(quality: EffectiveQuality): EffectiveQuality {
  if (quality === 'ultra') return 'balanced'
  return 'eco'
}

function higherQuality(quality: EffectiveQuality): EffectiveQuality {
  if (quality === 'eco') return 'balanced'
  return 'ultra'
}

function applyFirstRunDefaults() {
  if (typeof window === 'undefined' || window.localStorage.getItem(DEFAULTS_KEY)) return

  const quality = getEffectiveQuality(usePerformanceStore.getState())
  const scene = useSolarSystemStore.getState()

  if (quality === 'eco') {
    scene.setShowKuiperBelt(false)
    scene.setShowNebula(false)
    scene.setShowTrojans(false)
    scene.setShowBlackHole(false)
    scene.setShowWormhole(false)
    scene.setShowCentaurs(false)
    scene.setShowScatteredDisc(false)
    scene.setShowPhenomena(false)
    scene.setShowSolarWind(false)
    scene.setShowZodiacalLight(false)
  } else if (quality === 'balanced') {
    scene.setShowBlackHole(false)
    scene.setShowWormhole(false)
    scene.setShowScatteredDisc(false)
    scene.setShowZodiacalLight(false)
  }

  window.localStorage.setItem(DEFAULTS_KEY, quality)
}

export default function ScenePerformanceManager() {
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const setAutoQuality = usePerformanceStore((state) => state.setAutoQuality)
  const setFps = usePerformanceStore((state) => state.setFps)

  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const autoRotate = useSolarSystemStore((state) => state.autoRotate)
  const followMode = useSolarSystemStore((state) => state.followMode)
  const isTourMode = useSolarSystemStore((state) => state.isTourMode)
  const cameraMode = useSolarSystemStore((state) => state.cameraMode)
  const focusTarget = useSolarSystemStore((state) => state.focusTarget)
  const cameraPosition = useSolarSystemStore((state) => state.cameraPosition)

  const setFrameloop = useThree((state) => state.setFrameloop)
  const invalidate = useThree((state) => state.invalidate)

  const elapsedRef = useRef(0)
  const framesRef = useRef(0)
  const slowSamplesRef = useRef(0)
  const fastSamplesRef = useRef(0)
  const cooldownRef = useRef(0)
  const activityUntilRef = useRef(0)
  const hiddenRef = useRef(false)

  const needsContinuousFrames =
    !isPaused || autoRotate || followMode || isTourMode || cameraMode === 'fly'

  useEffect(() => {
    applyFirstRunDefaults()
  }, [])

  useEffect(() => {
    if (!reducedMotion) return

    const scene = useSolarSystemStore.getState()
    scene.setAutoRotate(false)
    scene.setShowTrails(false)
  }, [reducedMotion])

  useEffect(() => {
    activityUntilRef.current = performance.now() + CAMERA_ACTIVITY_WINDOW_MS
    invalidate()
  }, [cameraPosition, focusTarget, invalidate])

  useEffect(() => {
    if (hiddenRef.current) return
    setFrameloop(needsContinuousFrames ? 'always' : 'demand')
    invalidate()
  }, [invalidate, needsContinuousFrames, setFrameloop])

  useEffect(() => {
    const handleVisibility = () => {
      hiddenRef.current = document.hidden

      if (document.hidden) {
        setFrameloop('never')
        return
      }

      setFrameloop(needsContinuousFrames ? 'always' : 'demand')
      invalidate()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    handleVisibility()
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [invalidate, needsContinuousFrames, setFrameloop])

  useFrame((_, delta) => {
    if (!needsContinuousFrames) {
      elapsedRef.current = 0
      framesRef.current = 0
      slowSamplesRef.current = 0
      fastSamplesRef.current = 0

      if (performance.now() < activityUntilRef.current) {
        invalidate()
      }
      return
    }

    if (!Number.isFinite(delta) || delta <= 0 || delta > 1) return

    elapsedRef.current += delta
    framesRef.current += 1
    cooldownRef.current = Math.max(0, cooldownRef.current - delta)

    if (elapsedRef.current < 2) return

    const measuredFps = framesRef.current / elapsedRef.current
    const roundedFps = Math.max(1, Math.min(120, Math.round(measuredFps)))
    setFps(roundedFps)

    elapsedRef.current = 0
    framesRef.current = 0

    if (preset !== 'auto' || cooldownRef.current > 0) return

    const slowThreshold = autoQuality === 'ultra' ? 46 : 36
    const fastThreshold = autoQuality === 'eco' ? 56 : 58

    if (measuredFps < slowThreshold) {
      slowSamplesRef.current += 1
      fastSamplesRef.current = 0
    } else if (measuredFps > fastThreshold) {
      fastSamplesRef.current += 1
      slowSamplesRef.current = 0
    } else {
      slowSamplesRef.current = 0
      fastSamplesRef.current = 0
    }

    if (slowSamplesRef.current >= 2 && autoQuality !== 'eco') {
      setAutoQuality(lowerQuality(autoQuality))
      slowSamplesRef.current = 0
      cooldownRef.current = 8
      return
    }

    if (fastSamplesRef.current >= 5 && autoQuality !== 'ultra') {
      setAutoQuality(higherQuality(autoQuality))
      fastSamplesRef.current = 0
      cooldownRef.current = 12
    }
  })

  return null
}
