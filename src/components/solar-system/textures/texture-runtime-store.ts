'use client'

import { create } from 'zustand'

export type TextureBackend = 'webp' | 'ktx2' | 'mixed'

export interface TextureRuntimeDiagnostics {
  enabled: boolean
  backend: TextureBackend
  loadedIds: string[]
  failedIds: string[]
  formats: string[]
  lastError: string | null
}

interface TextureRuntimeState extends TextureRuntimeDiagnostics {
  setEnabled: (enabled: boolean) => void
  recordSuccess: (id: string, format: string) => void
  recordFailure: (id: string, message: string) => void
}

declare global {
  interface Window {
    __SOLAR_TEXTURE_DIAGNOSTICS__?: TextureRuntimeDiagnostics
  }
}

const ENABLED_KEY = 'solar-explorer-ktx2-enabled-v1'

function readEnabled() {
  if (typeof window === 'undefined') return true
  const queryMode = new URLSearchParams(window.location.search).get('textures')
  if (queryMode === 'webp') return false
  if (queryMode === 'ktx2') return true
  return window.localStorage.getItem(ENABLED_KEY) !== 'false'
}

function deriveBackend(enabled: boolean, loadedIds: string[], failedIds: string[]): TextureBackend {
  if (!enabled || loadedIds.length === 0) return 'webp'
  return failedIds.length > 0 ? 'mixed' : 'ktx2'
}

export const useTextureRuntimeStore = create<TextureRuntimeState>((set) => ({
  enabled: readEnabled(),
  backend: 'webp',
  loadedIds: [],
  failedIds: [],
  formats: [],
  lastError: null,

  setEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ENABLED_KEY, String(enabled))
    }
    set((state) => ({
      enabled,
      backend: deriveBackend(enabled, state.loadedIds, state.failedIds),
    }))
  },

  recordSuccess: (id, format) => set((state) => {
    const loadedIds = state.loadedIds.includes(id)
      ? state.loadedIds
      : [...state.loadedIds, id]
    const failedIds = state.failedIds.filter((failedId) => failedId !== id)
    const formats = state.formats.includes(format)
      ? state.formats
      : [...state.formats, format]

    return {
      loadedIds,
      failedIds,
      formats,
      lastError: failedIds.length === 0 ? null : state.lastError,
      backend: deriveBackend(state.enabled, loadedIds, failedIds),
    }
  }),

  recordFailure: (id, message) => set((state) => {
    const failedIds = state.failedIds.includes(id)
      ? state.failedIds
      : [...state.failedIds, id]
    return {
      failedIds,
      lastError: message,
      backend: deriveBackend(state.enabled, state.loadedIds, failedIds),
    }
  }),
}))

if (typeof window !== 'undefined') {
  const publish = (state: TextureRuntimeState) => {
    window.__SOLAR_TEXTURE_DIAGNOSTICS__ = {
      enabled: state.enabled,
      backend: state.backend,
      loadedIds: state.loadedIds,
      failedIds: state.failedIds,
      formats: state.formats,
      lastError: state.lastError,
    }
  }

  publish(useTextureRuntimeStore.getState())
  useTextureRuntimeStore.subscribe(publish)
}
