import {
  analyzeAcceptanceBundles,
  buildAcceptanceMarkdownReport,
  createAcceptanceReviewReport,
  parseAcceptancePayload,
} from '../src/components/solar-system/device-acceptance/device-acceptance-review'
import {
  DEVICE_ACCEPTANCE_SCHEMA,
  DEVICE_ACCEPTANCE_SCHEMA_VERSION,
  summarizeAcceptanceSession,
  type AcceptanceDeviceClass,
  type AcceptanceDeviceProfile,
  type AcceptanceEvidenceBundle,
  type AcceptanceEvent,
  type AcceptanceManualChecks,
  type AcceptanceSample,
  type AcceptanceScreenshotEvidence,
  type AcceptanceSession,
} from '../src/components/solar-system/device-acceptance/device-acceptance-protocol'
import type { EffectiveQuality } from '../src/components/solar-system/performance-store'

const commitSha = '0123456789abcdef0123456789abcdef01234567'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function device(
  deviceClass: AcceptanceDeviceClass,
  label: string
): AcceptanceDeviceProfile {
  return {
    id: `device-${deviceClass}`,
    label,
    deviceClass,
    capturedAt: '2026-08-06T08:00:00.000Z',
    userAgent: 'acceptance-fixture',
    platform: 'fixture',
    language: 'en',
    viewport: {
      width: deviceClass === 'android-phone' ? 390 : 1440,
      height: deviceClass === 'android-phone' ? 844 : 900,
      devicePixelRatio: deviceClass === 'android-phone' ? 2.75 : 1,
      orientation: deviceClass === 'android-phone'
        ? 'portrait-primary'
        : 'landscape-primary',
    },
    screen: {
      width: deviceClass === 'android-phone' ? 390 : 1440,
      height: deviceClass === 'android-phone' ? 844 : 900,
      colorDepth: 24,
    },
    capabilityHints: {
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      maxTouchPoints: deviceClass === 'android-phone' ? 5 : 0,
      coarsePointer: deviceClass === 'android-phone',
      saveData: false,
      effectiveConnectionType: '4g',
      standalone: false,
      batteryApi: true,
      webgpuApi: true,
    },
    graphics: {
      api: 'webgl2',
      vendor: 'Fixture GPU Vendor',
      renderer: `${label} renderer`,
      version: 'WebGL 2.0',
      shadingLanguageVersion: 'WebGL GLSL ES 3.00',
    },
  }
}

function targetFps(quality: EffectiveQuality) {
  if (quality === 'eco') return 30
  if (quality === 'balanced') return 45
  return 60
}

function sample(
  quality: EffectiveQuality,
  elapsedMs: number,
  fps: number,
  index: number
): AcceptanceSample {
  const target = targetFps(quality)
  const frames = 100 + index
  return {
    capturedAt: new Date(Date.parse('2026-08-06T08:00:00.000Z') + elapsedMs).toISOString(),
    elapsedMs,
    quality,
    visibility: 'visible',
    orientation: 'landscape-primary',
    viewport: { width: 1440, height: 900, devicePixelRatio: 1 },
    battery: {
      level: 0.9 - index * 0.001,
      charging: false,
      chargingTimeSeconds: null,
      dischargingTimeSeconds: 18_000,
    },
    usedJsHeapBytes: 96 * 1024 * 1024 + index * 128 * 1024,
    diagnostics: {
      explorer: {
        drawCalls: 206,
        triangles: 87392,
        geometries: 169,
        textures: 15,
        programs: 30,
        sceneObjects: 379,
      },
      framePacing: {
        actualFps: fps,
        targetFps: target,
        p95FrameIntervalMs: 1_000 / Math.max(1, fps) * 1.25,
      },
      frameLanes: {
        maxDispatchMs: 3.4,
        renderFrames: frames,
        sharedClockReads: frames,
        lanes: {
          critical: { maxMs: 0.4 },
          ephemeris: { maxMs: 2.2 },
          decorative: { maxMs: 0.8 },
        },
      },
      sceneLoading: { complete: true, stage: 6 },
      performancePolicy: { effectiveQuality: quality },
      textures: { quality, loadedIds: 13, failedIds: 0 },
      textureLifecycle: { residentTextures: 15 },
      adaptiveLod: { periodicSceneWalks: 0 },
      simulationTiming: { paused: false },
      smallBodies: { overviewBodies: 17, overviewFrameManagers: 1 },
    },
  }
}

function events(startedAt: string): AcceptanceEvent[] {
  return [
    { type: 'capture-started', capturedAt: startedAt, elapsedMs: 0 },
    { type: 'sleep-marker', capturedAt: startedAt, elapsedMs: 1_000 },
    { type: 'visibility-hidden', capturedAt: startedAt, elapsedMs: 2_000 },
    { type: 'visibility-visible', capturedAt: startedAt, elapsedMs: 3_000 },
    { type: 'context-test-requested', capturedAt: startedAt, elapsedMs: 4_000 },
    { type: 'context-lost', capturedAt: startedAt, elapsedMs: 4_100 },
    { type: 'context-restored', capturedAt: startedAt, elapsedMs: 5_700 },
    { type: 'capture-completed', capturedAt: startedAt, elapsedMs: 60_000 },
  ]
}

function session(
  profile: AcceptanceDeviceProfile,
  scenario: AcceptanceSession['scenario'],
  quality: EffectiveQuality,
  fps: number
): AcceptanceSession {
  const targetDurationSeconds = scenario === 'thermal' ? 600 : 60
  const sampleCount = scenario === 'thermal' ? 11 : 7
  const samples = Array.from({ length: sampleCount }, (_, index) => sample(
    quality,
    targetDurationSeconds * 1_000 * index / (sampleCount - 1),
    fps - (scenario === 'thermal' ? index * 0.02 : 0),
    index
  ))
  const startedAt = samples[0].capturedAt
  const capturedEvents = events(startedAt)
  const summary = summarizeAcceptanceSession({
    scenario,
    completion: 'completed',
    targetDurationSeconds,
    quality,
    deviceClass: profile.deviceClass,
    samples,
    events: capturedEvents,
  })
  return {
    id: `${profile.deviceClass}-${scenario}-${quality}`,
    schema: DEVICE_ACCEPTANCE_SCHEMA,
    schemaVersion: DEVICE_ACCEPTANCE_SCHEMA_VERSION,
    scenario,
    completion: 'completed',
    targetDurationSeconds,
    quality,
    startedAt,
    endedAt: samples.at(-1)?.capturedAt ?? startedAt,
    device: profile,
    samples,
    events: capturedEvents,
    summary,
  }
}

function manualChecks(): AcceptanceManualChecks {
  return {
    interactionResponsive: true,
    visualParityEco: true,
    visualParityBalanced: true,
    visualParityUltra: true,
    portraitApproved: true,
    landscapeApproved: true,
    sleepResumeApproved: true,
    contextRecoveryApproved: true,
    thermalApproved: true,
    notes: 'Fixture device remained cool and responsive.',
  }
}

function screenshots(deviceClass: AcceptanceDeviceClass) {
  const items: AcceptanceScreenshotEvidence[] = [
    {
      id: `${deviceClass}-eco`,
      fileName: `${deviceClass}-eco.webp`,
      capturedAt: '2026-08-06T08:01:00.000Z',
      quality: 'eco',
      orientation: deviceClass === 'android-phone'
        ? 'portrait-primary'
        : 'landscape-primary',
      width: 1280,
      height: 720,
    },
    {
      id: `${deviceClass}-balanced`,
      fileName: `${deviceClass}-balanced.webp`,
      capturedAt: '2026-08-06T08:02:00.000Z',
      quality: 'balanced',
      orientation: 'landscape-primary',
      width: 1280,
      height: 720,
    },
    {
      id: `${deviceClass}-ultra`,
      fileName: `${deviceClass}-ultra.webp`,
      capturedAt: '2026-08-06T08:03:00.000Z',
      quality: 'ultra',
      orientation: 'landscape-primary',
      width: 1280,
      height: 720,
    },
  ]
  return items
}

function bundle(
  deviceClass: 'integrated-laptop' | 'discrete-desktop' | 'android-phone',
  quality: EffectiveQuality,
  fps: number
): AcceptanceEvidenceBundle {
  const profile = device(deviceClass, `Fixture ${deviceClass}`)
  return {
    schema: DEVICE_ACCEPTANCE_SCHEMA,
    schemaVersion: DEVICE_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: '2026-08-06T08:20:00.000Z',
    source: { route: '/lab/device-acceptance', commitSha },
    device: profile,
    manualChecks: manualChecks(),
    screenshots: screenshots(deviceClass),
    sessions: [
      session(profile, 'profile', quality, fps),
      session(profile, 'thermal', quality, fps),
    ],
  }
}

const readyBundles = [
  bundle('integrated-laptop', 'balanced', 42),
  bundle('discrete-desktop', 'ultra', 58),
  bundle('android-phone', 'eco', 28),
]

const ready = analyzeAcceptanceBundles(readyBundles)
assert(ready.verdict === 'ready', `Expected ready, received ${ready.verdict}: ${ready.blockers.join('; ')} ${ready.warnings.join('; ')}`)
assert(ready.readyDeviceCount === 3, 'All three device classes should be ready.')
assert(ready.commitShas.length === 1, 'Ready evidence should use one commit SHA.')

const missingPhone = analyzeAcceptanceBundles(readyBundles.slice(0, 2))
assert(missingPhone.verdict === 'blocked', 'Missing Android evidence must block merge readiness.')
assert(missingPhone.missingDeviceClasses.includes('android-phone'), 'Android class should be reported missing.')

const mixedCommitBundles = structuredClone(readyBundles)
mixedCommitBundles[1].source.commitSha = 'ffffffffffffffffffffffffffffffffffffffff'
const mixedCommit = analyzeAcceptanceBundles(mixedCommitBundles)
assert(mixedCommit.verdict === 'blocked', 'Mixed commit evidence must block merge readiness.')
assert(mixedCommit.commitShas.length === 2, 'Both commit SHAs should be reported.')

const missingLandscapeBundles = structuredClone(readyBundles)
missingLandscapeBundles[2].screenshots = missingLandscapeBundles[2].screenshots.map((item) => ({
  ...item,
  orientation: 'portrait-primary',
}))
const missingLandscape = analyzeAcceptanceBundles(missingLandscapeBundles)
assert(missingLandscape.verdict === 'blocked', 'Missing Android landscape evidence must block readiness.')

const parseReady = parseAcceptancePayload({ bundles: readyBundles })
assert(parseReady.errors.length === 0 && parseReady.bundles.length === 3, 'Valid review payload should parse all bundles.')
const parseInvalid = parseAcceptancePayload({ schema: 'wrong' })
assert(parseInvalid.bundles.length === 0 && parseInvalid.errors.length === 1, 'Invalid schema should be rejected.')

const report = createAcceptanceReviewReport(readyBundles)
assert(report.analysis.verdict === 'ready', 'Export report should retain the ready verdict.')
const markdown = buildAcceptanceMarkdownReport(ready)
assert(markdown.includes('Overall verdict: **READY**'), 'Markdown report should contain the overall verdict.')
assert(markdown.includes('Integrated-graphics laptop'), 'Markdown report should contain the device matrix.')

console.log('[device-acceptance-review] parser, three-device matrix, commit provenance, orientation gate, and report export passed')
