'use client'

import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { EffectiveQuality } from '../performance-store'
import type { Ktx2TextureEntry } from './texture-manifest'

interface FallbackTextureRecord {
  key: string
  texture: THREE.Texture
  consumers: Set<symbol>
  compressedConsumers: Set<symbol>
  gpuReleased: boolean
}

interface Ktx2TextureRecord {
  key: string
  entryId: string
  consumers: Set<symbol>
  requestedAnisotropy: number
  promise: Promise<THREE.Texture>
  texture: THREE.Texture | null
  retired: boolean
  disposed: boolean
}

interface RendererTextureResources {
  id: number
  loader: KTX2Loader
  records: Map<string, Ktx2TextureRecord>
  disposed: boolean
}

interface LifecycleCounters {
  fallbackGpuReleases: number
  fallbackGpuRestores: number
  fallbackDisposals: number
  fallbackCacheEvictions: number
  ktx2Disposals: number
  loaderDisposals: number
}

export interface TextureLifecycleDiagnostics {
  activeQuality: EffectiveQuality
  activeTierWidth: number
  fallbackCacheKeys: string[]
  fallbackGpuResidentKeys: string[]
  fallbackGpuReleasedKeys: string[]
  fallbackConsumers: number
  ktx2ResidentKeys: string[]
  ktx2PendingKeys: string[]
  ktx2Consumers: number
  rendererResourceCount: number
  counters: LifecycleCounters
  timestamp: number
}

declare global {
  interface Window {
    __SOLAR_TEXTURE_LIFECYCLE__?: TextureLifecycleDiagnostics
  }
}

export interface FallbackTextureLease {
  setCompressed: (compressed: boolean) => void
  release: () => void
}

export interface Ktx2TextureLease {
  promise: Promise<THREE.Texture>
  release: () => void
}

const FALLBACK_BY_TEXTURE = new WeakMap<THREE.Texture, FallbackTextureRecord>()
const FALLBACK_RECORDS = new Set<FallbackTextureRecord>()
const RESOURCES_BY_RENDERER = new WeakMap<THREE.WebGLRenderer, RendererTextureResources>()
const ACTIVE_RENDERER_RESOURCES = new Set<RendererTextureResources>()

let nextRendererResourceId = 1
let activeQuality: EffectiveQuality = 'eco'
let activeTierWidth = 512

const counters: LifecycleCounters = {
  fallbackGpuReleases: 0,
  fallbackGpuRestores: 0,
  fallbackDisposals: 0,
  fallbackCacheEvictions: 0,
  ktx2Disposals: 0,
  loaderDisposals: 0,
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort()
}

function describeTextureFormat(texture: THREE.Texture) {
  const match = Object.entries(THREE).find(
    ([name, value]) => name.endsWith('_Format') && value === texture.format
  )
  return match?.[0].replace(/_Format$/, '') ?? `format-${texture.format}`
}

function publishTextureLifecycleDiagnostics() {
  if (typeof window === 'undefined') return

  const fallbackRecords = [...FALLBACK_RECORDS]
  const rendererResources = [...ACTIVE_RENDERER_RESOURCES]
  const ktx2Records = rendererResources.flatMap((resources) => (
    [...resources.records.values()]
  ))

  window.__SOLAR_TEXTURE_LIFECYCLE__ = {
    activeQuality,
    activeTierWidth,
    fallbackCacheKeys: uniqueSorted(fallbackRecords.map((record) => record.key)),
    fallbackGpuResidentKeys: uniqueSorted(
      fallbackRecords
        .filter((record) => !record.gpuReleased)
        .map((record) => record.key)
    ),
    fallbackGpuReleasedKeys: uniqueSorted(
      fallbackRecords
        .filter((record) => record.gpuReleased)
        .map((record) => record.key)
    ),
    fallbackConsumers: fallbackRecords.reduce(
      (total, record) => total + record.consumers.size,
      0
    ),
    ktx2ResidentKeys: uniqueSorted(
      ktx2Records
        .filter((record) => Boolean(record.texture) && !record.disposed)
        .map((record) => record.key)
    ),
    ktx2PendingKeys: uniqueSorted(
      ktx2Records
        .filter((record) => !record.texture && !record.disposed)
        .map((record) => record.key)
    ),
    ktx2Consumers: ktx2Records.reduce(
      (total, record) => total + record.consumers.size,
      0
    ),
    rendererResourceCount: rendererResources.length,
    counters: { ...counters },
    timestamp: Date.now(),
  }
}

function hasFallbackRecordForKey(
  key: string,
  excludedRecord: FallbackTextureRecord
) {
  for (const record of FALLBACK_RECORDS) {
    if (record !== excludedRecord && record.key === key) return true
  }
  return false
}

function synchronizeFallbackTexture(record: FallbackTextureRecord) {
  const allConsumersCompressed = record.consumers.size > 0
    && record.compressedConsumers.size === record.consumers.size

  if (allConsumersCompressed && !record.gpuReleased) {
    record.texture.dispose()
    record.gpuReleased = true
    counters.fallbackGpuReleases += 1
    publishTextureLifecycleDiagnostics()
    return
  }

  if (!allConsumersCompressed && record.gpuReleased) {
    record.texture.needsUpdate = true
    record.gpuReleased = false
    counters.fallbackGpuRestores += 1
    publishTextureLifecycleDiagnostics()
  }
}

function finalizeFallbackTexture(record: FallbackTextureRecord) {
  if (!record.gpuReleased) {
    record.texture.dispose()
    counters.fallbackDisposals += 1
  }

  FALLBACK_RECORDS.delete(record)
  FALLBACK_BY_TEXTURE.delete(record.texture)

  if (!hasFallbackRecordForKey(record.key, record)) {
    useTexture.clear(record.key)
    counters.fallbackCacheEvictions += 1
  }

  publishTextureLifecycleDiagnostics()
}

/**
 * Retains one explicit WebP tier for every material consumer. The suspense
 * cache entry is removed only after the final consumer leaves that exact URL,
 * preventing old 512/1K/2K tiers from accumulating during quality changes.
 */
export function retainFallbackTexture(
  key: string,
  texture: THREE.Texture,
  consumerId: symbol
): FallbackTextureLease {
  let record = FALLBACK_BY_TEXTURE.get(texture)

  if (!record) {
    record = {
      key,
      texture,
      consumers: new Set(),
      compressedConsumers: new Set(),
      gpuReleased: false,
    }
    FALLBACK_BY_TEXTURE.set(texture, record)
    FALLBACK_RECORDS.add(record)
  }

  record.consumers.add(consumerId)
  record.compressedConsumers.delete(consumerId)
  synchronizeFallbackTexture(record)
  publishTextureLifecycleDiagnostics()

  let released = false
  return {
    setCompressed: (compressed) => {
      if (released || !record?.consumers.has(consumerId)) return
      if (compressed) record.compressedConsumers.add(consumerId)
      else record.compressedConsumers.delete(consumerId)
      synchronizeFallbackTexture(record)
    },
    release: () => {
      if (released || !record) return
      released = true
      record.consumers.delete(consumerId)
      record.compressedConsumers.delete(consumerId)

      if (record.consumers.size === 0) {
        finalizeFallbackTexture(record)
        return
      }

      synchronizeFallbackTexture(record)
      publishTextureLifecycleDiagnostics()
    },
  }
}

function configureKtx2Texture(
  renderer: THREE.WebGLRenderer,
  texture: THREE.Texture,
  entry: Ktx2TextureEntry,
  anisotropy: number
) {
  texture.anisotropy = Math.min(
    Math.max(1, anisotropy),
    renderer.capabilities.getMaxAnisotropy()
  )
  texture.colorSpace = entry.colorSpace === 'srgb'
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace
  texture.userData.solarTexture = {
    backend: 'ktx2',
    codec: entry.codec,
    id: entry.id,
    source: entry.input,
    format: describeTextureFormat(texture),
  }
  texture.needsUpdate = true
}

function disposeKtx2Record(
  resources: RendererTextureResources,
  record: Ktx2TextureRecord
) {
  if (record.disposed) return
  record.disposed = true
  record.retired = true
  record.consumers.clear()

  if (record.texture) {
    record.texture.dispose()
    counters.ktx2Disposals += 1
  }

  if (resources.records.get(record.key) === record) {
    resources.records.delete(record.key)
  }
  publishTextureLifecycleDiagnostics()
}

function getRendererTextureResources(renderer: THREE.WebGLRenderer) {
  const existing = RESOURCES_BY_RENDERER.get(renderer)
  if (existing && !existing.disposed) return existing

  const workerLimit = typeof navigator === 'undefined'
    ? 2
    : Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 4) - 1))
  const loader = new KTX2Loader()
    .setTranscoderPath('/basis/')
    .setWorkerLimit(workerLimit)
    .detectSupport(renderer)

  const resources: RendererTextureResources = {
    id: nextRendererResourceId,
    loader,
    records: new Map(),
    disposed: false,
  }
  nextRendererResourceId += 1
  RESOURCES_BY_RENDERER.set(renderer, resources)
  ACTIVE_RENDERER_RESOURCES.add(resources)
  publishTextureLifecycleDiagnostics()
  return resources
}

/**
 * Retains a compressed texture by renderer and explicit tier URL. The final
 * consumer releases and evicts the texture; pending loads are retired safely
 * and disposed as soon as their asynchronous transcode completes.
 */
export function retainKtx2Texture(
  renderer: THREE.WebGLRenderer,
  key: string,
  entry: Ktx2TextureEntry,
  anisotropy: number,
  consumerId: symbol
): Ktx2TextureLease {
  const resources = getRendererTextureResources(renderer)
  let record = resources.records.get(key)

  if (!record || record.disposed) {
    let nextRecord: Ktx2TextureRecord
    const loadPromise = resources.loader.loadAsync(key)
      .then((texture) => {
        configureKtx2Texture(
          renderer,
          texture,
          entry,
          nextRecord.requestedAnisotropy
        )
        nextRecord.texture = texture

        if (
          resources.disposed
          || (nextRecord.retired && nextRecord.consumers.size === 0)
        ) {
          disposeKtx2Record(resources, nextRecord)
        } else {
          publishTextureLifecycleDiagnostics()
        }

        return texture
      })
      .catch((error) => {
        if (resources.records.get(key) === nextRecord) {
          resources.records.delete(key)
        }
        publishTextureLifecycleDiagnostics()
        throw error
      })

    nextRecord = {
      key,
      entryId: entry.id,
      consumers: new Set(),
      requestedAnisotropy: anisotropy,
      promise: loadPromise,
      texture: null,
      retired: false,
      disposed: false,
    }
    record = nextRecord
    resources.records.set(key, record)
  }

  record.retired = false
  record.requestedAnisotropy = Math.max(record.requestedAnisotropy, anisotropy)
  record.consumers.add(consumerId)

  if (record.texture) {
    record.texture.anisotropy = Math.min(
      Math.max(1, record.requestedAnisotropy),
      renderer.capabilities.getMaxAnisotropy()
    )
    record.texture.needsUpdate = true
  }
  publishTextureLifecycleDiagnostics()

  let released = false
  return {
    promise: record.promise,
    release: () => {
      if (released || !record) return
      released = true
      record.consumers.delete(consumerId)

      if (record.consumers.size === 0) {
        record.retired = true
        if (record.texture) disposeKtx2Record(resources, record)
        else publishTextureLifecycleDiagnostics()
        return
      }

      publishTextureLifecycleDiagnostics()
    },
  }
}

/**
 * Called by the Canvas lifecycle boundary. This terminates Basis workers and
 * releases every compressed texture owned by the renderer before a replacement
 * WebGL context is created.
 */
export function disposeRendererTextureResources(renderer: THREE.WebGLRenderer) {
  const resources = RESOURCES_BY_RENDERER.get(renderer)
  if (!resources || resources.disposed) return

  resources.disposed = true
  for (const record of resources.records.values()) {
    record.retired = true
    record.consumers.clear()
    if (record.texture && !record.disposed) {
      record.texture.dispose()
      record.disposed = true
      counters.ktx2Disposals += 1
    }
  }
  resources.records.clear()
  resources.loader.dispose()
  counters.loaderDisposals += 1
  ACTIVE_RENDERER_RESOURCES.delete(resources)
  RESOURCES_BY_RENDERER.delete(renderer)
  publishTextureLifecycleDiagnostics()
}

export function setActiveTextureTier(
  quality: EffectiveQuality,
  tierWidth: number
) {
  activeQuality = quality
  activeTierWidth = tierWidth
  publishTextureLifecycleDiagnostics()
}

if (typeof window !== 'undefined') {
  publishTextureLifecycleDiagnostics()
}
