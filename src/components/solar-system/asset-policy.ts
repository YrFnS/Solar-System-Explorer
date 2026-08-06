import * as THREE from 'three'
import {
  getEffectiveQuality,
  usePerformanceStore,
} from './performance-store'
import { getTextureFallbackUrl } from './textures/texture-manifest'

let installed = false

const REMOTE_ASSET_REWRITES: Array<[string, string]> = [
  ['earth_clouds_1024.png', '/textures/earth-clouds.svg'],
  ['earth_specular_2048.jpg', '/textures/earth.jpg'],
  ['moonmap1k.jpg', '/textures/moon.jpg'],
  ['moonbump1k.jpg', '/textures/moon.jpg'],
]

/**
 * Keeps legacy data entries compatible and routes ordinary Three.js texture
 * requests to the same explicit quality-tier URLs used by useAdaptiveTexture.
 * Authored adaptive materials pass an already-tiered URL, which remains
 * unchanged here and becomes the actual React Three Fiber cache key.
 */
export function installAssetUrlPolicy() {
  if (installed || typeof window === 'undefined') return
  installed = true

  THREE.DefaultLoadingManager.setURLModifier((url) => {
    const rewrite = REMOTE_ASSET_REWRITES.find(([needle]) => url.includes(needle))
    const localUrl = rewrite ? rewrite[1] : url
    const quality = getEffectiveQuality(usePerformanceStore.getState())
    return getTextureFallbackUrl(localUrl, quality)
  })
}
