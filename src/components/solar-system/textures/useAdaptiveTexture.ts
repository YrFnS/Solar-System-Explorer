'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { getEffectiveQuality, usePerformanceStore } from '../performance-store'
import {
  getKtx2TextureEntry,
  getKtx2TextureUrl,
  getTextureFallbackUrl,
  type Ktx2TextureEntry,
} from './texture-manifest'
import { useTextureRuntimeStore } from './texture-runtime-store'

interface AdaptiveTextureOptions {
  anisotropy?: number
}

interface LoadedTextureState {
  key: string
  texture: THREE.Texture
}

interface FallbackUsage {
  consumers: Set<symbol>
  ktx2Consumers: Set<symbol>
  released: boolean
}

const LOADER_BY_RENDERER = new WeakMap<THREE.WebGLRenderer, KTX2Loader>()
const CACHE_BY_RENDERER = new WeakMap<
  THREE.WebGLRenderer,
  Map<string, Promise<THREE.Texture>>
>()
const FALLBACK_USAGE = new WeakMap<THREE.Texture, FallbackUsage>()

function describeTextureFormat(texture: THREE.Texture) {
  const match = Object.entries(THREE).find(
    ([name, value]) => name.endsWith('_Format') && value === texture.format
  )
  return match?.[0].replace(/_Format$/, '') ?? `format-${texture.format}`
}

function getLoader(renderer: THREE.WebGLRenderer) {
  const existing = LOADER_BY_RENDERER.get(renderer)
  if (existing) return existing

  const workerLimit = typeof navigator === 'undefined'
    ? 2
    : Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 4) - 1))
  const loader = new KTX2Loader()
    .setTranscoderPath('/basis/')
    .setWorkerLimit(workerLimit)
    .detectSupport(renderer)

  LOADER_BY_RENDERER.set(renderer, loader)
  CACHE_BY_RENDERER.set(renderer, new Map())
  return loader
}

function loadKtx2Texture(
  renderer: THREE.WebGLRenderer,
  url: string,
  entry: Ktx2TextureEntry,
  anisotropy: number
) {
  const cache = CACHE_BY_RENDERER.get(renderer) ?? new Map<string, Promise<THREE.Texture>>()
  if (!CACHE_BY_RENDERER.has(renderer)) CACHE_BY_RENDERER.set(renderer, cache)

  const cached = cache.get(url)
  if (cached) return cached

  const promise = getLoader(renderer)
    .loadAsync(url)
    .then((texture) => {
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
      return texture
    })
    .catch((error) => {
      cache.delete(url)
      throw error
    })

  cache.set(url, promise)
  return promise
}

function getFallbackUsage(texture: THREE.Texture) {
  const existing = FALLBACK_USAGE.get(texture)
  if (existing) return existing

  const usage: FallbackUsage = {
    consumers: new Set(),
    ktx2Consumers: new Set(),
    released: false,
  }
  FALLBACK_USAGE.set(texture, usage)
  return usage
}

function synchronizeFallback(texture: THREE.Texture, usage: FallbackUsage) {
  const allConsumersCompressed = usage.consumers.size > 0
    && usage.ktx2Consumers.size === usage.consumers.size

  if (allConsumersCompressed && !usage.released) {
    // Texture.dispose() releases only the GPU allocation. TextureLoader keeps
    // the decoded image object cached, so WebP can be re-uploaded immediately
    // when the user disables KTX2 or Auto moves to another quality tier.
    texture.dispose()
    usage.released = true
    return
  }

  if (!allConsumersCompressed && usage.released) {
    texture.needsUpdate = true
    usage.released = false
  }
}

function registerFallback(texture: THREE.Texture, consumerId: symbol) {
  const usage = getFallbackUsage(texture)
  usage.consumers.add(consumerId)
  usage.ktx2Consumers.delete(consumerId)
  synchronizeFallback(texture, usage)
}

function setFallbackCompressed(
  texture: THREE.Texture,
  consumerId: symbol,
  compressed: boolean
) {
  const usage = getFallbackUsage(texture)
  usage.consumers.add(consumerId)
  if (compressed) usage.ktx2Consumers.add(consumerId)
  else usage.ktx2Consumers.delete(consumerId)
  synchronizeFallback(texture, usage)
}

function unregisterFallback(texture: THREE.Texture, consumerId: symbol) {
  const usage = FALLBACK_USAGE.get(texture)
  if (!usage) return

  usage.consumers.delete(consumerId)
  usage.ktx2Consumers.delete(consumerId)
  if (usage.consumers.size === 0) {
    if (!usage.released) texture.dispose()
    FALLBACK_USAGE.delete(texture)
    return
  }

  synchronizeFallback(texture, usage)
}

/**
 * Renders immediately with the quality-tiered WebP source, then releases that
 * source's GPU allocation only when every material using it has switched to
 * KTX2. The decoded image remains cached, so disabling KTX2 restores WebP
 * without another network request. Any missing file, WASM, capability, network,
 * or transcode failure stays safely on WebP.
 */
export function useAdaptiveTexture(
  sourceUrl: string,
  options: AdaptiveTextureOptions = {}
) {
  const renderer = useThree((state) => state.gl) as THREE.WebGLRenderer
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const enabled = useTextureRuntimeStore((state) => state.enabled)
  const recordRequested = useTextureRuntimeStore((state) => state.recordRequested)
  const recordSuccess = useTextureRuntimeStore((state) => state.recordSuccess)
  const recordFailure = useTextureRuntimeStore((state) => state.recordFailure)
  const entry = getKtx2TextureEntry(sourceUrl)
  const fallbackUrl = getTextureFallbackUrl(sourceUrl)
  const fallbackTexture = useTexture(fallbackUrl)
  const ktx2Url = entry ? getKtx2TextureUrl(entry, quality) : null
  const textureKey = entry && ktx2Url ? `${entry.id}:${quality}` : ''
  const anisotropy = options.anisotropy ?? 4
  const consumerId = useRef(Symbol(sourceUrl))
  const [loaded, setLoaded] = useState<LoadedTextureState | null>(null)
  const ktx2Active = Boolean(
    enabled
    && entry
    && loaded?.key === textureKey
  )

  useLayoutEffect(() => {
    fallbackTexture.anisotropy = Math.min(
      Math.max(1, anisotropy),
      renderer.capabilities.getMaxAnisotropy()
    )
    fallbackTexture.userData = {
      ...fallbackTexture.userData,
      solarTexture: {
        backend: 'webp',
        source: fallbackUrl,
      },
    }
    fallbackTexture.needsUpdate = true
    registerFallback(fallbackTexture, consumerId.current)

    return () => {
      unregisterFallback(fallbackTexture, consumerId.current)
    }
  }, [anisotropy, fallbackTexture, fallbackUrl, renderer])

  useLayoutEffect(() => {
    setFallbackCompressed(
      fallbackTexture,
      consumerId.current,
      ktx2Active
    )
  }, [fallbackTexture, ktx2Active])

  useEffect(() => {
    if (!enabled || !entry || !ktx2Url) return

    recordRequested(entry.id)
    let cancelled = false

    loadKtx2Texture(renderer, ktx2Url, entry, anisotropy)
      .then((texture) => {
        if (cancelled) return
        const format = String(
          (texture.userData.solarTexture as { format?: string } | undefined)?.format
            ?? describeTextureFormat(texture)
        )
        setLoaded({ key: textureKey, texture })
        recordSuccess(entry.id, format)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error
          ? error.message
          : `Unable to load ${entry.id} as KTX2.`
        recordFailure(entry.id, message)
        console.warn(`[textures] KTX2 fallback for ${entry.id}: ${message}`)
      })

    return () => {
      cancelled = true
    }
  }, [
    anisotropy,
    enabled,
    entry,
    ktx2Url,
    recordFailure,
    recordRequested,
    recordSuccess,
    renderer,
    textureKey,
  ])

  if (ktx2Active && loaded) return loaded.texture
  return fallbackTexture
}
