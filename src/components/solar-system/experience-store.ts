'use client'

import { create } from 'zustand'
import { useSolarSystemStore } from './store'

export type ExperienceMode = 'explore' | 'scientific' | 'sandbox'

export interface ExperienceModeDefinition {
  id: ExperienceMode
  label: string
  eyebrow: string
  description: string
}

export const EXPERIENCE_MODES: Record<ExperienceMode, ExperienceModeDefinition> = {
  explore: {
    id: 'explore',
    label: 'Explore',
    eyebrow: 'Cinematic learning',
    description: 'A guided, approachable view with compressed scale and rich visual context.',
  },
  scientific: {
    id: 'scientific',
    label: 'Scientific',
    eyebrow: 'Ephemeris workspace',
    description: 'J2000 orbital planes, approximate JPL positions, telemetry, and vectors.',
  },
  sandbox: {
    id: 'sandbox',
    label: 'Sandbox',
    eyebrow: 'Physics playground',
    description: 'Experimental objects, collisions, gravity effects, and imaginative phenomena.',
  },
}

interface ExperienceState {
  mode: ExperienceMode
  simulationDateMs: number
  showVelocityVectors: boolean
  showOrbitalPlanes: boolean
  showScienceHud: boolean
  showEducationLayer: boolean
  setMode: (mode: ExperienceMode) => void
  setSimulationDateMs: (dateMs: number) => void
  setShowVelocityVectors: (show: boolean) => void
  setShowOrbitalPlanes: (show: boolean) => void
  setShowScienceHud: (show: boolean) => void
  setShowEducationLayer: (show: boolean) => void
}

const MODE_KEY = 'solar-explorer-experience-mode-v1'

function readStoredMode(): ExperienceMode {
  if (typeof window === 'undefined') return 'explore'

  const value = window.localStorage.getItem(MODE_KEY)
  return value === 'scientific' || value === 'sandbox' || value === 'explore'
    ? value
    : 'explore'
}

function defaultsForMode(mode: ExperienceMode) {
  if (mode === 'scientific') {
    return {
      showVelocityVectors: true,
      showOrbitalPlanes: true,
      showScienceHud: true,
      showEducationLayer: true,
    }
  }

  if (mode === 'sandbox') {
    return {
      showVelocityVectors: false,
      showOrbitalPlanes: false,
      showScienceHud: false,
      showEducationLayer: false,
    }
  }

  return {
    showVelocityVectors: false,
    showOrbitalPlanes: false,
    showScienceHud: false,
    showEducationLayer: true,
  }
}

const initialMode = readStoredMode()
const initialDefaults = defaultsForMode(initialMode)

export const useExperienceStore = create<ExperienceState>((set) => ({
  mode: initialMode,
  simulationDateMs: Date.now(),
  ...initialDefaults,

  setMode: (mode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MODE_KEY, mode)
    }
    set({ mode, ...defaultsForMode(mode) })
  },
  setSimulationDateMs: (simulationDateMs) => set({ simulationDateMs }),
  setShowVelocityVectors: (showVelocityVectors) => set({ showVelocityVectors }),
  setShowOrbitalPlanes: (showOrbitalPlanes) => set({ showOrbitalPlanes }),
  setShowScienceHud: (showScienceHud) => set({ showScienceHud }),
  setShowEducationLayer: (showEducationLayer) => set({ showEducationLayer }),
}))

/**
 * Applies a coherent feature profile when the user explicitly changes modes.
 * The separate Zustand store keeps rendering/education preferences out of the
 * already-large simulation store while this bridge coordinates existing scene
 * toggles.
 */
export function activateExperienceMode(mode: ExperienceMode) {
  useExperienceStore.getState().setMode(mode)
  const scene = useSolarSystemStore.getState()

  if (mode === 'scientific') {
    scene.setShowOrbitLines(true)
    scene.setShowLabels(true)
    scene.setShowTrails(false)
    // Physical values live in telemetry while visual distances stay compressed
    // enough to keep the complete system navigable.
    scene.setRealisticDistances(false)
    scene.setRealisticSizes(false)
    scene.setShowGravityWells(false)
    scene.setShowBlackHole(false)
    scene.setShowWormhole(false)
    scene.setShowPhenomena(false)
    scene.setShowSolarWind(false)
    scene.setShowZodiacalLight(false)
    scene.setShowCentaurs(true)
    scene.setShowScatteredDisc(true)
    return
  }

  if (mode === 'sandbox') {
    scene.setRealisticDistances(false)
    scene.setRealisticSizes(false)
    scene.setShowOrbitLines(true)
    scene.setShowLabels(true)
    scene.setShowTrails(false)
    scene.setShowPhenomena(true)
    scene.setShowSolarWind(true)
    scene.setShowZodiacalLight(true)
    scene.setShowGravityWells(true)
    scene.setShowBlackHole(true)
    scene.setShowWormhole(true)
    scene.setShowCentaurs(true)
    scene.setShowScatteredDisc(true)
    return
  }

  scene.setRealisticDistances(false)
  scene.setRealisticSizes(false)
  scene.setShowOrbitLines(true)
  scene.setShowLabels(true)
  scene.setShowTrails(false)
  scene.setShowGravityWells(false)
  scene.setShowBlackHole(false)
  scene.setShowWormhole(false)
  scene.setShowPhenomena(true)
  scene.setShowSolarWind(true)
  scene.setShowZodiacalLight(true)
}
