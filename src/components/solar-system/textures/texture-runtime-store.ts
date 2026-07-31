'use client'

import { create } from 'zustand'

export type TextureBackend = 'webp' | 'ktx2' | 'mixed'

export interface TextureRuntimeDiagnostics {
  enabled: boolean
  backend: TextureBackend
  requestedIds: string[]
  loadedIds: string[]
  failedIds: string[]
  formats: string[]
  lastError: string | null
}

interface TextureRuntimeState extends TextureRuntimeDiagnostics {
  setEnabled: (enabled: boolean) => void
  recordRequested: (id: string) => void
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

function includeId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id]
}

function deriveBackend(
  enabled: boolean,
  requestedIds: string[],
  loadedIds: string[],
  failedIds: string[]
): TextureBackend {
  if (!enabled || requestedIds.length === 0 || loadedIds.length === 0) return 'webp'
  if (failedIds.length > 0 || loadedIds.length < requestedIds.length) return 'mixed'
  return 'ktx2'
}

export const useTextureRuntimeStore = create<TextureRuntimeState>((set) => ({
  enabled: readEnabled(),
  backend: 'webp',
  requestedIds: [],
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
      backend: deriveBackend(
        enabled,
        state.requestedIds,
        state.loadedIds,
        state.failedIds
      ),
    }))
  },

  recordRequested: (id) => set((state) => {
    const requestedIds = includeId(state.requestedIds, id)
    if (requestedIds === state.requestedIds) return state

    return {
      requestedIds,
      backend: deriveBackend(
        state.enabled,
        requestedIds,
        state.loadedIds,
        state.failedIds
      ),
    }
  }),

  recordSuccess: (id, format) => set((state) => {
    const requestedIds = includeId(state.requestedIds, id)
    const loadedIds = includeId(state.loadedIds, id)
    const failedIds = state.failedIds.filter((failedId) => failedId !== id)
    const formats = state.formats.includes(format)
      ? state.formats
      : [...state.formats, format]

    return {
      requestedIds,
      loadedIds,
      failedIds,
      formats,
      lastError: failedIds.length === 0 ? null : state.lastError,
      backend: deriveBackend(
        state.enabled,
        requestedIds,
        loadedIds,
        failedIds
      ),
    }
  }),

  recordFailure: (id, message) => set((state) => {
    const requestedIds = includeId(state.requestedIds, id)
    const failedIds = includeId(state.failedIds, id)
    return {
      requestedIds,
      failedIds,
      lastError: message,
      backend: deriveBackend(
        state.enabled,
        requestedIds,
        state.loadedIds,
        failedIds
      ),
    }
  }),
}))

if (typeof window !== 'undefined') {
  const publish = (state: TextureRuntimeState) => {
    window.__SOLAR_TEXTURE_DIAGNOSTICS__ = {
      enabled: state.enabled,
      backend: state.backend,
      requestedIds: state.requestedIds,
      loadedIds: state.loadedIds,
      failedIds: state.failedIds,
      formats: state.formats,
      lastError: state.lastError,
    }
  }

  publish(useTextureRuntimeStore.getState())
  useTextureRuntimeStore.subscribe(publish)
}
