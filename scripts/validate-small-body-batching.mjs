import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const smallBodyScenePath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'scene',
  'SmallBodiesScene.tsx'
)
const instancedBodiesPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'InstancedSmallBodies.tsx'
)
const orbitBatchPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'SmallBodyOrbitBatch.tsx'
)
const smokePath = path.join(root, 'scripts', 'smoke-small-body-batching.mjs')
const packagePath = path.join(root, 'package.json')

const [
  smallBodyScene,
  instancedBodies,
  orbitBatch,
  smoke,
  packageSource,
] = await Promise.all([
  readFile(smallBodyScenePath, 'utf8'),
  readFile(instancedBodiesPath, 'utf8'),
  readFile(orbitBatchPath, 'utf8'),
  readFile(smokePath, 'utf8'),
  readFile(packagePath, 'utf8'),
])

const packageJson = JSON.parse(packageSource)
const failures = []

function requireContract(condition, message) {
  if (!condition) failures.push(message)
}

function count(content, pattern) {
  return content.match(pattern)?.length ?? 0
}

requireContract(
  smallBodyScene.includes('<InstancedSmallBodies')
    && smallBodyScene.includes('<SmallBodyOrbitBatch')
    && smallBodyScene.includes('selectedEntry'),
  'SmallBodiesScene must route the overview through the instanced body and batched orbit components.'
)
requireContract(
  count(smallBodyScene, /<EphemerisSmallBody\b/g) === 1,
  'SmallBodiesScene must mount at most one full EphemerisSmallBody detail component.'
)
requireContract(
  count(smallBodyScene, /<EphemerisOrbitLine\b/g) === 1,
  'SmallBodiesScene must mount at most one individual orbit path for the selected body.'
)
requireContract(
  !/\.map\([^)]*=>\s*\(\s*<EphemerisSmallBody/s.test(smallBodyScene)
    && !/\.map\([^)]*=>\s*\(\s*<EphemerisOrbitLine/s.test(smallBodyScene),
  'SmallBodiesScene must not restore one React body or orbit component per catalogue entry.'
)

requireContract(
  count(instancedBodies, /useFrameLane\s*\(/g) === 1
    && count(instancedBodies, /useFrame\s*\(/g) === 0
    && instancedBodies.includes("lane: 'ephemeris'"),
  'InstancedSmallBodies must use exactly one shared ephemeris-lane registration for the entire overview.'
)
requireContract(
  count(instancedBodies, /<instancedMesh\b/g) === 3
    && instancedBodies.includes('setMatrixAt')
    && instancedBodies.includes('instanceMatrix.needsUpdate')
    && instancedBodies.includes('getBodyVisualPosition'),
  'InstancedSmallBodies must retain two visible geometry batches, one hit batch, and centralized matrix updates.'
)
requireContract(
  instancedBodies.includes('event.instanceId')
    && instancedBodies.includes('__SOLAR_SMALL_BODY_RUNTIME__')
    && instancedBodies.includes('overviewFrameManagers: 1')
    && instancedBodies.includes('positionEvaluationsPerFrame'),
  'Instanced small bodies must remain interactive and publish manager-level diagnostics.'
)

requireContract(
  orbitBatch.includes('<lineSegments')
    && orbitBatch.includes('getOrbitPoints')
    && orbitBatch.includes('vertexColors')
    && orbitBatch.includes('ORBIT_SEGMENTS'),
  'SmallBodyOrbitBatch must combine paths into one quality-aware line-segment geometry.'
)
requireContract(
  !orbitBatch.includes('<EphemerisOrbitLine'),
  'The orbit batch must not delegate back to individual orbit components.'
)

requireContract(
  packageJson.scripts?.['small-bodies:smoke']
    === 'node scripts/validate-small-body-batching.mjs && node scripts/smoke-small-body-batching.mjs',
  'package.json must expose the complete small-bodies:smoke gate.'
)
requireContract(
  packageJson.scripts?.['ui:smoke']?.includes('bun run small-bodies:smoke'),
  'The production UI gate must execute small-body batching coverage.'
)
requireContract(
  smoke.includes('__SOLAR_SMALL_BODY_RUNTIME__')
    && smoke.includes('assertOverviewBatching')
    && smoke.includes('assertSelectedDetail')
    && smoke.includes('draw-call reduction')
    && smoke.includes('scene-object reduction'),
  'Browser coverage must prove overview batching, selected detail promotion, and renderer reduction.'
)

if (failures.length > 0) {
  console.error('[small-body-contract] batching contract failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log('[small-body-contract] one lane manager, three body batches, one orbit batch, and one detail promotion passed')
}
