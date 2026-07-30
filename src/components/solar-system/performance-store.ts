'use client'

import { create } from 'zustand'

export type QualityPreset = 'auto' | 'eco' | 'balanced' | 'ultra'
export type EffectiveQuality = Exclude<QualityPreset, 'auto'>

export interface QualityProfile {
  label: string
  description: string
  dpr: [number, number]
  instanceDensity: number
  frameBudget: number
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
  fps: number
  reducedMotion: boolean
  setPreset: (preset: QualityPreset) => void
  setAutoQuality: (quality: EffectiveQuality) => void
  setFps: (fps: number) => void
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

function detectDeviceQuality(): EffectiveQuality {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'balanced'

  const nav = navigator as NavigatorWithHints
  const memory = nav.deviceMemory ?? 8
  const cores = nav.hardwareConcurrency || 8
  const narrowViewport = window.innerWidth < 820
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const saveData = Boolean(nav.connection?.saveData)
  const slowConnection = nav.connection?.effectiveType === '2g' || nav.connection?.effectiveType === 'slow-2g'

  if (saveData || slowConnection || memory <= 4 || cores <= 4 || (narrowViewport && coarsePointer)) {
    return 'eco'
  }

  if (memory >= 8 && cores >= 8 && !narrowViewport) {
    return 'ultra'
  }

  return 'balanced'
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

export const usePerformanceStore = create<PerformanceState>((set) => ({
  preset: readStoredPreset(),
  autoQuality: detectDeviceQuality(),
  fps: 60,
  reducedMotion: readReducedMotion(),

  setPreset: (preset) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PRESET_KEY, preset)
    }
    set({ preset })
  },

  setAutoQuality: (autoQuality) => set((state) => (
    state.autoQuality === autoQuality ? state : { autoQuality }
  )),

  setFps: (fps) => set((state) => (
    state.fps === fps ? state : { fps }
  )),

  setReducedMotion: (reducedMotion) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MOTION_KEY, String(reducedMotion))
    }
    set({ reducedMotion })
  },
}))
