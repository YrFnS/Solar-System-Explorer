'use client'

import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import {
  getKtx2TextureEntry,
  getKtx2TextureUrl,
  type Ktx2TextureEntry,
} from '../textures/texture-manifest'
import { useLabTextureStore } from './lab-texture-store'

interface LoadedTextureState {
  key: string
  texture: THREE.Texture
}

interface LoaderRecord {
  loader: KTX2Loader
  cache: Map<string, Promise<THREE.Texture>>
  consumers: number
}

const LAB_TEXTURE_QUALITY = 'balanced' as const
const LOADER_BY_RENDERER = new WeakMap<THREE.WebGPURenderer, LoaderRecord>()

function describeTextureFormat(texture: THREE.Texture) {
  const match = Object.entries(THREE).find(
    ([name, value]) => name.endsWith('_Format') && value === texture.format
  )
  return match?.[0].replace(/_Format$/, '') ?? `format-${texture.format}`
}

function createLoaderRecord(renderer: THREE.WebGPURenderer): LoaderRecord {
  const workerLimit = typeof navigator === 'undefined'
    ? 2
    : Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 4) - 1))
  const loader = new KTX2Loader()
    .setTranscoderPath('/basis/')
    .setWorkerLimit(workerLimit)
    .detectSupport(renderer)

  return {
    loader,
    cache: new Map(),
    consumers: 0,
  }
}

function acquireLoader(renderer: THREE.WebGPURenderer) {
  const record = LOADER_BY_RENDERER.get(renderer) ?? createLoaderRecord(renderer)
  if (!LOADER_BY_RENDERER.has(renderer)) LOADER_BY_RENDERER.set(renderer, record)
  record.consumers += 1
  return record
}

function releaseLoader(renderer: THREE.WebGPURenderer, record: LoaderRecord) {
  record.consumers = Math.max(0, record.consumers - 1)
  if (record.consumers > 0) return

  record.loader.dispose()
  record.cache.clear()
  LOADER_BY_RENDERER.delete(renderer)
}

function loadTexture(
  record: LoaderRecord,
  url: string,
  entry: Ktx2TextureEntry
) {
  const cached = record.cache.get(url)
  if (cached) return cached

  const pending = record.loader.loadAsync(url)
    .then((texture) => {
      texture.colorSpace = entry.colorSpace === 'srgb'
        ? THREE.SRGBColorSpace
        : THREE.NoColorSpace
      texture.userData.solarLabTexture = {
        id: entry.id,
        codec: entry.codec,
        format: describeTextureFormat(texture),
      }
      texture.needsUpdate = true
      return texture
    })
    .catch((error) => {
      record.cache.delete(url)
      throw error
    })

  record.cache.set(url, pending)
  return pending
}

/**
 * Loads one fixed 1K KTX2 tier for backend parity. Until the transcode succeeds,
 * callers keep their procedural TSL material; a failed texture never prevents
 * the laboratory scene from rendering.
 */
export function useLabKtx2Texture(sourceUrl: string) {
  const renderer = useThree((state) => state.gl) as unknown as THREE.WebGPURenderer
  const recordRequested = useLabTextureStore((state) => state.recordRequested)
  const recordSuccess = useLabTextureStore((state) => state.recordSuccess)
  const recordFailure = useLabTextureStore((state) => state.recordFailure)
  const entry = getKtx2TextureEntry(sourceUrl)
  const textureUrl = entry
    ? getKtx2TextureUrl(entry, LAB_TEXTURE_QUALITY)
    : null
  const textureKey = entry && textureUrl ? `${entry.id}:${LAB_TEXTURE_QUALITY}` : ''
  const [loaded, setLoaded] = useState<LoadedTextureState | null>(null)

  useEffect(() => {
    if (!entry || !textureUrl) return

    recordRequested(entry.id)
    const record = acquireLoader(renderer)
    let cancelled = false

    loadTexture(record, textureUrl, entry)
      .then((texture) => {
        if (cancelled) return
        const format = String(
          (texture.userData.solarLabTexture as { format?: string } | undefined)?.format
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
        console.warn(`[webgpu-lab] procedural fallback for ${entry.id}: ${message}`)
      })

    return () => {
      cancelled = true
      releaseLoader(renderer, record)
    }
  }, [
    entry,
    recordFailure,
    recordRequested,
    recordSuccess,
    renderer,
    textureKey,
    textureUrl,
  ])

  return loaded?.key === textureKey ? loaded.texture : null
}
