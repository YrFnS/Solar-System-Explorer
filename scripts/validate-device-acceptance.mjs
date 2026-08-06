import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const deviceAcceptanceRoot = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'device-acceptance'
)
const pagePath = path.join(root, 'src', 'app', 'lab', 'device-acceptance', 'page.tsx')
const launchPagePath = path.join(
  root,
  'src',
  'app',
  'lab',
  'device-acceptance',
  'launch',
  'page.tsx'
)
const resultsPagePath = path.join(
  root,
  'src',
  'app',
  'lab',
  'device-acceptance',
  'results',
  'page.tsx'
)
const labPath = path.join(deviceAcceptanceRoot, 'DeviceAcceptanceLab.tsx')
const launchPath = path.join(deviceAcceptanceRoot, 'DeviceAcceptanceLaunch.tsx')
const launchProtocolPath = path.join(
  deviceAcceptanceRoot,
  'device-acceptance-launch.ts'
)
const resultsPath = path.join(deviceAcceptanceRoot, 'DeviceAcceptanceResults.tsx')
const protocolPath = path.join(
  deviceAcceptanceRoot,
  'device-acceptance-protocol.ts'
)
const reviewPath = path.join(
  deviceAcceptanceRoot,
  'device-acceptance-review.ts'
)
const sceneContainerPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'SceneContainer.tsx'
)
const smokePath = path.join(root, 'scripts', 'smoke-device-acceptance.mjs')
const launchValidatePath = path.join(
  root,
  'scripts',
  'validate-device-acceptance-launch.ts'
)
const launchSmokePath = path.join(
  root,
  'scripts',
  'smoke-device-acceptance-launch.mjs'
)
const servePath = path.join(root, 'scripts', 'serve-device-acceptance.mjs')
const reviewValidatePath = path.join(
  root,
  'scripts',
  'validate-device-acceptance-review.ts'
)
const reviewSmokePath = path.join(
  root,
  'scripts',
  'smoke-device-acceptance-review.mjs'
)
const packagePath = path.join(root, 'package.json')
const workflowPath = path.join(root, '.github', 'workflows', 'quality.yml')

const [
  page,
  launchPage,
  resultsPage,
  lab,
  launch,
  launchProtocol,
  results,
  protocol,
  review,
  sceneContainer,
  smoke,
  launchValidate,
  launchSmoke,
  serve,
  reviewValidate,
  reviewSmoke,
  packageSource,
  workflow,
] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(launchPagePath, 'utf8'),
  readFile(resultsPagePath, 'utf8'),
  readFile(labPath, 'utf8'),
  readFile(launchPath, 'utf8'),
  readFile(launchProtocolPath, 'utf8'),
  readFile(resultsPath, 'utf8'),
  readFile(protocolPath, 'utf8'),
  readFile(reviewPath, 'utf8'),
  readFile(sceneContainerPath, 'utf8'),
  readFile(smokePath, 'utf8'),
  readFile(launchValidatePath, 'utf8'),
  readFile(launchSmokePath, 'utf8'),
  readFile(servePath, 'utf8'),
  readFile(reviewValidatePath, 'utf8'),
  readFile(reviewSmokePath, 'utf8'),
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
    && page.includes('ssr: false')
    && page.includes('/lab/device-acceptance/results'),
  'The device-acceptance route must load the client-only capture lab and link to evidence review.'
)
requireContract(
  launchPage.includes('DeviceAcceptanceLaunch')
    && launchPage.includes('ssr: false'),
  'The device campaign route must load its client-only launcher dynamically.'
)
requireContract(
  resultsPage.includes('DeviceAcceptanceResults')
    && resultsPage.includes('ssr: false'),
  'The device-acceptance results route must load its client-only review workspace dynamically.'
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
  launch.includes('data-device-acceptance-launch')
    && launch.includes('ACCEPTANCE_LAUNCH_DEVICE_CONFIGS')
    && launch.includes('DEVICE_ACCEPTANCE_CAPTURE_BACKUP_STORAGE_KEY')
    && launch.includes('__SOLAR_DEVICE_ACCEPTANCE_LAUNCH__')
    && launch.includes('/lab/device-acceptance/results')
    && launch.includes('launch-open-'),
  'The campaign launcher must generate the three device links, protect older evidence, publish diagnostics, and link to review.'
)
requireContract(
  launchProtocol.includes("'integrated-laptop'")
    && launchProtocol.includes("'discrete-desktop'")
    && launchProtocol.includes("'android-phone'")
    && launchProtocol.includes("recommendedQuality: 'balanced'")
    && launchProtocol.includes("recommendedQuality: 'ultra'")
    && launchProtocol.includes("recommendedQuality: 'eco'")
    && launchProtocol.includes('prepareAcceptanceLaunch')
    && launchProtocol.includes('backup'),
  'The campaign protocol must map all required devices to primary profiles and support clean-workspace backup.'
)
requireContract(
  launchValidate.includes('fresh.backup?.sessions.length')
    && launchValidate.includes('preserved.workspace.sessions.length')
    && launchValidate.includes('unsupported-device'),
  'Pure launcher validation must cover fresh backup, preserved evidence, and invalid device links.'
)
requireContract(
  launchSmoke.includes('/lab/device-acceptance/launch?campaign=smoke-campaign')
    && launchSmoke.includes('generatedLinkCount === 3')
    && launchSmoke.includes('assertNoPageOverflow')
    && launchSmoke.includes('Previous local evidence was not backed up'),
  'Browser launcher coverage must verify three links, responsive layout, device bootstrap, and evidence backup.'
)
requireContract(
  serve.includes('networkInterfaces()')
    && serve.includes("HOSTNAME: host")
    && serve.includes("'/lab/device-acceptance/launch'")
    && serve.includes("'/lab/device-acceptance/results'")
    && serve.includes("await cp(path.resolve(root, 'public')")
    && serve.includes("path.resolve(root, '.next', 'static')"),
  'The acceptance server must prepare standalone assets, bind for LAN access, and print launcher/review URLs.'
)

requireContract(
  results.includes('data-device-acceptance-review')
    && results.includes('__SOLAR_DEVICE_ACCEPTANCE_REVIEW__')
    && results.includes('review-export-json')
    && results.includes('review-export-markdown')
    && results.includes('REQUIRED_ACCEPTANCE_DEVICE_CLASSES'),
  'The results workspace must expose the cross-device matrix, diagnostics, and report exports.'
)
requireContract(
  review.includes("'integrated-laptop'")
    && review.includes("'discrete-desktop'")
    && review.includes("'android-phone'")
    && review.includes('analyzeAcceptanceBundles')
    && review.includes('missingDeviceClasses')
    && review.includes('commitShas')
    && review.includes('calculateResourceDrift')
    && review.includes('buildAcceptanceMarkdownReport'),
  'The review engine must enforce the three-device matrix, provenance, resource stability, and report generation.'
)
requireContract(
  reviewValidate.includes("ready.verdict === 'ready'")
    && reviewValidate.includes('missingPhone.verdict')
    && reviewValidate.includes('mixedCommit.verdict')
    && reviewValidate.includes('missingLandscape.verdict'),
  'Pure review validation must cover ready, missing-device, mixed-commit, and Android-orientation outcomes.'
)
requireContract(
  reviewSmoke.includes('/lab/device-acceptance/results')
    && reviewSmoke.includes('__SOLAR_DEVICE_ACCEPTANCE_REVIEW__')
    && reviewSmoke.includes('readyDeviceCount === 3')
    && reviewSmoke.includes('assertNoPageOverflow'),
  'Browser review coverage must exercise the ready three-device matrix and responsive layout.'
)

const expectedAcceptanceCommand = [
  'node scripts/validate-device-acceptance.mjs',
  'node scripts/smoke-device-acceptance.mjs',
  'bun run device-acceptance-launch:validate',
  'bun run device-acceptance-launch:smoke',
  'bun run device-acceptance-review:validate',
  'bun run device-acceptance-review:smoke',
].join(' && ')
requireContract(
  packageJson.scripts?.['device-acceptance:smoke'] === expectedAcceptanceCommand,
  'package.json must expose the complete capture, launch, and review device-acceptance:smoke gate.'
)
requireContract(
  packageJson.scripts?.['device-acceptance-launch:validate']
    === 'bun scripts/validate-device-acceptance-launch.ts'
    && packageJson.scripts?.['device-acceptance-launch:smoke']
      === 'node scripts/smoke-device-acceptance-launch.mjs',
  'package.json must expose the pure and browser campaign-launch gates.'
)
requireContract(
  packageJson.scripts?.['device-acceptance-review:validate']
    === 'bun scripts/validate-device-acceptance-review.ts'
    && packageJson.scripts?.['device-acceptance-review:smoke']
      === 'node scripts/smoke-device-acceptance-review.mjs',
  'package.json must expose the pure and browser review gates.'
)
requireContract(
  packageJson.scripts?.['acceptance:serve']
    === 'node scripts/serve-device-acceptance.mjs'
    && packageJson.scripts?.['acceptance:preview']
      === 'bun run build && bun run acceptance:serve',
  'package.json must expose production LAN acceptance server commands.'
)
requireContract(
  packageJson.scripts?.['quality:local']?.includes('bun run device-acceptance:smoke'),
  'quality:local must execute the complete acceptance gate.'
)
requireContract(
  workflow.includes('bun run device-acceptance:smoke')
    && workflow.includes('physical-device capture, launch, and review workspaces'),
  'The Quality workflow must execute and name the complete capture, launch, and review gate.'
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
  console.log('[device-acceptance-contract] production capture, campaign launch, LAN serving, three-device review, provenance, reports, and browser evidence passed')
}
