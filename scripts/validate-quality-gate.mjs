import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const packageJsonPath = path.join(root, 'package.json')
const workflowPath = path.join(root, '.github', 'workflows', 'quality.yml')
const solarSystemRoot = path.join(root, 'src', 'components', 'solar-system')
const sceneContainerPath = path.join(solarSystemRoot, 'SceneContainer.tsx')
const solarSystemPath = path.join(solarSystemRoot, 'SolarSystemV3.tsx')
const sceneSchedulerPath = path.join(solarSystemRoot, 'SceneLoadScheduler.tsx')
const performanceStorePath = path.join(solarSystemRoot, 'performance-store.ts')
const scenePerformanceManagerPath = path.join(
  solarSystemRoot,
  'ScenePerformanceManager.tsx'
)
const workloadPolicyPath = path.join(solarSystemRoot, 'scene-workload-policy.ts')
const displaySettingsPath = path.join(
  solarSystemRoot,
  'ui',
  'DisplaySettingsPanel.tsx'
)
const textureRoot = path.join(solarSystemRoot, 'textures')
const textureManifestPath = path.join(textureRoot, 'texture-manifest.ts')
const adaptiveTexturePath = path.join(textureRoot, 'useAdaptiveTexture.ts')
const textureResourceManagerPath = path.join(
  textureRoot,
  'texture-resource-manager.ts'
)
const textureLifecycleManagerPath = path.join(
  textureRoot,
  'TextureLifecycleManager.tsx'
)
const textureRuntimeStorePath = path.join(textureRoot, 'texture-runtime-store.ts')
const removedWarmupPath = path.join(solarSystemRoot, 'ProgressiveSceneWarmup.tsx')
const runtimeSmokePath = path.join(root, 'scripts', 'smoke-runtime-foundation.mjs')
const textureSmokePath = path.join(root, 'scripts', 'smoke-texture-lifecycle.mjs')
const workloadScenePaths = [
  path.join(solarSystemRoot, 'scene', 'BackgroundScene.tsx'),
  path.join(solarSystemRoot, 'scene', 'PhenomenaScene.tsx'),
  path.join(solarSystemRoot, 'scene', 'SmallBodiesScene.tsx'),
  path.join(solarSystemRoot, 'scene', 'OuterFieldsScene.tsx'),
  path.join(solarSystemRoot, 'scene', 'SandboxScene.tsx'),
]

const sources = await Promise.all([
  readFile(packageJsonPath, 'utf8'),
  readFile(workflowPath, 'utf8'),
  readFile(sceneContainerPath, 'utf8'),
  readFile(solarSystemPath, 'utf8'),
  readFile(sceneSchedulerPath, 'utf8'),
  readFile(runtimeSmokePath, 'utf8'),
  readFile(performanceStorePath, 'utf8'),
  readFile(scenePerformanceManagerPath, 'utf8'),
  readFile(workloadPolicyPath, 'utf8'),
  readFile(displaySettingsPath, 'utf8'),
  readFile(textureManifestPath, 'utf8'),
  readFile(adaptiveTexturePath, 'utf8'),
  readFile(textureResourceManagerPath, 'utf8'),
  readFile(textureLifecycleManagerPath, 'utf8'),
  readFile(textureRuntimeStorePath, 'utf8'),
  readFile(textureSmokePath, 'utf8'),
  ...workloadScenePaths.map((filePath) => readFile(filePath, 'utf8')),
])

const [
  packageJsonSource,
  workflowSource,
  sceneContainer,
  solarSystem,
  sceneScheduler,
  runtimeSmoke,
  performanceStore,
  scenePerformanceManager,
  workloadPolicy,
  displaySettings,
  textureManifest,
  adaptiveTexture,
  textureResourceManager,
  textureLifecycleManager,
  textureRuntimeStore,
  textureSmoke,
  ...workloadScenes
] = sources

const packageJson = JSON.parse(packageJsonSource)
const workflow = workflowSource.replace(/\r\n/g, '\n')
const failures = []

function requireContract(condition, message) {
  if (!condition) failures.push(message)
}

function requireInOrder(content, values, label) {
  let cursor = -1
  for (const value of values) {
    const index = content.indexOf(value, cursor + 1)
    if (index === -1) {
      failures.push(`${label} is missing “${value}”.`)
      continue
    }
    if (index < cursor) {
      failures.push(`${label} places “${value}” before an earlier required gate.`)
    }
    cursor = Math.max(cursor, index)
  }
}

async function pathExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const packageManager = packageJson.packageManager ?? ''
const packageBunVersion = /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager)?.[1] ?? null
const workflowBunVersion = /bun-version:\s*['"]?(\d+\.\d+\.\d+)['"]?/.exec(workflow)?.[1] ?? null

requireContract(
  Boolean(packageBunVersion),
  'package.json must pin an exact packageManager such as bun@1.3.4.'
)
requireContract(
  Boolean(workflowBunVersion),
  'Quality workflow must pin an exact Bun version instead of latest or canary.'
)
requireContract(
  packageBunVersion === workflowBunVersion,
  `packageManager Bun (${packageBunVersion ?? 'missing'}) and workflow Bun (${workflowBunVersion ?? 'missing'}) must match.`
)
requireContract(!/bun-version:\s*latest\b/.test(workflow), 'Quality workflow must not use bun-version: latest.')
requireContract(/\n\s*workflow_dispatch:\s*(?:\n|$)/.test(workflow), 'Quality workflow must support manual workflow_dispatch runs.')
requireContract(/\n\s*pull_request:\s*(?:\n|$)/.test(workflow), 'Quality workflow must run for pull requests.')
requireContract(workflow.includes("      - main"), 'Quality push trigger must include main.')
requireContract(workflow.includes("      - 'agent/**'"), 'Quality push trigger must include agent/** branches.')
requireContract(workflow.includes("      - 'integration/**'"), 'Quality push trigger must include integration/** branches.')
requireContract(/\n\s*CI:\s*['"]?true['"]?\s*(?:\n|$)/.test(workflow), 'Quality workflow must set CI=true.')
requireContract(workflow.includes('bun install --frozen-lockfile'), 'Quality workflow must use a frozen Bun lockfile install.')
requireContract(workflow.includes('cancel-in-progress: true'), 'Quality workflow must cancel superseded runs.')
requireContract(workflow.includes('contents: read'), 'Quality workflow permissions must remain read-only.')

const workflowCommands = [
  'bun run quality:gate',
  'bun run audit',
  'bun run lint',
  'bun run typecheck',
  'bun run ephemeris:validate',
  'bun run webgpu:analysis:validate',
  'bun run textures:optimize',
  'bun run textures:basis:sync',
  'bun run textures:ktx2:verify',
  'bun run build:next',
  'bun run performance:budget',
  'bun run ui:smoke',
  'bun run runtime:smoke',
  'bun run webgpu:smoke',
  'bun run webgpu:benchmark:smoke',
  'bun run webgpu:results:smoke',
]
requireInOrder(workflow, workflowCommands, 'Quality workflow')

const localQuality = packageJson.scripts?.['quality:local'] ?? ''
const localCommands = [
  'bun run quality:gate',
  'bun run audit',
  'bun run lint',
  'bun run ephemeris:validate',
  'bun run webgpu:analysis:validate',
  'bun run build',
  'bun run performance:budget',
  'bun run ui:smoke',
  'bun run runtime:smoke',
  'bun run webgpu:smoke',
  'bun run webgpu:benchmark:smoke',
  'bun run webgpu:results:smoke',
]
requireInOrder(localQuality, localCommands, 'quality:local')
requireContract(
  packageJson.scripts?.['quality:gate'] === 'node scripts/validate-quality-gate.mjs',
  'package.json must expose quality:gate through scripts/validate-quality-gate.mjs.'
)
requireContract(
  packageJson.scripts?.['runtime:smoke']
    === 'node scripts/smoke-runtime-foundation.mjs && node scripts/smoke-texture-lifecycle.mjs',
  'runtime:smoke must run both the runtime-foundation and texture-lifecycle browser gates.'
)

requireContract(
  sceneContainer.includes('<SceneLoadScheduler>')
    && sceneContainer.includes('</SceneLoadScheduler>'),
  'SceneContainer must wrap the production scene in SceneLoadScheduler.'
)
requireContract(
  !sceneContainer.includes('ProgressiveSceneWarmup')
    && !sceneContainer.includes('prepareSceneWarmup'),
  'SceneContainer must not restore the removed fixed-time warmup path.'
)
requireContract(
  solarSystem.includes('useSceneLoadStage')
    && solarSystem.includes('SCENE_LOAD_STAGES'),
  'SolarSystemV3 must consume the central measured scene stages.'
)
requireContract(
  !solarSystem.includes('setTimeout(')
    && !solarSystem.includes('requestIdleCallback')
    && !solarSystem.includes('function useSceneStage'),
  'SolarSystemV3 must not contain an independent timer-based stage scheduler.'
)
requireContract(
  sceneScheduler.includes('useFrame(')
    && sceneScheduler.includes('requestIdleCallback')
    && sceneScheduler.includes('__SOLAR_SCENE_LOADING__')
    && sceneScheduler.includes("'frame-health'")
    && sceneScheduler.includes("'interaction-idle'"),
  'SceneLoadScheduler must retain frame-health, interaction, idle, and diagnostic contracts.'
)
requireContract(
  runtimeSmoke.includes('EXPECTED_SCENE_STAGES')
    && runtimeSmoke.includes('__SOLAR_SCENE_LOADING__')
    && runtimeSmoke.includes('waitForMeasuredSceneLoading'),
  'Runtime smoke coverage must validate sequential measured scene loading.'
)
requireContract(
  !(await pathExists(removedWarmupPath)),
  'ProgressiveSceneWarmup.tsx must remain removed so a second scheduler cannot return.'
)

requireContract(
  performanceStore.includes('detectAutoDevicePolicy')
    && performanceStore.includes("baseline: 'eco'")
    && performanceStore.includes("baseline: 'balanced'")
    && !performanceStore.includes("baseline: 'ultra'"),
  'Auto quality must start from Eco or Balanced and never use Ultra as its initial baseline.'
)
requireContract(
  performanceStore.includes('autoBaseline')
    && performanceStore.includes('autoCeiling')
    && performanceStore.includes('setAutoDecision')
    && performanceStore.includes('sustained measured performance'),
  'Performance state must retain a conservative baseline, device ceiling, and measured Auto decisions.'
)
requireContract(
  scenePerformanceManager.includes('useSceneLoadStage')
    && scenePerformanceManager.includes('SCENE_LOAD_STAGES.artifacts')
    && scenePerformanceManager.includes('AUTO_THRESHOLDS')
    && scenePerformanceManager.includes('promotionWindows')
    && scenePerformanceManager.includes('percentile95')
    && scenePerformanceManager.includes('__SOLAR_PERFORMANCE_POLICY__'),
  'ScenePerformanceManager must gate promotion on completed warmup and sustained FPS/P95 evidence.'
)
requireContract(
  !scenePerformanceManager.includes('applyFirstRunDefaults')
    && !scenePerformanceManager.includes('DEFAULTS_KEY'),
  'ScenePerformanceManager must not mutate one-time layer defaults; workload policy owns active limits.'
)

const requiredWorkloadSystems = [
  'nebula',
  'near-earth-objects',
  'kuiper-belt',
  'oort-cloud',
  'trojans',
  'centaurs',
  'scattered-disc',
  'phenomena',
  'solar-wind',
  'meteor-shower',
  'zodiacal-light',
  'gravity-wells',
  'black-hole',
  'wormhole',
]
requireContract(
  workloadPolicy.includes('SCENE_WORKLOAD_SYSTEMS')
    && workloadPolicy.includes('getSceneWorkloadSnapshot')
    && workloadPolicy.includes('useSceneSystemActive')
    && workloadPolicy.includes('minimumQuality')
    && requiredWorkloadSystems.every((system) => workloadPolicy.includes(`'${system}'`)),
  'The central workload policy must cover all expensive optional scene systems.'
)
requireContract(
  workloadScenes.every((source) => source.includes('useSceneSystemActive')),
  'Every optional scene group must consume the central quality-aware workload policy.'
)
requireContract(
  displaySettings.includes('Paused by quality')
    && displaySettings.includes('getSceneSystemLimitNote')
    && displaySettings.includes('switches stay saved'),
  'Display settings must distinguish saved preferences from quality-limited active workload.'
)
requireContract(
  runtimeSmoke.includes('__SOLAR_PERFORMANCE_POLICY__')
    && runtimeSmoke.includes('assertDesktopAutoBaseline')
    && runtimeSmoke.includes('assertEcoWorkloadPolicy')
    && runtimeSmoke.includes('PRESERVED_EXPLORE_SYSTEMS')
    && runtimeSmoke.includes('ECO_SUPPRESSED_SYSTEMS'),
  'Runtime smoke coverage must prove conservative Auto and Eco workload suppression with preference restoration.'
)

requireContract(
  textureManifest.includes('getTextureFallbackUrl')
    && textureManifest.includes('getTextureTierWidth(quality)')
    && textureManifest.includes('/textures/optimized/')
    && textureManifest.includes('quality: EffectiveQuality'),
  'Texture fallback URLs must contain an explicit 512/1024/2048 quality tier.'
)
requireContract(
  adaptiveTexture.includes('useTexture(fallbackUrl)')
    && adaptiveTexture.includes('retainFallbackTexture')
    && adaptiveTexture.includes('retainKtx2Texture')
    && adaptiveTexture.includes('lease.release()')
    && !adaptiveTexture.includes('CACHE_BY_RENDERER'),
  'useAdaptiveTexture must use explicit cache keys and reference-count both fallback and KTX2 leases.'
)
requireContract(
  textureResourceManager.includes('useTexture.clear')
    && textureResourceManager.includes('fallbackCacheEvictions')
    && textureResourceManager.includes('disposeRendererTextureResources')
    && textureResourceManager.includes('resources.loader.dispose()')
    && textureResourceManager.includes('__SOLAR_TEXTURE_LIFECYCLE__')
    && textureResourceManager.includes('consumers: Set<symbol>'),
  'The texture resource manager must evict old WebP tiers, dispose KTX2 records, terminate loaders, and publish lifecycle diagnostics.'
)
requireContract(
  textureLifecycleManager.includes('beginTier')
    && textureLifecycleManager.includes('setActiveTextureTier')
    && textureLifecycleManager.includes('disposeRendererTextureResources'),
  'TextureLifecycleManager must bind active tiers and KTX2 teardown to the Canvas lifecycle.'
)
requireContract(
  sceneContainer.includes('<TextureLifecycleManager />'),
  'SceneContainer must mount TextureLifecycleManager inside the production Canvas.'
)
requireContract(
  textureRuntimeStore.includes('quality: EffectiveQuality')
    && textureRuntimeStore.includes('tierWidth')
    && textureRuntimeStore.includes('beginTier')
    && textureRuntimeStore.includes('state.quality !== quality'),
  'Texture runtime diagnostics must reset per quality tier and reject stale asynchronous results.'
)
requireContract(
  textureSmoke.includes('Eco → Balanced → Ultra → Eco')
    && textureSmoke.includes('__SOLAR_TEXTURE_LIFECYCLE__')
    && textureSmoke.includes('fallbackCacheEvictions')
    && textureSmoke.includes('ktx2Disposals')
    && textureSmoke.includes('loaderDisposals')
    && textureSmoke.includes('Texture residency did not return to baseline'),
  'Texture lifecycle smoke coverage must cycle all tiers, prove eviction, and verify renderer-rebuild teardown.'
)

if (failures.length > 0) {
  console.error('[quality-gate] release contract failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`[quality-gate] release contract passed with Bun ${packageBunVersion}`)
  console.log(`[quality-gate] protected commands: ${workflowCommands.length}`)
  console.log('[quality-gate] measured scene loading is the only production startup scheduler')
  console.log('[quality-gate] Auto quality and optional scene workload remain independently governed')
  console.log('[quality-gate] adaptive textures use explicit tiers with bounded renderer-owned residency')
}
