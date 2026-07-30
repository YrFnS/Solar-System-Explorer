'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { getEffectiveQuality, usePerformanceStore } from './performance-store'
import { useSolarSystemStore } from './store'

const DEFAULTS_KEY = 'solar-explorer-performance-defaults-v1'
const SESSION_WARMUP_KEY = 'solar-explorer-scene-warmup-v1'

interface WarmupPreferences {
  showAsteroidBelt: boolean
  showKuiperBelt: boolean
  showNebula: boolean
  showGravityWells: boolean
  showHeliosphere: boolean
  showTrojans: boolean
  showBlackHole: boolean
  showWormhole: boolean
  showCentaurs: boolean
  showScatteredDisc: boolean
  showPhenomena: boolean
  showSolarWind: boolean
  showZodiacalLight: boolean
}

export interface SceneWarmupPlan {
  desired: WarmupPreferences
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

function readPreferences(): WarmupPreferences {
  const scene = useSolarSystemStore.getState()
  return {
    showAsteroidBelt: scene.showAsteroidBelt,
    showKuiperBelt: scene.showKuiperBelt,
    showNebula: scene.showNebula,
    showGravityWells: scene.showGravityWells,
    showHeliosphere: scene.showHeliosphere,
    showTrojans: scene.showTrojans,
    showBlackHole: scene.showBlackHole,
    showWormhole: scene.showWormhole,
    showCentaurs: scene.showCentaurs,
    showScatteredDisc: scene.showScatteredDisc,
    showPhenomena: scene.showPhenomena,
    showSolarWind: scene.showSolarWind,
    showZodiacalLight: scene.showZodiacalLight,
  }
}

/**
 * Called before the heavy scene mounts. Optional systems are disabled for the
 * first render and restored over several browser frames by ProgressiveSceneWarmup.
 */
export function prepareSceneWarmup(): SceneWarmupPlan | null {
  if (typeof window === 'undefined') return null

  try {
    if (window.sessionStorage.getItem(SESSION_WARMUP_KEY)) return null
  } catch {
    // Storage can be unavailable in privacy modes; the warmup is still safe.
  }

  applyFirstRunDefaults()

  const desired = readPreferences()
  const scene = useSolarSystemStore.getState()

  scene.setShowAsteroidBelt(false)
  scene.setShowKuiperBelt(false)
  scene.setShowNebula(false)
  scene.setShowGravityWells(false)
  scene.setShowHeliosphere(false)
  scene.setShowTrojans(false)
  scene.setShowBlackHole(false)
  scene.setShowWormhole(false)
  scene.setShowCentaurs(false)
  scene.setShowScatteredDisc(false)
  scene.setShowPhenomena(false)
  scene.setShowSolarWind(false)
  scene.setShowZodiacalLight(false)

  return { desired }
}

function restoreNearScene(plan: SceneWarmupPlan) {
  const scene = useSolarSystemStore.getState()
  scene.setShowAsteroidBelt(plan.desired.showAsteroidBelt)
  scene.setShowNebula(plan.desired.showNebula)
}

function restoreEffects(plan: SceneWarmupPlan) {
  const scene = useSolarSystemStore.getState()
  scene.setShowPhenomena(plan.desired.showPhenomena)
  scene.setShowSolarWind(plan.desired.showSolarWind)
  scene.setShowZodiacalLight(plan.desired.showZodiacalLight)
  scene.setShowGravityWells(plan.desired.showGravityWells)
}

function restoreOuterScene(plan: SceneWarmupPlan) {
  const scene = useSolarSystemStore.getState()
  scene.setShowKuiperBelt(plan.desired.showKuiperBelt)
  scene.setShowTrojans(plan.desired.showTrojans)
  scene.setShowCentaurs(plan.desired.showCentaurs)
  scene.setShowScatteredDisc(plan.desired.showScatteredDisc)
  scene.setShowHeliosphere(plan.desired.showHeliosphere)
}

function restoreExoticScene(plan: SceneWarmupPlan) {
  const scene = useSolarSystemStore.getState()
  scene.setShowBlackHole(plan.desired.showBlackHole)
  scene.setShowWormhole(plan.desired.showWormhole)
}

export default function ProgressiveSceneWarmup({ plan }: { plan: SceneWarmupPlan | null }) {
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    if (!plan) return

    const timers = [
      window.setTimeout(() => {
        restoreNearScene(plan)
        invalidate()
      }, 70),
      window.setTimeout(() => {
        restoreEffects(plan)
        invalidate()
      }, 190),
      window.setTimeout(() => {
        restoreOuterScene(plan)
        invalidate()
      }, 360),
      window.setTimeout(() => {
        restoreExoticScene(plan)
        try {
          window.sessionStorage.setItem(SESSION_WARMUP_KEY, 'complete')
        } catch {
          // Ignore unavailable session storage.
        }
        invalidate()
      }, 560),
    ]

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [invalidate, plan])

  return null
}
