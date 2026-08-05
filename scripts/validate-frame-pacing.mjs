import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const read = (filePath) => readFile(path.join(root, filePath), 'utf8')

const [
  packageJsonSource,
  sceneContainer,
  pacingController,
  pacingPolicy,
  performanceStore,
  performanceManager,
  simulationController,
  cameraController,
  browserSmoke,
] = await Promise.all([
  read('package.json'),
  read('src/components/solar-system/SceneContainer.tsx'),
  read('src/components/solar-system/FramePacingController.tsx'),
  read('src/components/solar-system/frame-pacing-policy.ts'),
  read('src/components/solar-system/performance-store.ts'),
  read('src/components/solar-system/ScenePerformanceManager.tsx'),
  read('src/components/solar-system/SimulationController.tsx'),
  read('src/components/solar-system/EphemerisCameraController.tsx'),
  read('scripts/smoke-frame-pacing.mjs'),
])

const packageJson = JSON.parse(packageJsonSource)
const failures = []
const requireContract = (condition, message) => {
  if (!condition) failures.push(message)
}

requireContract(
  sceneContainer.includes('frameloop="never"')
    && sceneContainer.includes('<FramePacingController')
    && !sceneContainer.includes('frameloop="always"'),
  'SceneContainer must give one manual controller exclusive ownership of the render loop.'
)
requireContract(
  sceneContainer.includes('powerPreference: rendererPowerPreference')
    && sceneContainer.includes("preset === 'ultra'")
    && sceneContainer.includes("'low-power'"),
  'Renderer creation must request low power outside a manually selected Ultra profile.'
)
requireContract(
  pacingController.includes('advance(timestamp / 1_000, true)')
    && pacingController.includes('FRAME_PACING_ACTIVITY_EVENT')
    && pacingController.includes('visibilitychange')
    && pacingController.includes('__SOLAR_FRAME_PACING__')
    && pacingController.includes('renderedWhileHidden')
    && pacingController.includes("return 'static'")
    && pacingController.includes("return 'idle'"),
  'FramePacingController must pass seconds to R3F, coordinate activity, suspend visibility, and publish evidence.'
)
requireContract(
  pacingPolicy.includes('activeFps: 30')
    && pacingPolicy.includes('activeFps: 45')
    && pacingPolicy.includes('activeFps: 60')
    && pacingPolicy.includes('idleFps: 24')
    && pacingPolicy.includes('idleFps: 30')
    && pacingPolicy.includes('idleFps: 45')
    && pacingPolicy.includes("powerPreference: 'low-power'")
    && pacingPolicy.includes("powerPreference: 'high-performance'"),
  'Frame pacing policy must retain Eco 30, Balanced 45, Ultra 60, stepped idle rates, and explicit power hints.'
)
requireContract(
  performanceStore.includes('frameMode: FramePacingMode')
    && performanceStore.includes('frameTargetFps: number')
    && performanceStore.includes('setFramePacingStatus'),
  'Performance state must expose the live frame mode and target to the interface and Auto policy.'
)
requireContract(
  !performanceManager.includes('setFrameloop')
    && performanceManager.includes("frameMode === 'static'")
    && performanceManager.includes('promotionFps: 27')
    && performanceManager.includes('promotionFps: 40'),
  'Adaptive quality must not own a second loop and must benchmark against paced targets.'
)
requireContract(
  simulationController.includes('performance.now()')
    && simulationController.includes('activeWallSeconds')
    && simulationController.includes('__SOLAR_SIMULATION_TIMING__')
    && simulationController.includes('NORMAL_UI_PUBLISH_INTERVAL_SECONDS = 1')
    && simulationController.includes('FRAME_PACING_RESUME_EVENT'),
  'Simulation timing must derive from monotonic wall time, publish at a lower UI cadence, and reset after visibility suspension.'
)
requireContract(
  cameraController.includes('requestPacedFrame')
    && cameraController.includes("'camera-focus'")
    && cameraController.includes("'orbit-controls'"),
  'Camera motion must request work through the central pacing activity channel.'
)
requireContract(
  browserSmoke.includes('Page.setWebLifecycleState')
    && browserSmoke.includes('__SOLAR_FRAME_PACING__')
    && browserSmoke.includes('__SOLAR_SIMULATION_TIMING__')
    && browserSmoke.includes('powerPreference')
    && browserSmoke.includes('assertCadence')
    && browserSmoke.includes('assertSimulationRate'),
  'Production browser coverage must verify cadence, visibility suspension, power hints, and simulation-rate independence.'
)
requireContract(
  packageJson.scripts?.['frame-pacing:smoke']
    === 'node scripts/validate-frame-pacing.mjs && node scripts/smoke-frame-pacing.mjs',
  'package.json must expose the complete frame-pacing gate.'
)
requireContract(
  packageJson.scripts?.['ui:smoke']?.includes('bun run frame-pacing:smoke'),
  'The main production UI gate must run frame-pacing coverage.'
)

if (failures.length > 0) {
  console.error('[frame-pacing-contract] failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log('[frame-pacing-contract] manual loop ownership, second-based R3F time, cadence policy, wall-time simulation, and browser evidence passed')
}
