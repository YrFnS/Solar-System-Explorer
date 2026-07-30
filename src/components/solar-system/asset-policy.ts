import * as THREE from 'three'

let installed = false

const REMOTE_ASSET_REWRITES: Array<[string, string]> = [
  ['earth_clouds_1024.png', '/textures/earth-clouds.svg'],
  ['earth_specular_2048.jpg', '/textures/earth.jpg'],
  ['moonmap1k.jpg', '/textures/moon.jpg'],
  ['moonbump1k.jpg', '/textures/moon.jpg'],
]

/**
 * Keeps legacy data entries compatible while preventing common texture files
 * from being fetched from third-party GitHub repositories at runtime.
 */
export function installAssetUrlPolicy() {
  if (installed || typeof window === 'undefined') return
  installed = true

  THREE.DefaultLoadingManager.setURLModifier((url) => {
    const rewrite = REMOTE_ASSET_REWRITES.find(([needle]) => url.includes(needle))
    return rewrite ? rewrite[1] : url
  })
}
