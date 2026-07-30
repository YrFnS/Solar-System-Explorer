import type { SolarSystemState } from './store'

declare module './store' {
  interface SolarSystemState {
    setCameraMode: (mode: 'orbit' | 'fly') => void
    setRealisticDistances: (show: boolean) => void
    setRealisticSizes: (show: boolean) => void
    setShowPhenomena: (show: boolean) => void
    setShowSolarWind: (show: boolean) => void
    setShowZodiacalLight: (show: boolean) => void
    addExplosion: (position: [number, number, number], color: string) => void
    spawnObject: (type: 'comet' | 'asteroid' | 'interstellar') => void
    removeSpawnedObject: (id: string) => void
  }
}

export type CompleteSolarSystemState = SolarSystemState
