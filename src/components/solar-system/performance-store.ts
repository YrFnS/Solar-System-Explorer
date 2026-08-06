'use client'

import { create } from 'zustand'

export type QualityPreset = 'auto' | 'eco' | 'balanced' | 'ultra'
export type EffectiveQuality = Exclude<QualityPreset, 'auto'>
export type AutoQualityStatus =
  | 'manual'
  | 'warming'
  | 'measuring'
  | 'stable'
  | 'limited'
  | 'cooldown'
export type FramePacingMode = 'active' | 'idle' | 'static' | 'suspended'
export type RendererPowerPreference = 'low-power' | 'high-performance'

export interface QualityProfile {
  label: string
  description: string
  dpr: [number, number]
  instanceDensity: number
  frameBudget: number
}

export interface AutoDevicePolicy {
  baseline: EffectiveQuality
  ceiling: EffectiveQuality
  reason: string
}

export const QUALITY_RANK: Record<EffectiveQuality, number> = {
  eco: 0,
  balanced: 1,
  ultra: 2,
}

export const QUALITY_PROFILES: Record<EffectiveQuality, QualityProfile> = {
  eco: {
    label: 'Eco',
    description: 'Cooler, quieter rendering for phones and integrated graphics.',
    dpr: [0.65, 1],
    instanceDensity: 0.14,
    frameBudget: 34,
  },
  balanced: {
    label: 'Balanced',
    description: 'A strong mix of detail, smooth motion, and battery life.',
    dpr: [0.8, 1.35],
    instanceDensity: 0.34,
    frameBudget: 48,
  },
  ultra: {
    label: 'Ultra',
    description: 'Maximum detail for powerful desktop GPUs.',
    dpr: [1, 2],
    instanceDensity: 0.72,
    frameBudget: 58,
  },
}

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number
  connection?: {
    saveData?: boolean
    effectiveType?: string
  }
}

interface PerformanceState {
  preset: QualityPreset
  autoQuality: EffectiveQuality
  autoBaseline: EffectiveQuality
  autoCeiling: EffectiveQuality
  autoStatus: AutoQualityStatus
  autoReason: string
  fps: number
  frameMode: FramePacingMode
  frameTargetFps: number
  rendererPowerPreference: RendererPowerPreference
  reducedMotion: boolean
  setPreset: (preset: QualityPreset) => void
  setAutoDecision: (
    quality: EffectiveQuality,
    status: AutoQualityStatus,
    reason: string
  ) => void
  setFps: (fps: number) => void
  setFramePacingStatus: (
    mode: FramePacingMode,
    targetFps: number,
    rendererPowerPreference: RendererPowerPreference
  ) => void
  setReducedMotion: (reduced: boolean) => void
}

const PRESET_KEY = 'solar-explorer-quality-preset-v1'
const MOTION_KEY = 'solar-explorer-reduced-motion-v1'

function readStoredPreset(): QualityPreset {
  if (typeof window === 'undefined') return 'auto'

  const value = window.localStorage.getItem(PRESET_KEY)
  return value === 'auto' || value === 'eco' || value === 'balanced' || value === 'ultra'
    ? value
    : 'auto'
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false

  const stored = window.localStorage.getItem(MOTION_KEY)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Auto never begins in Ultra. Phones and constrained devices start in Eco;
 * ordinary desktop-class sessions start in Balanced and may earn Ultra only
 * after the complete scene has demonstrated sustained frame health.
 */
export function detectAutoDevicePolicy(): AutoDevicePolicy {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      baseline: 'balanced',
      ceiling: 'balanced',
      reason: 'Server baseline uses Balanced until client capability is available.',
    }
  }

  const nav = navigator as NavigatorWithHints
  const memory = nav.deviceMemory ?? 8
  const cores = nav.hardwareConcurrency || 8
  const narrowViewport = window.innerWidth < 820
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const saveData = Boolean(nav.connection?.saveData)
  const slowConnection = nav.connection?.effectiveType === '2g'
    || nav.connection?.effectiveType === 'slow-2g'

  if (saveData || slowConnection || memory <= 2 || cores <= 2) {
    return {
      baseline: 'eco',
      ceiling: 'eco',
      reason: 'Data saving, a slow connection, or very limited hardware keeps Auto in Eco.',
    }
  }

  if (memory <= 4 || cores <= 4 || (narrowViewport && coarsePointer)) {
    return {
      baseline: 'eco',
      ceiling: 'balanced',
      reason: 'Mobile or modest hardware starts in Eco and may promote after a stable benchmark.',
    }
  }

  return {
    baseline: 'balanced',
    ceiling: 'ultra',
    reason: 'Desktop-class hints start in Balanced; Ultra requires sustained measured performance.',
  }
}

export function getEffectiveQuality(
  state: Pick<PerformanceState, 'preset' | 'autoQuality'>
): EffectiveQuality {
  return state.preset === 'auto' ? state.autoQuality : state.preset
}

export function getQualityProfile(
  state: Pick<PerformanceState, 'preset' | 'autoQuality'>
): QualityProfile {
  return QUALITY_PROFILES[getEffectiveQuality(state)]
}

export function isQualityAtLeast(
  quality: EffectiveQuality,
  minimum: EffectiveQuality
) {
  return QUALITY_RANK[quality] >= QUALITY_RANK[minimum]
}

function initialFrameTarget(quality: EffectiveQuality) {
  if (quality === 'eco') return 30
  if (quality === 'balanced') return 45
  return 60
}

const initialPreset = readStoredPreset()
const initialAutoPolicy = detectAutoDevicePolicy()
const initialQuality = initialPreset === 'auto'
  ? initialAutoPolicy.baseline
  : initialPreset

export const usePerformanceStore = create<PerformanceState>((set) => ({
  preset: initialPreset,
  autoQuality: initialAutoPolicy.baseline,
  autoBaseline: initialAutoPolicy.baseline,
  autoCeiling: initialAutoPolicy.ceiling,
  autoStatus: initialPreset === 'auto' ? 'warming' : 'manual',
  autoReason: initialPreset === 'auto'
    ? initialAutoPolicy.reason
    : `${QUALITY_PROFILES[initialPreset].label} was selected manually.`,
  fps: initialFrameTarget(initialQuality),
  frameMode: 'active',
  frameTargetFps: initialFrameTarget(initialQuality),
  rendererPowerPreference: initialQuality === 'ultra'
    ? 'high-performance'
    : 'low-power',
  reducedMotion: readReducedMotion(),

  setPreset: (preset) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PRESET_KEY, preset)
    }

    set((state) => {
      if (preset === 'auto') {
        return {
          preset,
          autoQuality: state.autoBaseline,
          autoStatus: 'warming',
          autoReason: `Auto restarted from the conservative ${QUALITY_PROFILES[state.autoBaseline].label} baseline.`,
        }
      }

      return {
        preset,
        autoStatus: 'manual',
        autoReason: `${QUALITY_PROFILES[preset].label} was selected manually.`,
      }
    })
  },

  setAutoDecision: (autoQuality, autoStatus, autoReason) => set((state) => {
    if (
      state.autoQuality === autoQuality
      && state.autoStatus === autoStatus
      && state.autoReason === autoReason
    ) {
      return state
    }

    return { autoQuality, autoStatus, autoReason }
  }),

  setFps: (fps) => set((state) => (
    state.fps === fps ? state : { fps }
  )),

  setFramePacingStatus: (
    frameMode,
    frameTargetFps,
    rendererPowerPreference
  ) => set((state) => {
    if (
      state.frameMode === frameMode
      && state.frameTargetFps === frameTargetFps
      && state.rendererPowerPreference === rendererPowerPreference
    ) {
      return state
    }

    return {
      frameMode,
      frameTargetFps,
      rendererPowerPreference,
    }
  }),

  setReducedMotion: (reducedMotion) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MOTION_KEY, String(reducedMotion))
    }
    set({ reducedMotion })
  },
}))
