import { humanArtifacts, interstellarObjects } from './data'

const UNAVAILABLE_LFS_MODELS = new Set([
  '/models/iss.glb',
  '/models/hubble.glb',
  '/models/voyager_nasa.glb',
  '/models/jwst.glb',
  '/models/oumuamua.glb',
])

let installed = false

/**
 * Several historical GLB entries in the repository are Git LFS pointer text,
 * not binary glTF payloads. Loading them produces parser errors in production.
 * The scene already contains purpose-built procedural models for these objects,
 * so remove only the unavailable URLs and let those fallbacks render instead.
 */
export function installModelAvailabilityPolicy() {
  if (installed) return
  installed = true

  for (const artifact of humanArtifacts) {
    if (artifact.modelUrl && UNAVAILABLE_LFS_MODELS.has(artifact.modelUrl)) {
      artifact.modelUrl = undefined
    }
  }

  for (const object of interstellarObjects) {
    if (object.modelUrl && UNAVAILABLE_LFS_MODELS.has(object.modelUrl)) {
      object.modelUrl = undefined
    }
  }
}
