'use client'

import { create } from 'zustand'

export type LabTextureBackend = 'procedural' | 'ktx2' | 'mixed'

export interface LabTextureDiagnostics {
  backend: LabTextureBackend
  requestedIds: string[]
  loadedIds: string[]
  failedIds: string[]
  formats: string[]
  lastError: string | null
}

interface LabTextureState extends LabTextureDiagnostics {
  reset: () => void
  recordRequested: (id: string) => void
  recordSuccess: (id: string, format: string) => void
  recordFailure: (id: string, message: string) => void
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_LAB_TEXTURES__?: LabTextureDiagnostics
  }
}

const EMPTY_DIAGNOSTICS: LabTextureDiagnostics = {
  backend: 'procedural',
  requestedIds: [],
  loadedIds: [],
  failedIds: [],
  formats: [],
  lastError: null,
}

function deriveBackend(
  requestedIds: string[],
  loadedIds: string[],
  failedIds: string[]
): LabTextureBackend {
  if (loadedIds.length === 0) return 'procedural'
  if (failedIds.length > 0 || loadedIds.length < requestedIds.length) return 'mixed'
  return 'ktx2'
}

function appendUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value]
}

export const useLabTextureStore = create<LabTextureState>((set) => ({
  ...EMPTY_DIAGNOSTICS,

  reset: () => set({ ...EMPTY_DIAGNOSTICS }),

  recordRequested: (id) => set((state) => {
    const requestedIds = appendUnique(state.requestedIds, id)
    return {
      requestedIds,
      backend: deriveBackend(requestedIds, state.loadedIds, state.failedIds),
    }
  }),

  recordSuccess: (id, format) => set((state) => {
    const requestedIds = appendUnique(state.requestedIds, id)
    const loadedIds = appendUnique(state.loadedIds, id)
    const failedIds = state.failedIds.filter((failedId) => failedId !== id)
    const formats = appendUnique(state.formats, format)

    return {
      requestedIds,
      loadedIds,
      failedIds,
      formats,
      lastError: failedIds.length === 0 ? null : state.lastError,
      backend: deriveBackend(requestedIds, loadedIds, failedIds),
    }
  }),

  recordFailure: (id, message) => set((state) => {
    const requestedIds = appendUnique(state.requestedIds, id)
    const failedIds = appendUnique(state.failedIds, id)
    return {
      requestedIds,
      failedIds,
      lastError: message,
      backend: deriveBackend(requestedIds, state.loadedIds, failedIds),
    }
  }),
}))

if (typeof window !== 'undefined') {
  const publish = (state: LabTextureState) => {
    window.__SOLAR_WEBGPU_LAB_TEXTURES__ = {
      backend: state.backend,
      requestedIds: state.requestedIds,
      loadedIds: state.loadedIds,
      failedIds: state.failedIds,
      formats: state.formats,
      lastError: state.lastError,
    }
  }

  publish(useLabTextureStore.getState())
  useLabTextureStore.subscribe(publish)
}
