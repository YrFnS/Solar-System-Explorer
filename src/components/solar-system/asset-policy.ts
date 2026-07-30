import * as THREE from 'three'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'

let installed = false

const REMOTE_ASSET_REWRITES: Array<[string, string]> = [
  ['earth_clouds_1024.png', '/textures/earth-clouds.svg'],
  ['earth_specular_2048.jpg', '/textures/earth.jpg'],
  ['moonmap1k.jpg', '/textures/moon.jpg'],
  ['moonbump1k.jpg', '/textures/moon.jpg'],
]

const TEXTURE_WIDTHS: Record<EffectiveQuality, number> = {
  eco: 512,
  balanced: 1024,
  ultra: 2048,
}

function rewriteToOptimizedTexture(url: string) {
  const suffixIndex = url.search(/[?#]/)
  const pathname = suffixIndex >= 0 ? url.slice(0, suffixIndex) : url
  const suffix = suffixIndex >= 0 ? url.slice(suffixIndex) : ''

  if (
    !pathname.startsWith('/textures/') ||
    pathname.startsWith('/textures/optimized/') ||
    !/\.(?:jpe?g|png)$/i.test(pathname)
  ) {
    return url
  }

  const relativePath = pathname
    .slice('/textures/'.length)
    .replace(/\.(?:jpe?g|png)$/i, '')
  const quality = getEffectiveQuality(usePerformanceStore.getState())
  const width = TEXTURE_WIDTHS[quality]

  return `/textures/optimized/${relativePath}-${width}.webp${suffix}`
}

/**
 * Keeps legacy data entries compatible, removes common third-party texture
 * requests, and selects the texture tier that matches the active render profile.
 */
export function installAssetUrlPolicy() {
  if (installed || typeof window === 'undefined') return
  installed = true

  THREE.DefaultLoadingManager.setURLModifier((url) => {
    const rewrite = REMOTE_ASSET_REWRITES.find(([needle]) => url.includes(needle))
    const localUrl = rewrite ? rewrite[1] : url
    return rewriteToOptimizedTexture(localUrl)
  })
}
