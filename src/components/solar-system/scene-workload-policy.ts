'use client'

import {
  getEffectiveQuality,
  isQualityAtLeast,
  QUALITY_PROFILES,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'
import {
  type SolarSystemState,
  useSolarSystemStore,
} from './store'

export const SCENE_WORKLOAD_SYSTEMS = [
  'nebula',
  'constellations',
  'galactic-neighborhood',
  'asteroid-belt',
  'near-earth-objects',
  'kuiper-belt',
  'oort-cloud',
  'trojans',
  'centaurs',
  'scattered-disc',
  'heliosphere',
  'phenomena',
  'solar-wind',
  'meteor-shower',
  'zodiacal-light',
  'gravity-wells',
  'black-hole',
  'wormhole',
] as const

export type SceneWorkloadSystem = (typeof SCENE_WORKLOAD_SYSTEMS)[number]

interface SceneSystemDefinition {
  label: string
  minimumQuality: EffectiveQuality
  requested: (state: SolarSystemState) => boolean
}

const SCENE_SYSTEM_DEFINITIONS: Record<
  SceneWorkloadSystem,
  SceneSystemDefinition
> = {
  nebula: {
    label: 'Nebula backdrop',
    minimumQuality: 'balanced',
    requested: (state) => state.showNebula,
  },
  constellations: {
    label: 'Constellations',
    minimumQuality: 'balanced',
    requested: (state) => state.showConstellations,
  },
  'galactic-neighborhood': {
    label: 'Galactic neighborhood',
    minimumQuality: 'ultra',
    requested: (state) => state.showGalacticNeighborhood,
  },
  'asteroid-belt': {
    label: 'Asteroid belt',
    minimumQuality: 'eco',
    requested: (state) => state.showAsteroidBelt,
  },
  'near-earth-objects': {
    label: 'Near-Earth object field',
    minimumQuality: 'balanced',
    requested: (state) => state.showPhenomena,
  },
  'kuiper-belt': {
    label: 'Kuiper belt',
    minimumQuality: 'balanced',
    requested: (state) => state.showKuiperBelt,
  },
  'oort-cloud': {
    label: 'Oort cloud',
    minimumQuality: 'ultra',
    requested: (state) => state.showKuiperBelt,
  },
  trojans: {
    label: 'Jupiter Trojans',
    minimumQuality: 'balanced',
    requested: (state) => state.showAsteroidBelt && state.showTrojans,
  },
  centaurs: {
    label: 'Centaur population',
    minimumQuality: 'balanced',
    requested: (state) => state.showCentaurs,
  },
  'scattered-disc': {
    label: 'Scattered disc',
    minimumQuality: 'ultra',
    requested: (state) => state.showScatteredDisc,
  },
  heliosphere: {
    label: 'Heliosphere',
    minimumQuality: 'balanced',
    requested: (state) => state.showHeliosphere,
  },
  phenomena: {
    label: 'Dynamic phenomena',
    minimumQuality: 'balanced',
    requested: (state) => state.showPhenomena,
  },
  'solar-wind': {
    label: 'Solar wind',
    minimumQuality: 'balanced',
    requested: (state) => state.showPhenomena && state.showSolarWind,
  },
  'meteor-shower': {
    label: 'Meteor shower',
    minimumQuality: 'balanced',
    requested: (state) => state.showPhenomena,
  },
  'zodiacal-light': {
    label: 'Zodiacal light',
    minimumQuality: 'ultra',
    requested: (state) => state.showPhenomena && state.showZodiacalLight,
  },
  'gravity-wells': {
    label: 'Gravity wells',
    minimumQuality: 'ultra',
    requested: (state) => state.showGravityWells,
  },
  'black-hole': {
    label: 'Black hole',
    minimumQuality: 'ultra',
    requested: (state) => state.showBlackHole,
  },
  wormhole: {
    label: 'Wormhole',
    minimumQuality: 'ultra',
    requested: (state) => state.showWormhole,
  },
}

export interface SceneSystemStatus {
  system: SceneWorkloadSystem
  label: string
  minimumQuality: EffectiveQuality
  requested: boolean
  allowed: boolean
  active: boolean
  limited: boolean
}

export interface SceneWorkloadSnapshot {
  quality: EffectiveQuality
  requestedSystems: SceneWorkloadSystem[]
  activeSystems: SceneWorkloadSystem[]
  suppressedSystems: SceneWorkloadSystem[]
}

export function getSceneSystemStatus(
  system: SceneWorkloadSystem,
  quality: EffectiveQuality,
  state: SolarSystemState
): SceneSystemStatus {
  const definition = SCENE_SYSTEM_DEFINITIONS[system]
  const requested = definition.requested(state)
  const allowed = isQualityAtLeast(quality, definition.minimumQuality)

  return {
    system,
    label: definition.label,
    minimumQuality: definition.minimumQuality,
    requested,
    allowed,
    active: requested && allowed,
    limited: requested && !allowed,
  }
}

export function getSceneWorkloadSnapshot(
  quality: EffectiveQuality,
  state: SolarSystemState
): SceneWorkloadSnapshot {
  const requestedSystems: SceneWorkloadSystem[] = []
  const activeSystems: SceneWorkloadSystem[] = []
  const suppressedSystems: SceneWorkloadSystem[] = []

  for (const system of SCENE_WORKLOAD_SYSTEMS) {
    const status = getSceneSystemStatus(system, quality, state)
    if (status.requested) requestedSystems.push(system)
    if (status.active) activeSystems.push(system)
    if (status.limited) suppressedSystems.push(system)
  }

  return {
    quality,
    requestedSystems,
    activeSystems,
    suppressedSystems,
  }
}

export function getSceneSystemLabel(system: SceneWorkloadSystem) {
  return SCENE_SYSTEM_DEFINITIONS[system].label
}

export function getSceneSystemMinimumQuality(system: SceneWorkloadSystem) {
  return SCENE_SYSTEM_DEFINITIONS[system].minimumQuality
}

export function getSceneSystemLimitNote(system: SceneWorkloadSystem) {
  const minimum = getSceneSystemMinimumQuality(system)
  return `Saved preference · active from ${QUALITY_PROFILES[minimum].label}`
}

export function useSceneSystemStatus(
  system: SceneWorkloadSystem
): SceneSystemStatus {
  const requested = useSolarSystemStore((state) => (
    SCENE_SYSTEM_DEFINITIONS[system].requested(state)
  ))
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const definition = SCENE_SYSTEM_DEFINITIONS[system]
  const allowed = isQualityAtLeast(quality, definition.minimumQuality)

  return {
    system,
    label: definition.label,
    minimumQuality: definition.minimumQuality,
    requested,
    allowed,
    active: requested && allowed,
    limited: requested && !allowed,
  }
}

export function useSceneSystemActive(system: SceneWorkloadSystem) {
  return useSceneSystemStatus(system).active
}

export function useSceneSystemLimited(system: SceneWorkloadSystem) {
  return useSceneSystemStatus(system).limited
}
