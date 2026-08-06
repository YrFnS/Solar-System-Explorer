import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const pagePath = path.join(root, 'src', 'app', 'lab', 'device-acceptance', 'page.tsx')
const labPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'device-acceptance',
  'DeviceAcceptanceLab.tsx'
)
const protocolPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'device-acceptance',
  'device-acceptance-protocol.ts'
)
const sceneContainerPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'SceneContainer.tsx'
)
const smokePath = path.join(root, 'scripts', 'smoke-device-acceptance.mjs')
const packagePath = path.join(root, 'package.json')
const workflowPath = path.join(root, '.github', 'workflows', 'quality.yml')

const [
  page,
  lab,
  protocol,
  sceneContainer,
  smoke,
  packageSource,
  workflow,
] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(labPath, 'utf8'),
  readFile(protocolPath, 'utf8'),
  readFile(sceneContainerPath, 'utf8'),
  readFile(smokePath, 'utf8'),
  readFile(packagePath, 'utf8'),
  readFile(workflowPath, 'utf8'),
])

const packageJson = JSON.parse(packageSource)
const failures = []

function requireContract(condition, message) {
  if (!condition) failures.push(message)
}

requireContract(
  page.includes('DeviceAcceptanceLab')
    && page.includes('ssr: false'),
  'The device-acceptance route must load its client-only laboratory dynamically.'
)
requireContract(
  lab.includes('<SceneContainer interfaceMode="acceptance" />')
    && lab.includes('data-device-acceptance-lab'),
  'The acceptance lab must run the real production scene in acceptance interface mode.'
)
requireContract(
  lab.includes("startCapture('profile')")
    && lab.includes("startCapture('thermal')")
    && lab.includes('DEFAULT_THERMAL_DURATION_SECONDS = 15 * 60'),
  'The lab must retain profile and 15-minute thermal capture workflows.'
)
requireContract(
  lab.includes("getExtension('WEBGL_lose_context')")
    && lab.includes('WEBGL_CONTEXT_LOST_EVENT')
    && lab.includes('WEBGL_CONTEXT_RESTORED_EVENT'),
  'The lab must exercise and record WebGL context loss and recovery.'
)
requireContract(
  lab.includes('SCREENSHOT_CAPTURE_EVENT')
    && lab.includes('AcceptanceScreenshotEvidence'),
  'The lab must capture quality and orientation-specific visual evidence.'
)
requireContract(
  lab.includes('__SOLAR_EXPLORER_DIAGNOSTICS__')
    && lab.includes('__SOLAR_FRAME_PACING__')
    && lab.includes('__SOLAR_FRAME_LANES__')
    && lab.includes('__SOLAR_TEXTURE_LIFECYCLE__')
    && lab.includes('__SOLAR_ADAPTIVE_LOD__'),
  'The lab must collect the renderer, pacing, lane, texture, and LOD evidence required by P2.1.'
)
requireContract(
  lab.includes('__SOLAR_DEVICE_ACCEPTANCE__')
    && lab.includes('data-testid="acceptance-start-profile"')
    && lab.includes('data-testid="acceptance-session-count"'),
  'The lab must publish diagnostics and stable browser-test controls.'
)
requireContract(
  protocol.includes('solar-system-explorer-device-acceptance')
    && protocol.includes('summarizeAcceptanceSession')
    && protocol.includes('fpsDegradationPercent')
    && protocol.includes('laneClockInvariantPassed'),
  'The acceptance protocol must version evidence and analyze sustained FPS and lane invariants.'
)
requireContract(
  sceneContainer.includes("interfaceMode?: 'full' | 'acceptance'")
    && sceneContainer.includes("interfaceMode === 'full'"),
  'SceneContainer must support a clean acceptance presentation without changing the default explorer UI.'
)
requireContract(
  packageJson.scripts?.['device-acceptance:smoke']
    === 'node scripts/validate-device-acceptance.mjs && node scripts/smoke-device-acceptance.mjs',
  'package.json must expose the complete device-acceptance:smoke gate.'
)
requireContract(
  workflow.includes('bun run device-acceptance:smoke'),
  'The Quality workflow must execute the device-acceptance gate.'
)
requireContract(
  smoke.includes('/lab/device-acceptance')
    && smoke.includes('__SOLAR_DEVICE_ACCEPTANCE__')
    && smoke.includes('acceptance-fast=1'),
  'Browser coverage must exercise the physical-device acceptance route and a completed capture.'
)

if (failures.length > 0) {
  console.error('[device-acceptance-contract] failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log('[device-acceptance-contract] production scene, profile/thermal capture, recovery, screenshots, export, and browser evidence passed')
}
