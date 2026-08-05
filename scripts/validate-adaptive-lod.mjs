import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const read = (filePath) => readFile(path.join(root, filePath), 'utf8')

const [
  packageJsonSource,
  lodManager,
  browserSmoke,
] = await Promise.all([
  read('package.json'),
  read('src/components/solar-system/AdaptiveLodManager.tsx'),
  read('scripts/smoke-adaptive-lod.mjs'),
])

const packageJson = JSON.parse(packageJsonSource)
const failures = []
const requireContract = (condition, message) => {
  if (!condition) failures.push(message)
}

requireContract(
  lodManager.includes('new Map<string, SphereLodEntry>()')
    && lodManager.includes('new Map<string, SpherePoolRecord>()')
    && lodManager.includes('childadded')
    && lodManager.includes('childremoved'),
  'Adaptive LOD must maintain an event-driven mesh registry and a shared geometry pool.'
)

requireContract(
  !lodManager.includes('scene.traverse(')
    && !lodManager.includes('UPDATE_INTERVAL_SECONDS')
    && lodManager.includes('periodicSceneWalks: 0'),
  'Adaptive LOD must not retain periodic whole-scene traversal.'
)

requireContract(
  lodManager.includes('cameraChanged()')
    && lodManager.includes("markDirty('viewport', true)")
    && lodManager.includes("markDirty('quality', true)")
    && lodManager.includes('MIN_CAMERA_EVALUATION_INTERVAL_MS'),
  'LOD evaluation must react to camera, viewport, and quality changes with bounded camera cadence.'
)

requireContract(
  lodManager.includes('geometrySpec(')
    && lodManager.includes('poolHits')
    && lodManager.includes('poolMisses')
    && lodManager.includes('pooledGeometryUsers')
    && lodManager.includes('record.geometry.dispose()'),
  'Generated sphere geometry must use a shared, observable, disposed pool.'
)

requireContract(
  lodManager.includes('__SOLAR_ADAPTIVE_LOD__')
    && lodManager.includes('initialSceneWalks')
    && lodManager.includes('registryEvaluations')
    && lodManager.includes('averageEvaluationMs')
    && lodManager.includes('stationaryFrames'),
  'Adaptive LOD must publish CPU, registry, traversal, and geometry-residency diagnostics.'
)

requireContract(
  browserSmoke.includes('__SOLAR_ADAPTIVE_LOD__')
    && browserSmoke.includes('initialSceneWalks')
    && browserSmoke.includes('periodicSceneWalks')
    && browserSmoke.includes('cameraInvalidations')
    && browserSmoke.includes('viewportInvalidations')
    && browserSmoke.includes('qualityInvalidations')
    && browserSmoke.includes('poolHits'),
  'Production browser coverage must validate stationary behavior, invalidation sources, and pool reuse.'
)

requireContract(
  packageJson.scripts?.['adaptive-lod:smoke']
    === 'node scripts/validate-adaptive-lod.mjs && node scripts/smoke-adaptive-lod.mjs',
  'package.json must expose the complete adaptive LOD gate.'
)

requireContract(
  packageJson.scripts?.['ui:smoke']?.includes('bun run adaptive-lod:smoke'),
  'The main production UI gate must run adaptive LOD coverage.'
)

if (failures.length > 0) {
  console.error('[adaptive-lod-contract] failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(
    '[adaptive-lod-contract] event registry, pooled geometry, change-driven evaluation, and browser evidence passed'
  )
}
