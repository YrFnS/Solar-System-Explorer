import type { EffectiveQuality } from '../performance-store'

export const DEVICE_ACCEPTANCE_SCHEMA = 'solar-system-explorer-device-acceptance'
export const DEVICE_ACCEPTANCE_SCHEMA_VERSION = 1

export type AcceptanceDeviceClass =
  | 'integrated-laptop'
  | 'discrete-desktop'
  | 'android-phone'
  | 'other'

export type AcceptanceScenario = 'profile' | 'thermal'
export type AcceptanceVerdict = 'pass' | 'review' | 'fail'
export type AcceptanceCompletion = 'completed' | 'stopped'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface AcceptanceDeviceProfile {
  id: string
  label: string
  deviceClass: AcceptanceDeviceClass
  capturedAt: string
  userAgent: string
  platform: string
  language: string
  viewport: {
    width: number
    height: number
    devicePixelRatio: number
    orientation: string
  }
  screen: {
    width: number
    height: number
    colorDepth: number
  }
  capabilityHints: {
    hardwareConcurrency: number | null
    deviceMemoryGb: number | null
    maxTouchPoints: number
    coarsePointer: boolean
    saveData: boolean | null
    effectiveConnectionType: string | null
    standalone: boolean
    batteryApi: boolean
    webgpuApi: boolean
  }
  graphics: {
    api: 'webgl2' | 'webgl' | 'unavailable'
    vendor: string | null
    renderer: string | null
    version: string | null
    shadingLanguageVersion: string | null
  }
}

export interface AcceptanceBatterySnapshot {
  level: number
  charging: boolean
  chargingTimeSeconds: number | null
  dischargingTimeSeconds: number | null
}

export interface AcceptanceDiagnosticsSnapshot {
  explorer: JsonValue
  framePacing: JsonValue
  frameLanes: JsonValue
  sceneLoading: JsonValue
  performancePolicy: JsonValue
  textures: JsonValue
  textureLifecycle: JsonValue
  adaptiveLod: JsonValue
  simulationTiming: JsonValue
  smallBodies: JsonValue
}

export interface AcceptanceSample {
  capturedAt: string
  elapsedMs: number
  quality: EffectiveQuality
  visibility: DocumentVisibilityState
  orientation: string
  viewport: {
    width: number
    height: number
    devicePixelRatio: number
  }
  battery: AcceptanceBatterySnapshot | null
  usedJsHeapBytes: number | null
  diagnostics: AcceptanceDiagnosticsSnapshot
}

export type AcceptanceEventType =
  | 'capture-started'
  | 'capture-completed'
  | 'capture-stopped'
  | 'visibility-hidden'
  | 'visibility-visible'
  | 'orientation-change'
  | 'sleep-marker'
  | 'context-test-requested'
  | 'context-lost'
  | 'context-restored'
  | 'screenshot'
  | 'note'

export interface AcceptanceEvent {
  type: AcceptanceEventType
  capturedAt: string
  elapsedMs: number
  detail?: string
}

export interface AcceptanceScreenshotEvidence {
  id: string
  fileName: string
  capturedAt: string
  quality: EffectiveQuality
  orientation: string
  width: number
  height: number
}

export interface AcceptanceManualChecks {
  interactionResponsive: boolean
  visualParityEco: boolean
  visualParityBalanced: boolean
  visualParityUltra: boolean
  portraitApproved: boolean
  landscapeApproved: boolean
  sleepResumeApproved: boolean
  contextRecoveryApproved: boolean
  thermalApproved: boolean
  notes: string
}

export interface AcceptanceSessionSummary {
  verdict: AcceptanceVerdict
  reasons: string[]
  sampleCount: number
  durationSeconds: number
  completionRatio: number
  diagnosticsCoverage: number
  medianFps: number | null
  firstWindowMedianFps: number | null
  lastWindowMedianFps: number | null
  fpsDegradationPercent: number | null
  medianP95FrameIntervalMs: number | null
  maximumDispatchMs: number | null
  maximumLaneDispatchMs: number | null
  maximumDrawCalls: number | null
  maximumGeometries: number | null
  maximumTextures: number | null
  maximumUsedJsHeapBytes: number | null
  batteryDeltaPercent: number | null
  contextLosses: number
  contextRestores: number
  hiddenTransitions: number
  visibleTransitions: number
  laneClockInvariantPassed: boolean | null
}

export interface AcceptanceSession {
  id: string
  schema: typeof DEVICE_ACCEPTANCE_SCHEMA
  schemaVersion: typeof DEVICE_ACCEPTANCE_SCHEMA_VERSION
  scenario: AcceptanceScenario
  completion: AcceptanceCompletion
  targetDurationSeconds: number
  quality: EffectiveQuality
  startedAt: string
  endedAt: string
  device: AcceptanceDeviceProfile
  samples: AcceptanceSample[]
  events: AcceptanceEvent[]
  summary: AcceptanceSessionSummary
}

export interface AcceptanceEvidenceBundle {
  schema: typeof DEVICE_ACCEPTANCE_SCHEMA
  schemaVersion: typeof DEVICE_ACCEPTANCE_SCHEMA_VERSION
  generatedAt: string
  source: {
    route: string
    commitSha: string | null
  }
  device: AcceptanceDeviceProfile
  manualChecks: AcceptanceManualChecks
  screenshots: AcceptanceScreenshotEvidence[]
  sessions: AcceptanceSession[]
}

const REQUIRED_DIAGNOSTICS: Array<keyof AcceptanceDiagnosticsSnapshot> = [
  'explorer',
  'framePacing',
  'frameLanes',
  'sceneLoading',
  'textures',
  'adaptiveLod',
]

function asRecord(value: JsonValue): Record<string, JsonValue> | null {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
    ? value
    : null
}

function readDiagnosticValue(
  value: JsonValue,
  path: string[]
): JsonValue | undefined {
  let cursor: JsonValue = value

  for (const segment of path) {
    const record = asRecord(cursor)
    if (!record || !(segment in record)) return undefined
    cursor = record[segment]
  }

  return cursor
}

export function readDiagnosticNumber(
  value: JsonValue,
  ...path: string[]
): number | null {
  const result = readDiagnosticValue(value, path)
  return typeof result === 'number' && Number.isFinite(result) ? result : null
}

export function readDiagnosticBoolean(
  value: JsonValue,
  ...path: string[]
): boolean | null {
  const result = readDiagnosticValue(value, path)
  return typeof result === 'boolean' ? result : null
}

export function readDiagnosticString(
  value: JsonValue,
  ...path: string[]
): string | null {
  const result = readDiagnosticValue(value, path)
  return typeof result === 'string' ? result : null
}

function median(values: number[]) {
  if (values.length === 0) return null
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle]
}

function maximum(values: Array<number | null>) {
  const finite = values.filter((value): value is number => (
    value !== null && Number.isFinite(value)
  ))
  return finite.length > 0 ? Math.max(...finite) : null
}

function getFps(sample: AcceptanceSample) {
  return readDiagnosticNumber(sample.diagnostics.framePacing, 'actualFps')
}

function hasRequiredDiagnostics(sample: AcceptanceSample) {
  return REQUIRED_DIAGNOSTICS.every((key) => sample.diagnostics[key] !== null)
}

function getWindowMedian(values: number[], start: number, end: number) {
  if (values.length === 0) return null
  const from = Math.max(0, Math.floor(values.length * start))
  const to = Math.max(from + 1, Math.ceil(values.length * end))
  return median(values.slice(from, to))
}

function expectedFpsFloor(
  deviceClass: AcceptanceDeviceClass,
  quality: EffectiveQuality,
  targetFps: number | null
) {
  const ratioFloor = targetFps === null ? 0 : targetFps * 0.55
  const absoluteFloor = deviceClass === 'discrete-desktop'
    ? quality === 'ultra' ? 40 : 28
    : deviceClass === 'integrated-laptop'
      ? quality === 'ultra' ? 24 : 22
      : deviceClass === 'android-phone'
        ? quality === 'ultra' ? 12 : 18
        : 16
  return Math.max(absoluteFloor, ratioFloor)
}

export function summarizeAcceptanceSession(input: {
  scenario: AcceptanceScenario
  completion: AcceptanceCompletion
  targetDurationSeconds: number
  quality: EffectiveQuality
  deviceClass: AcceptanceDeviceClass
  samples: AcceptanceSample[]
  events: AcceptanceEvent[]
}): AcceptanceSessionSummary {
  const {
    scenario,
    completion,
    targetDurationSeconds,
    quality,
    deviceClass,
    samples,
    events,
  } = input
  const durationSeconds = samples.length > 0
    ? samples[samples.length - 1].elapsedMs / 1_000
    : 0
  const completionRatio = targetDurationSeconds > 0
    ? Math.min(1, durationSeconds / targetDurationSeconds)
    : 0
  const diagnosticsCoverage = samples.length > 0
    ? samples.filter(hasRequiredDiagnostics).length / samples.length
    : 0
  const fpsValues = samples
    .map(getFps)
    .filter((value): value is number => value !== null)
  const medianFps = median(fpsValues)
  const firstWindowMedianFps = getWindowMedian(fpsValues, 0, 0.2)
  const lastWindowMedianFps = getWindowMedian(fpsValues, 0.8, 1)
  const fpsDegradationPercent = firstWindowMedianFps !== null
    && lastWindowMedianFps !== null
    && firstWindowMedianFps > 0
    ? ((firstWindowMedianFps - lastWindowMedianFps) / firstWindowMedianFps) * 100
    : null
  const medianP95FrameIntervalMs = median(samples
    .map((sample) => readDiagnosticNumber(
      sample.diagnostics.framePacing,
      'p95FrameIntervalMs'
    ))
    .filter((value): value is number => value !== null))
  const maximumDispatchMs = maximum(samples.map((sample) => (
    readDiagnosticNumber(sample.diagnostics.frameLanes, 'maxDispatchMs')
  )))
  const maximumLaneDispatchMs = maximum(samples.flatMap((sample) => [
    readDiagnosticNumber(sample.diagnostics.frameLanes, 'lanes', 'critical', 'maxMs'),
    readDiagnosticNumber(sample.diagnostics.frameLanes, 'lanes', 'ephemeris', 'maxMs'),
    readDiagnosticNumber(sample.diagnostics.frameLanes, 'lanes', 'decorative', 'maxMs'),
  ]))
  const maximumDrawCalls = maximum(samples.map((sample) => (
    readDiagnosticNumber(sample.diagnostics.explorer, 'drawCalls')
  )))
  const maximumGeometries = maximum(samples.map((sample) => (
    readDiagnosticNumber(sample.diagnostics.explorer, 'geometries')
  )))
  const maximumTextures = maximum(samples.map((sample) => (
    readDiagnosticNumber(sample.diagnostics.explorer, 'textures')
  )))
  const maximumUsedJsHeapBytes = maximum(samples.map((sample) => sample.usedJsHeapBytes))
  const batterySamples = samples
    .map((sample) => sample.battery?.level ?? null)
    .filter((value): value is number => value !== null)
  const batteryDeltaPercent = batterySamples.length >= 2
    ? (batterySamples[0] - batterySamples[batterySamples.length - 1]) * 100
    : null
  const contextLosses = events.filter((event) => event.type === 'context-lost').length
  const contextRestores = events.filter((event) => event.type === 'context-restored').length
  const hiddenTransitions = events.filter((event) => event.type === 'visibility-hidden').length
  const visibleTransitions = events.filter((event) => event.type === 'visibility-visible').length
  const lastLaneSample = [...samples].reverse().find((sample) => (
    sample.diagnostics.frameLanes !== null
  ))
  const renderFrames = lastLaneSample
    ? readDiagnosticNumber(lastLaneSample.diagnostics.frameLanes, 'renderFrames')
    : null
  const sharedClockReads = lastLaneSample
    ? readDiagnosticNumber(lastLaneSample.diagnostics.frameLanes, 'sharedClockReads')
    : null
  const laneClockInvariantPassed = renderFrames === null || sharedClockReads === null
    ? null
    : renderFrames === sharedClockReads
  const latestTargetFps = [...samples].reverse()
    .map((sample) => readDiagnosticNumber(sample.diagnostics.framePacing, 'targetFps'))
    .find((value) => value !== null) ?? null
  const fpsFloor = expectedFpsFloor(deviceClass, quality, latestTargetFps)

  const reasons: string[] = []
  let verdict: AcceptanceVerdict = 'pass'

  const review = (reason: string) => {
    reasons.push(reason)
    if (verdict === 'pass') verdict = 'review'
  }
  const fail = (reason: string) => {
    reasons.push(reason)
    verdict = 'fail'
  }

  if (samples.length < 3) fail('The capture did not contain enough samples.')
  if (completion === 'stopped' || completionRatio < 0.9) {
    review(`The capture reached ${Math.round(completionRatio * 100)}% of its target duration.`)
  }
  if (diagnosticsCoverage < 0.6) {
    fail(`Required diagnostics were present in only ${Math.round(diagnosticsCoverage * 100)}% of samples.`)
  } else if (diagnosticsCoverage < 0.9) {
    review(`Required diagnostics were present in ${Math.round(diagnosticsCoverage * 100)}% of samples.`)
  }
  if (laneClockInvariantPassed === false) {
    fail('Frame-lane clock reads diverged from rendered frames.')
  } else if (laneClockInvariantPassed === null) {
    review('The frame-lane shared-clock invariant could not be evaluated.')
  }
  if (contextLosses > contextRestores) {
    fail('A WebGL context loss was not followed by a matching restore event.')
  }
  if (medianFps === null) {
    fail('No paced FPS samples were available.')
  } else if (medianFps < fpsFloor * 0.65) {
    fail(`Median FPS ${medianFps.toFixed(1)} was far below the ${fpsFloor.toFixed(1)} acceptance floor.`)
  } else if (medianFps < fpsFloor) {
    review(`Median FPS ${medianFps.toFixed(1)} was below the ${fpsFloor.toFixed(1)} acceptance floor.`)
  }
  if (maximumDispatchMs !== null && maximumDispatchMs > 25) {
    fail(`Frame-lane dispatch peaked at ${maximumDispatchMs.toFixed(1)} ms.`)
  } else if (maximumDispatchMs !== null && maximumDispatchMs > 12) {
    review(`Frame-lane dispatch peaked at ${maximumDispatchMs.toFixed(1)} ms.`)
  }
  if (scenario === 'thermal') {
    if (durationSeconds < 600) {
      review('Thermal acceptance requires at least ten minutes of captured evidence.')
    }
    if (fpsDegradationPercent !== null && fpsDegradationPercent > 30) {
      fail(`Sustained FPS declined by ${fpsDegradationPercent.toFixed(1)}%.`)
    } else if (fpsDegradationPercent !== null && fpsDegradationPercent > 20) {
      review(`Sustained FPS declined by ${fpsDegradationPercent.toFixed(1)}%.`)
    }
  }
  if (reasons.length === 0) {
    reasons.push('Automated runtime signals remained inside the acceptance envelope.')
  }

  return {
    verdict,
    reasons,
    sampleCount: samples.length,
    durationSeconds,
    completionRatio,
    diagnosticsCoverage,
    medianFps,
    firstWindowMedianFps,
    lastWindowMedianFps,
    fpsDegradationPercent,
    medianP95FrameIntervalMs,
    maximumDispatchMs,
    maximumLaneDispatchMs,
    maximumDrawCalls,
    maximumGeometries,
    maximumTextures,
    maximumUsedJsHeapBytes,
    batteryDeltaPercent,
    contextLosses,
    contextRestores,
    hiddenTransitions,
    visibleTransitions,
    laneClockInvariantPassed,
  }
}

export function createDefaultManualChecks(): AcceptanceManualChecks {
  return {
    interactionResponsive: false,
    visualParityEco: false,
    visualParityBalanced: false,
    visualParityUltra: false,
    portraitApproved: false,
    landscapeApproved: false,
    sleepResumeApproved: false,
    contextRecoveryApproved: false,
    thermalApproved: false,
    notes: '',
  }
}
