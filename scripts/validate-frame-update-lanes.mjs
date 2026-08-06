import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const solarRoot = path.join(root, 'src', 'components', 'solar-system')
const read = (filePath) => readFile(path.join(root, filePath), 'utf8')
const failures = []
const requireContract = (condition, message) => {
  if (!condition) failures.push(message)
}

const allowedDirectFrameFiles = new Set([
  'src/components/solar-system/AdaptiveLodManager.tsx',
  'src/components/solar-system/FramePacingController.tsx',
  'src/components/solar-system/FrameUpdateLanes.tsx',
  'src/components/solar-system/RenderDiagnostics.tsx',
  'src/components/solar-system/SceneLoadScheduler.tsx',
  'src/components/solar-system/ScenePerformanceManager.tsx',
  'src/components/solar-system/SimulationController.tsx',
])

const migratedLaneFiles = [
  'src/components/solar-system/EphemerisCameraController.tsx',
  'src/components/solar-system/EphemerisCollisionDetector.tsx',
  'src/components/solar-system/EphemerisMoon.tsx',
  'src/components/solar-system/EphemerisPlanet.tsx',
  'src/components/solar-system/EphemerisSmallBody.tsx',
  'src/components/solar-system/EphemerisSpawnedObjects.tsx',
  'src/components/solar-system/InstancedSmallBodies.tsx',
  'src/components/solar-system/PlanetLabel.tsx',
  'src/components/solar-system/VelocityVector.tsx',
  'src/components/solar-system/Sun.tsx',
  'src/components/solar-system/StarField.tsx',
  'src/components/solar-system/AsteroidBelt.tsx',
  'src/components/solar-system/CentaurBelt.tsx',
  'src/components/solar-system/ScatteredDiscBelt.tsx',
  'src/components/solar-system/OortCloud.tsx',
  'src/components/solar-system/TrojanAsteroids.tsx',
  'src/components/solar-system/NearEarthObjects.tsx',
  'src/components/solar-system/SolarWind.tsx',
  'src/components/solar-system/MeteorShower.tsx',
  'src/components/solar-system/Nebula.tsx',
  'src/components/solar-system/Heliosphere.tsx',
  'src/components/solar-system/GalacticNeighborhood.tsx',
  'src/components/solar-system/Rings.tsx',
  'src/components/solar-system/DistanceRuler.tsx',
  'src/components/solar-system/Explosion.tsx',
  'src/components/solar-system/HumanArtifacts.tsx',
  'src/components/solar-system/Wormhole.tsx',
  'src/components/solar-system/BlackHole.tsx',
]

async function walk(directory) {
  const results = []
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      results.push(...await walk(absolute))
      continue
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name)) continue
    results.push(absolute)
  }
  return results
}

const sourceFiles = await walk(solarRoot)
const directFrameFiles = []
let productionDirectCallbacks = 0

for (const absolute of sourceFiles) {
  const relative = path.relative(root, absolute).replaceAll('\\', '/')
  const source = await readFile(absolute, 'utf8')
  const callbacks = (source.match(/\buseFrame\s*\(/g) ?? []).length
  if (callbacks === 0) continue
  if (relative.includes('/webgpu/')) continue

  directFrameFiles.push({ relative, callbacks })
  productionDirectCallbacks += callbacks

  if (!allowedDirectFrameFiles.has(relative)) {
    failures.push(
      `${relative} owns ${callbacks} direct useFrame callback(s); register work with FrameUpdateLanes instead.`
    )
  }
}

for (const allowedFile of allowedDirectFrameFiles) {
  const entry = directFrameFiles.find(({ relative }) => relative === allowedFile)
  requireContract(
    entry?.callbacks === 1,
    `${allowedFile} must retain exactly one deliberate runtime callback.`
  )
}

requireContract(
  productionDirectCallbacks === allowedDirectFrameFiles.size,
  `Production must contain exactly ${allowedDirectFrameFiles.size} direct runtime callbacks; found ${productionDirectCallbacks}.`
)

const [
  laneSource,
  sceneContainer,
  packageSource,
  workflowSource,
  browserSmoke,
] = await Promise.all([
  read('src/components/solar-system/FrameUpdateLanes.tsx'),
  read('src/components/solar-system/SceneContainer.tsx'),
  read('package.json'),
  read('.github/workflows/quality.yml'),
  read('scripts/smoke-frame-update-lanes.mjs').catch(() => ''),
])
const packageJson = JSON.parse(packageSource)

requireContract(
  laneSource.includes("export type FrameUpdateLane = 'critical' | 'ephemeris' | 'decorative'")
    && laneSource.includes('getSimulationDateMs()')
    && laneSource.includes("eco: 10")
    && laneSource.includes("balanced: 15")
    && laneSource.includes("ultra: 24")
    && laneSource.includes('__SOLAR_FRAME_LANES__')
    && laneSource.includes("useFrame((state, renderDelta)"),
  'FrameUpdateLanes must own one shared clock read, three explicit lanes, bounded decorative rates, and diagnostics.'
)
requireContract(
  sceneContainer.includes('<FrameUpdateLanes>')
    && sceneContainer.includes('</FrameUpdateLanes>'),
  'SceneContainer must wrap the production scene with FrameUpdateLanes.'
)

for (const filePath of migratedLaneFiles) {
  const source = await read(filePath)
  requireContract(
    source.includes('useFrameLane'),
    `${filePath} must register with FrameUpdateLanes.`
  )
  requireContract(
    !/\buseFrame\s*\(/.test(source),
    `${filePath} must not own a direct useFrame callback.`
  )
}

requireContract(
  packageJson.scripts?.['frame-lanes:smoke']
    === 'node scripts/validate-frame-update-lanes.mjs && node scripts/smoke-frame-update-lanes.mjs',
  'package.json must expose the complete frame-lanes gate.'
)
requireContract(
  packageJson.scripts?.['ui:smoke']?.includes('bun run frame-lanes:smoke'),
  'The production UI gate must execute frame-lane coverage.'
)
requireContract(
  workflowSource.includes('Report direct frame callbacks')
    && workflowSource.includes('bun run frame-callbacks:report'),
  'GitHub Actions must publish the direct callback inventory.'
)
requireContract(
  browserSmoke.includes('__SOLAR_FRAME_LANES__')
    && browserSmoke.includes('assertPausedLaneBehavior')
    && browserSmoke.includes('assertCameraInvalidation')
    && browserSmoke.includes('assertSelectedBodyPromotion'),
  'Production browser coverage must verify lane cadence, camera invalidation, and selected-body promotion.'
)

if (failures.length > 0) {
  console.error('[frame-lanes-contract] failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(
    `[frame-lanes-contract] ${productionDirectCallbacks} approved runtime callbacks, ${migratedLaneFiles.length} migrated modules, shared clock dispatch, and browser evidence passed`
  )
}
