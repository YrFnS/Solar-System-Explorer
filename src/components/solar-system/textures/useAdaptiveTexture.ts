'use client'

import { useEffect, useMemo, useState } from 'react'
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

const LOADER_BY_RENDERER = new WeakMap<THREE.WebGLRenderer, KTX2Loader>()
const CACHE_BY_RENDERER = new WeakMap<
  THREE.WebGLRenderer,
  Map<string, Promise<THREE.Texture>>
>()

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

function cloneFallbackTexture(
  source: THREE.Texture,
  renderer: THREE.WebGLRenderer,
  sourceUrl: string,
  anisotropy: number
) {
  // `useTexture` owns the shared decoded source. Materials receive an owned
  // clone so it can be disposed as soon as the KTX2 replacement is active.
  // The shared source is never attached to a material and therefore is not
  // uploaded as a second GPU texture.
  const clone = source.clone()
  clone.anisotropy = Math.min(
    Math.max(1, anisotropy),
    renderer.capabilities.getMaxAnisotropy()
  )
  clone.userData = {
    ...source.userData,
    solarTexture: {
      backend: 'webp',
      source: sourceUrl,
    },
  }
  clone.needsUpdate = true
  return clone
}

/**
 * Renders immediately with an owned clone of the quality-tiered WebP source,
 * then replaces and disposes that GPU fallback after KTX2 transcoding succeeds.
 * Disabling KTX2 creates a fresh fallback clone, while any missing file,
 * unsupported browser, WASM, network, or transcode failure remains on WebP.
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
  const fallbackSourceTexture = useTexture(fallbackUrl)
  const ktx2Url = entry ? getKtx2TextureUrl(entry, quality) : null
  const textureKey = entry && ktx2Url ? `${entry.id}:${quality}` : ''
  const anisotropy = options.anisotropy ?? 4
  const [loaded, setLoaded] = useState<LoadedTextureState | null>(null)
  const ktx2Active = Boolean(
    enabled
    && entry
    && loaded?.key === textureKey
  )

  const fallbackTexture = useMemo(() => {
    if (ktx2Active) return null
    return cloneFallbackTexture(
      fallbackSourceTexture,
      renderer,
      fallbackUrl,
      anisotropy
    )
  }, [anisotropy, fallbackSourceTexture, fallbackUrl, ktx2Active, renderer])

  useEffect(() => () => {
    fallbackTexture?.dispose()
  }, [fallbackTexture])

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
  return fallbackTexture ?? fallbackSourceTexture
}
