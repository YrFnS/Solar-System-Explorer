import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const packageJsonPath = path.join(root, 'package.json')
const workflowPath = path.join(root, '.github', 'workflows', 'quality.yml')

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
const workflow = (await readFile(workflowPath, 'utf8')).replace(/\r\n/g, '\n')
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

if (failures.length > 0) {
  console.error('[quality-gate] release contract failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`[quality-gate] release contract passed with Bun ${packageBunVersion}`)
  console.log(`[quality-gate] protected commands: ${workflowCommands.length}`)
}
