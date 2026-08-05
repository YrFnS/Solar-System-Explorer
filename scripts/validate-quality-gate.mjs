import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const packageJsonPath = path.join(root, 'package.json')
const workflowPath = path.join(root, '.github', 'workflows', 'quality.yml')
const sceneContainerPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'SceneContainer.tsx'
)
const solarSystemPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'SolarSystemV3.tsx'
)
const sceneSchedulerPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'SceneLoadScheduler.tsx'
)
const removedWarmupPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'ProgressiveSceneWarmup.tsx'
)
const runtimeSmokePath = path.join(root, 'scripts', 'smoke-runtime-foundation.mjs')

const [
  packageJsonSource,
  workflowSource,
  sceneContainer,
  solarSystem,
  sceneScheduler,
  runtimeSmoke,
] = await Promise.all([
  readFile(packageJsonPath, 'utf8'),
  readFile(workflowPath, 'utf8'),
  readFile(sceneContainerPath, 'utf8'),
  readFile(solarSystemPath, 'utf8'),
  readFile(sceneSchedulerPath, 'utf8'),
  readFile(runtimeSmokePath, 'utf8'),
])

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
  packageJson.scripts?.['runtime:smoke'] === 'node scripts/smoke-runtime-foundation.mjs',
  'package.json must expose runtime:smoke through scripts/smoke-runtime-foundation.mjs.'
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

if (failures.length > 0) {
  console.error('[quality-gate] release contract failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`[quality-gate] release contract passed with Bun ${packageBunVersion}`)
  console.log(`[quality-gate] protected commands: ${workflowCommands.length}`)
  console.log('[quality-gate] measured scene loading is the only production startup scheduler')
}
