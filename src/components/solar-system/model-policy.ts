import { humanArtifacts, interstellarObjects } from './data'

const PROCEDURAL_FALLBACK_MODELS = new Set([
  '/models/iss.glb',
  '/models/hubble.glb',
  '/models/voyager_nasa.glb',
  '/models/jwst.glb',
  '/models/oumuamua.glb',
])

let installed = false

/**
 * These historical catalogue URLs previously pointed at Git LFS pointer text,
 * not binary glTF payloads. The invalid placeholder files have been removed,
 * and the scene contains project-authored procedural renderers for each object.
 * Clear only those known URLs before any GLTF loader can request them.
 */
export function installModelAvailabilityPolicy() {
  if (installed) return
  installed = true

  for (const artifact of humanArtifacts) {
    if (artifact.modelUrl && PROCEDURAL_FALLBACK_MODELS.has(artifact.modelUrl)) {
      artifact.modelUrl = undefined
    }
  }

  for (const object of interstellarObjects) {
    if (object.modelUrl && PROCEDURAL_FALLBACK_MODELS.has(object.modelUrl)) {
      object.modelUrl = undefined
    }
  }
}
