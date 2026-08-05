'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getEffectiveQuality, usePerformanceStore } from '../performance-store'
import {
  getKtx2TextureEntry,
  getKtx2TextureUrl,
  getTextureFallbackUrl,
  getTextureTierWidth,
} from './texture-manifest'
import {
  retainFallbackTexture,
  retainKtx2Texture,
  type FallbackTextureLease,
} from './texture-resource-manager'
import { useTextureRuntimeStore } from './texture-runtime-store'

interface AdaptiveTextureOptions {
  anisotropy?: number
}

interface LoadedTextureState {
  key: string
  texture: THREE.Texture
}

/**
 * Uses an explicit quality-tier WebP URL as the React loader cache key, then
 * upgrades to a renderer-owned KTX2 lease. Both paths are reference counted so
 * superseded tiers and abandoned transcodes are disposed after their final
 * material consumer leaves.
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
  const tierWidth = getTextureTierWidth(quality)
  const fallbackUrl = getTextureFallbackUrl(sourceUrl, quality)
  const fallbackTexture = useTexture(fallbackUrl)
  const ktx2Url = entry ? getKtx2TextureUrl(entry, quality) : null
  const textureKey = entry && ktx2Url ? `${entry.id}:${quality}` : ''
  const anisotropy = options.anisotropy ?? 4
  const consumerId = useRef(Symbol(sourceUrl))
  const fallbackLeaseRef = useRef<FallbackTextureLease | null>(null)
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
    fallbackTexture.colorSpace = entry?.colorSpace === 'linear'
      ? THREE.NoColorSpace
      : THREE.SRGBColorSpace
    fallbackTexture.userData = {
      ...fallbackTexture.userData,
      solarTexture: {
        backend: 'webp',
        id: entry?.id ?? null,
        quality,
        tierWidth,
        source: fallbackUrl,
      },
    }
    fallbackTexture.needsUpdate = true

    const lease = retainFallbackTexture(
      fallbackUrl,
      fallbackTexture,
      consumerId.current
    )
    fallbackLeaseRef.current = lease

    return () => {
      if (fallbackLeaseRef.current === lease) fallbackLeaseRef.current = null
      lease.release()
    }
  }, [
    anisotropy,
    entry,
    fallbackTexture,
    fallbackUrl,
    quality,
    renderer,
    tierWidth,
  ])

  useLayoutEffect(() => {
    fallbackLeaseRef.current?.setCompressed(ktx2Active)
  }, [fallbackTexture, ktx2Active])

  useEffect(() => {
    if (!enabled || !entry || !ktx2Url) {
      let cancelled = false
      queueMicrotask(() => {
        if (!cancelled) setLoaded(null)
      })
      return () => {
        cancelled = true
      }
    }

    recordRequested(entry.id, quality, tierWidth)
    const lease = retainKtx2Texture(
      renderer,
      ktx2Url,
      entry,
      anisotropy,
      consumerId.current
    )
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      setLoaded((current) => (
        current?.key === textureKey ? current : null
      ))
    })

    lease.promise
      .then((texture) => {
        if (cancelled) return
        const format = String(
          (texture.userData.solarTexture as { format?: string } | undefined)?.format
            ?? `format-${texture.format}`
        )
        setLoaded({ key: textureKey, texture })
        recordSuccess(entry.id, format, quality, tierWidth)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error
          ? error.message
          : `Unable to load ${entry.id} as KTX2.`
        recordFailure(entry.id, message, quality, tierWidth)
        console.warn(`[textures] KTX2 fallback for ${entry.id}: ${message}`)
      })

    return () => {
      cancelled = true
      lease.release()
    }
  }, [
    anisotropy,
    enabled,
    entry,
    ktx2Url,
    quality,
    recordFailure,
    recordRequested,
    recordSuccess,
    renderer,
    textureKey,
    tierWidth,
  ])

  if (ktx2Active && loaded) return loaded.texture
  return fallbackTexture
}
