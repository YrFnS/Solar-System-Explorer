'use client'

import { useEffect, useState } from 'react'
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

/**
 * Renders immediately with the existing quality-tiered WebP texture, then
 * upgrades to a GPU-compressed KTX2 texture when the transcoder succeeds.
 * Any missing file, unsupported browser, or WASM failure remains a safe WebP
 * fallback instead of preventing the scene from rendering.
 */
export function useAdaptiveTexture(
  sourceUrl: string,
  options: AdaptiveTextureOptions = {}
) {
  const renderer = useThree((state) => state.gl) as THREE.WebGLRenderer
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const enabled = useTextureRuntimeStore((state) => state.enabled)
  const recordSuccess = useTextureRuntimeStore((state) => state.recordSuccess)
  const recordFailure = useTextureRuntimeStore((state) => state.recordFailure)
  const entry = getKtx2TextureEntry(sourceUrl)
  const fallbackUrl = getTextureFallbackUrl(sourceUrl)
  const fallbackTexture = useTexture(fallbackUrl)
  const ktx2Url = entry ? getKtx2TextureUrl(entry, quality) : null
  const textureKey = entry && ktx2Url ? `${entry.id}:${quality}` : ''
  const anisotropy = options.anisotropy ?? 4
  const [loaded, setLoaded] = useState<LoadedTextureState | null>(null)

  useEffect(() => {
    if (!enabled || !entry || !ktx2Url) return

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
  }, [anisotropy, enabled, entry, ktx2Url, recordFailure, recordSuccess, renderer, textureKey])

  if (!enabled || !entry || loaded?.key !== textureKey) return fallbackTexture
  return loaded.texture
}
