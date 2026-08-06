import type { EffectiveQuality } from '../performance-store'
import {
  createDefaultManualChecks,
  DEVICE_ACCEPTANCE_SCHEMA,
  DEVICE_ACCEPTANCE_SCHEMA_VERSION,
  readDiagnosticNumber,
  summarizeAcceptanceSession,
  type AcceptanceDeviceClass,
  type AcceptanceDeviceProfile,
  type AcceptanceEvidenceBundle,
  type AcceptanceEvent,
  type AcceptanceManualChecks,
  type AcceptanceSample,
  type AcceptanceScreenshotEvidence,
  type AcceptanceSession,
} from './device-acceptance-protocol'

export const DEVICE_ACCEPTANCE_REVIEW_SCHEMA =
  'solar-system-explorer-device-acceptance-review'
export const DEVICE_ACCEPTANCE_REVIEW_SCHEMA_VERSION = 1
export const DEVICE_ACCEPTANCE_WORKSPACE_STORAGE_KEY =
  'solar-explorer-device-acceptance-v1'
export const DEVICE_ACCEPTANCE_REVIEW_STORAGE_KEY =
  'solar-explorer-device-acceptance-review-v1'

export const REQUIRED_ACCEPTANCE_DEVICE_CLASSES = [
  'integrated-laptop',
  'discrete-desktop',
  'android-phone',
] as const satisfies readonly AcceptanceDeviceClass[]

export type RequiredAcceptanceDeviceClass =
  (typeof REQUIRED_ACCEPTANCE_DEVICE_CLASSES)[number]
export type AcceptanceReviewVerdict = 'ready' | 'review' | 'blocked'
export type AcceptanceRequirementStatus = 'pass' | 'review' | 'fail'

export interface AcceptanceRequirement {
  id: string
  label: string
  status: AcceptanceRequirementStatus
  detail: string
}

export interface AcceptanceResourceDrift {
  textureDelta: number | null
  geometryDelta: number | null
  heapDeltaBytes: number | null
  heapDeltaPercent: number | null
}

export interface AcceptanceDeviceReview {
  deviceClass: RequiredAcceptanceDeviceClass
  label: string
  renderer: string | null
  expectedPrimaryQuality: EffectiveQuality
  verdict: AcceptanceReviewVerdict
  bundleCount: number
  sessionCount: number
  screenshotCount: number
  primarySession: AcceptanceSession | null
  thermalSession: AcceptanceSession | null
  screenshotQualities: EffectiveQuality[]
  orientations: string[]
  requirements: AcceptanceRequirement[]
  blockers: string[]
  warnings: string[]
  resourceDrift: AcceptanceResourceDrift
}

export interface AcceptanceMergeReadiness {
  schema: typeof DEVICE_ACCEPTANCE_REVIEW_SCHEMA
  schemaVersion: typeof DEVICE_ACCEPTANCE_REVIEW_SCHEMA_VERSION
  generatedAt: string
  verdict: AcceptanceReviewVerdict
  bundleCount: number
  requiredDeviceCount: number
  readyDeviceCount: number
  reviewDeviceCount: number
  blockedDeviceCount: number
  devices: AcceptanceDeviceReview[]
  missingDeviceClasses: RequiredAcceptanceDeviceClass[]
  commitShas: string[]
  blockers: string[]
  warnings: string[]
}

export interface AcceptanceBundleParseResult {
  bundles: AcceptanceEvidenceBundle[]
  errors: string[]
}

export interface AcceptanceReviewReport {
  schema: typeof DEVICE_ACCEPTANCE_REVIEW_SCHEMA
  schemaVersion: typeof DEVICE_ACCEPTANCE_REVIEW_SCHEMA_VERSION
  generatedAt: string
  analysis: AcceptanceMergeReadiness
  bundles: AcceptanceEvidenceBundle[]
}

const DEVICE_LABELS: Record<RequiredAcceptanceDeviceClass, string> = {
  'integrated-laptop': 'Integrated-graphics laptop',
  'discrete-desktop': 'Discrete-GPU desktop',
  'android-phone': 'Android phone',
}

const PRIMARY_QUALITY: Record<RequiredAcceptanceDeviceClass, EffectiveQuality> = {
  'integrated-laptop': 'balanced',
  'discrete-desktop': 'ultra',
  'android-phone': 'eco',
}

const QUALITIES: EffectiveQuality[] = ['eco', 'balanced', 'ultra']
const DEVICE_CLASSES: AcceptanceDeviceClass[] = [
  ...REQUIRED_ACCEPTANCE_DEVICE_CLASSES,
  'other',
]
const SCENARIOS = ['profile', 'thermal'] as const
const COMPLETIONS = ['completed', 'stopped'] as const
const EVENT_TYPES = [
  'capture-started',
  'capture-completed',
  'capture-stopped',
  'visibility-hidden',
  'visibility-visible',
  'orientation-change',
  'sleep-marker',
  'context-test-requested',
  'context-lost',
  'context-restored',
  'screenshot',
  'note',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isQuality(value: unknown): value is EffectiveQuality {
  return QUALITIES.includes(value as EffectiveQuality)
}

function isDeviceClass(value: unknown): value is AcceptanceDeviceClass {
  return DEVICE_CLASSES.includes(value as AcceptanceDeviceClass)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function normalizeManualChecks(value: unknown): AcceptanceManualChecks {
  const source = isRecord(value) ? value : {}
  const defaults = createDefaultManualChecks()
  return {
    interactionResponsive: source.interactionResponsive === true,
    visualParityEco: source.visualParityEco === true,
    visualParityBalanced: source.visualParityBalanced === true,
    visualParityUltra: source.visualParityUltra === true,
    portraitApproved: source.portraitApproved === true,
    landscapeApproved: source.landscapeApproved === true,
    sleepResumeApproved: source.sleepResumeApproved === true,
    contextRecoveryApproved: source.contextRecoveryApproved === true,
    thermalApproved: source.thermalApproved === true,
    notes: typeof source.notes === 'string' ? source.notes : defaults.notes,
  }
}

function normalizeDevice(value: unknown): AcceptanceDeviceProfile | null {
  if (!isRecord(value) || !isDeviceClass(value.deviceClass)) return null
  if (typeof value.id !== 'string' || typeof value.label !== 'string') return null
  if (!isIsoDate(value.capturedAt)) return null
  if (!isRecord(value.viewport) || !isRecord(value.screen)) return null
  if (!isRecord(value.capabilityHints) || !isRecord(value.graphics)) return null
  return value as unknown as AcceptanceDeviceProfile
}

function normalizeSample(value: unknown): AcceptanceSample | null {
  if (!isRecord(value)) return null
  if (!isIsoDate(value.capturedAt) || !isFiniteNumber(value.elapsedMs)) return null
  if (!isQuality(value.quality) || !isRecord(value.viewport)) return null
  if (!isRecord(value.diagnostics)) return null
  return value as unknown as AcceptanceSample
}

function normalizeEvent(value: unknown): AcceptanceEvent | null {
  if (!isRecord(value)) return null
  if (!(EVENT_TYPES as readonly unknown[]).includes(value.type)) return null
  if (!isIsoDate(value.capturedAt) || !isFiniteNumber(value.elapsedMs)) return null
  return value as unknown as AcceptanceEvent
}

function normalizeSession(
  value: unknown,
  fallbackDevice: AcceptanceDeviceProfile
): AcceptanceSession | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string') return null
  if (!(SCENARIOS as readonly unknown[]).includes(value.scenario)) return null
  if (!(COMPLETIONS as readonly unknown[]).includes(value.completion)) return null
  if (!isFiniteNumber(value.targetDurationSeconds) || !isQuality(value.quality)) return null
  if (!isIsoDate(value.startedAt) || !isIsoDate(value.endedAt)) return null
  if (!Array.isArray(value.samples) || !Array.isArray(value.events)) return null

  const samples = value.samples
    .map(normalizeSample)
    .filter((sample): sample is AcceptanceSample => sample !== null)
  const events = value.events
    .map(normalizeEvent)
    .filter((event): event is AcceptanceEvent => event !== null)
  if (samples.length !== value.samples.length || events.length !== value.events.length) {
    return null
  }

  const device = normalizeDevice(value.device) ?? fallbackDevice
  const scenario = value.scenario as AcceptanceSession['scenario']
  const completion = value.completion as AcceptanceSession['completion']
  const quality = value.quality as EffectiveQuality
  const summary = summarizeAcceptanceSession({
    scenario,
    completion,
    targetDurationSeconds: value.targetDurationSeconds,
    quality,
    deviceClass: device.deviceClass,
    samples,
    events,
  })

  return {
    id: value.id,
    schema: DEVICE_ACCEPTANCE_SCHEMA,
    schemaVersion: DEVICE_ACCEPTANCE_SCHEMA_VERSION,
    scenario,
    completion,
    targetDurationSeconds: value.targetDurationSeconds,
    quality,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    device,
    samples,
    events,
    summary,
  }
}

function normalizeScreenshot(value: unknown): AcceptanceScreenshotEvidence | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.fileName !== 'string') return null
  if (!isIsoDate(value.capturedAt) || !isQuality(value.quality)) return null
  if (typeof value.orientation !== 'string') return null
  if (!isFiniteNumber(value.width) || !isFiniteNumber(value.height)) return null
  return value as unknown as AcceptanceScreenshotEvidence
}

function parseBundle(value: unknown, label: string) {
  if (!isRecord(value)) return { error: `${label}: expected a JSON object.` }
  if (value.schema !== DEVICE_ACCEPTANCE_SCHEMA) {
    return { error: `${label}: unsupported schema.` }
  }
  if (value.schemaVersion !== DEVICE_ACCEPTANCE_SCHEMA_VERSION) {
    return { error: `${label}: unsupported schema version.` }
  }
  if (!isIsoDate(value.generatedAt)) {
    return { error: `${label}: generatedAt was missing or invalid.` }
  }

  const device = normalizeDevice(value.device)
  if (!device) return { error: `${label}: device profile was invalid.` }
  if (!Array.isArray(value.sessions) || !Array.isArray(value.screenshots)) {
    return { error: `${label}: sessions or screenshots were invalid.` }
  }
  const sessions = value.sessions
    .map((session) => normalizeSession(session, device))
    .filter((session): session is AcceptanceSession => session !== null)
  const screenshots = value.screenshots
    .map(normalizeScreenshot)
    .filter((screenshot): screenshot is AcceptanceScreenshotEvidence => screenshot !== null)
  if (sessions.length !== value.sessions.length) {
    return { error: `${label}: one or more sessions were malformed.` }
  }
  if (screenshots.length !== value.screenshots.length) {
    return { error: `${label}: one or more screenshot records were malformed.` }
  }
  const source = isRecord(value.source) ? value.source : {}
  const bundle: AcceptanceEvidenceBundle = {
    schema: DEVICE_ACCEPTANCE_SCHEMA,
    schemaVersion: DEVICE_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: value.generatedAt,
    source: {
      route: typeof source.route === 'string'
        ? source.route
        : '/lab/device-acceptance',
      commitSha: typeof source.commitSha === 'string'
        ? source.commitSha
        : null,
    },
    device,
    manualChecks: normalizeManualChecks(value.manualChecks),
    screenshots,
    sessions,
  }
  return { bundle }
}

export function parseAcceptancePayload(value: unknown): AcceptanceBundleParseResult {
  const candidates = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.bundles)
      ? value.bundles
      : [value]
  const bundles: AcceptanceEvidenceBundle[] = []
  const errors: string[] = []

  candidates.forEach((candidate, index) => {
    const parsed = parseBundle(candidate, `Bundle ${index + 1}`)
    if (parsed.bundle) bundles.push(parsed.bundle)
    if (parsed.error) errors.push(parsed.error)
  })

  return { bundles: dedupeAcceptanceBundles(bundles), errors }
}

export function acceptanceBundleFromWorkspace(
  value: unknown,
  commitSha: string | null = null
): AcceptanceEvidenceBundle | null {
  if (!isRecord(value) || !Array.isArray(value.sessions)) return null
  const provisional = value.sessions
    .map((session) => {
      if (!isRecord(session)) return null
      const device = normalizeDevice(session.device)
      return device ? normalizeSession(session, device) : null
    })
    .filter((session): session is AcceptanceSession => session !== null)
  const device = provisional[0]?.device ?? null
  if (!device || provisional.length !== value.sessions.length) return null
  const screenshots = Array.isArray(value.screenshots)
    ? value.screenshots
      .map(normalizeScreenshot)
      .filter((item): item is AcceptanceScreenshotEvidence => item !== null)
    : []

  return {
    schema: DEVICE_ACCEPTANCE_SCHEMA,
    schemaVersion: DEVICE_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      route: '/lab/device-acceptance',
      commitSha,
    },
    device,
    manualChecks: normalizeManualChecks(value.manualChecks),
    screenshots,
    sessions: provisional,
  }
}

function bundleFingerprint(bundle: AcceptanceEvidenceBundle) {
  const sessionIds = bundle.sessions.map(({ id }) => id).sort().join(',')
  return [
    bundle.source.commitSha ?? 'unknown',
    bundle.device.deviceClass,
    bundle.device.label,
    bundle.generatedAt,
    sessionIds,
  ].join('|')
}

export function dedupeAcceptanceBundles(
  bundles: AcceptanceEvidenceBundle[]
): AcceptanceEvidenceBundle[] {
  const unique = new Map<string, AcceptanceEvidenceBundle>()
  bundles.forEach((bundle) => unique.set(bundleFingerprint(bundle), bundle))
  return [...unique.values()].sort((a, b) => (
    b.generatedAt.localeCompare(a.generatedAt)
  ))
}

function combineManualChecks(
  bundles: AcceptanceEvidenceBundle[]
): AcceptanceManualChecks {
  const notes = [...new Set(bundles
    .map(({ manualChecks }) => manualChecks.notes.trim())
    .filter(Boolean))]
  return {
    interactionResponsive: bundles.some(({ manualChecks }) => manualChecks.interactionResponsive),
    visualParityEco: bundles.some(({ manualChecks }) => manualChecks.visualParityEco),
    visualParityBalanced: bundles.some(({ manualChecks }) => manualChecks.visualParityBalanced),
    visualParityUltra: bundles.some(({ manualChecks }) => manualChecks.visualParityUltra),
    portraitApproved: bundles.some(({ manualChecks }) => manualChecks.portraitApproved),
    landscapeApproved: bundles.some(({ manualChecks }) => manualChecks.landscapeApproved),
    sleepResumeApproved: bundles.some(({ manualChecks }) => manualChecks.sleepResumeApproved),
    contextRecoveryApproved: bundles.some(({ manualChecks }) => manualChecks.contextRecoveryApproved),
    thermalApproved: bundles.some(({ manualChecks }) => manualChecks.thermalApproved),
    notes: notes.join('\n\n'),
  }
}

function dedupeSessions(sessions: AcceptanceSession[]) {
  const unique = new Map<string, AcceptanceSession>()
  sessions.forEach((session) => {
    const current = unique.get(session.id)
    if (!current || session.endedAt > current.endedAt) unique.set(session.id, session)
  })
  return [...unique.values()]
}

function dedupeScreenshots(screenshots: AcceptanceScreenshotEvidence[]) {
  const unique = new Map<string, AcceptanceScreenshotEvidence>()
  screenshots.forEach((screenshot) => {
    unique.set(`${screenshot.fileName}:${screenshot.capturedAt}`, screenshot)
  })
  return [...unique.values()]
}

function sessionRank(session: AcceptanceSession) {
  const verdict = session.summary.verdict === 'pass'
    ? 3
    : session.summary.verdict === 'review'
      ? 2
      : 1
  return verdict * 1_000_000
    + session.summary.completionRatio * 100_000
    + Math.min(session.summary.durationSeconds, 9_999)
}

function selectSession(
  sessions: AcceptanceSession[],
  scenario: AcceptanceSession['scenario'],
  quality: EffectiveQuality
) {
  return sessions
    .filter((session) => session.scenario === scenario && session.quality === quality)
    .sort((a, b) => sessionRank(b) - sessionRank(a) || b.endedAt.localeCompare(a.endedAt))[0]
    ?? null
}

function median(values: number[]) {
  if (values.length === 0) return null
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle]
}

function windowMedian(values: Array<number | null>, start: number, end: number) {
  const finite = values.filter((value): value is number => value !== null)
  if (finite.length === 0) return null
  const from = Math.max(0, Math.floor(finite.length * start))
  const to = Math.max(from + 1, Math.ceil(finite.length * end))
  return median(finite.slice(from, to))
}

function metricDrift(
  samples: AcceptanceSample[],
  read: (sample: AcceptanceSample) => number | null
) {
  const values = samples.map(read)
  const first = windowMedian(values, 0, 0.2)
  const last = windowMedian(values, 0.8, 1)
  if (first === null || last === null) return null
  return last - first
}

function calculateResourceDrift(
  thermalSession: AcceptanceSession | null
): AcceptanceResourceDrift {
  if (!thermalSession) {
    return {
      textureDelta: null,
      geometryDelta: null,
      heapDeltaBytes: null,
      heapDeltaPercent: null,
    }
  }
  const textureDelta = metricDrift(thermalSession.samples, (sample) => (
    readDiagnosticNumber(sample.diagnostics.explorer, 'textures')
  ))
  const geometryDelta = metricDrift(thermalSession.samples, (sample) => (
    readDiagnosticNumber(sample.diagnostics.explorer, 'geometries')
  ))
  const heapDeltaBytes = metricDrift(
    thermalSession.samples,
    (sample) => sample.usedJsHeapBytes
  )
  const firstHeap = windowMedian(
    thermalSession.samples.map(({ usedJsHeapBytes }) => usedJsHeapBytes),
    0,
    0.2
  )
  const heapDeltaPercent = firstHeap !== null
    && firstHeap > 0
    && heapDeltaBytes !== null
    ? (heapDeltaBytes / firstHeap) * 100
    : null
  return { textureDelta, geometryDelta, heapDeltaBytes, heapDeltaPercent }
}

function addRequirement(
  requirements: AcceptanceRequirement[],
  id: string,
  label: string,
  status: AcceptanceRequirementStatus,
  detail: string
) {
  requirements.push({ id, label, status, detail })
}

function contextLimitationDocumented(notes: string) {
  return /(webgl_lose_context|context recovery).*(unavailable|unsupported|not supported)|(?:unavailable|unsupported|not supported).*(webgl_lose_context|context recovery)/i.test(notes)
}

function sessionEventCount(session: AcceptanceSession | null, type: AcceptanceEvent['type']) {
  return session?.events.filter((event) => event.type === type).length ?? 0
}

function allEvents(sessions: AcceptanceSession[]) {
  return sessions.flatMap(({ events }) => events)
}

function analyzeDevice(
  deviceClass: RequiredAcceptanceDeviceClass,
  bundles: AcceptanceEvidenceBundle[]
): AcceptanceDeviceReview {
  const requirements: AcceptanceRequirement[] = []
  const blockers: string[] = []
  const warnings: string[] = []
  const expectedPrimaryQuality = PRIMARY_QUALITY[deviceClass]
  const sessions = dedupeSessions(bundles.flatMap(({ sessions: items }) => items))
  const screenshots = dedupeScreenshots(
    bundles.flatMap(({ screenshots: items }) => items)
  )
  const checks = combineManualChecks(bundles)
  const primarySession = selectSession(sessions, 'profile', expectedPrimaryQuality)
  const thermalSession = selectSession(sessions, 'thermal', expectedPrimaryQuality)
  const screenshotQualities = QUALITIES.filter((quality) => (
    screenshots.some((screenshot) => screenshot.quality === quality)
  ))
  const orientations = [...new Set(screenshots.map(({ orientation }) => orientation))]
  const latestBundle = [...bundles].sort((a, b) => (
    b.generatedAt.localeCompare(a.generatedAt)
  ))[0]
  const events = allEvents(sessions)
  const resourceDrift = calculateResourceDrift(thermalSession)

  const record = (
    id: string,
    label: string,
    status: AcceptanceRequirementStatus,
    detail: string
  ) => {
    addRequirement(requirements, id, label, status, detail)
    if (status === 'fail') blockers.push(detail)
    if (status === 'review') warnings.push(detail)
  }

  record(
    'bundle',
    'Evidence bundle',
    bundles.length > 0 ? 'pass' : 'fail',
    bundles.length > 0
      ? `${bundles.length} bundle${bundles.length === 1 ? '' : 's'} imported.`
      : `${DEVICE_LABELS[deviceClass]} evidence is missing.`
  )

  const identityReady = Boolean(
    latestBundle?.device.label.trim()
    && latestBundle.device.graphics.renderer
    && latestBundle.device.graphics.api !== 'unavailable'
  )
  record(
    'identity',
    'Device and GPU identity',
    identityReady ? 'pass' : 'review',
    identityReady
      ? `${latestBundle.device.label} · ${latestBundle.device.graphics.renderer}`
      : 'Device label or WebGL renderer identity is incomplete.'
  )

  if (!primarySession) {
    record(
      'primary-profile',
      `${expectedPrimaryQuality} profile capture`,
      'fail',
      `A completed ${expectedPrimaryQuality} profile capture is required.`
    )
  } else {
    const status: AcceptanceRequirementStatus = primarySession.summary.verdict === 'pass'
      ? 'pass'
      : primarySession.summary.verdict === 'review'
        ? 'review'
        : 'fail'
    record(
      'primary-profile',
      `${expectedPrimaryQuality} profile capture`,
      status,
      `${primarySession.summary.medianFps?.toFixed(1) ?? '—'} median FPS · ${Math.round(primarySession.summary.diagnosticsCoverage * 100)}% diagnostics · ${primarySession.summary.verdict}.`
    )
  }

  if (!thermalSession) {
    record(
      'thermal-session',
      `${expectedPrimaryQuality} thermal capture`,
      'fail',
      `A 10–15 minute ${expectedPrimaryQuality} thermal capture is required.`
    )
  } else {
    const durationReady = thermalSession.summary.durationSeconds >= 600
    const status: AcceptanceRequirementStatus = !durationReady
      || thermalSession.summary.verdict === 'fail'
      ? 'fail'
      : thermalSession.summary.verdict === 'review'
        ? 'review'
        : 'pass'
    record(
      'thermal-session',
      `${expectedPrimaryQuality} thermal capture`,
      status,
      `${Math.round(thermalSession.summary.durationSeconds / 60)} min · ${thermalSession.summary.fpsDegradationPercent?.toFixed(1) ?? '—'}% FPS change · ${thermalSession.summary.verdict}.`
    )
  }

  const missingQualityScreenshots = QUALITIES.filter((quality) => (
    !screenshotQualities.includes(quality)
  ))
  const visualChecksReady = checks.visualParityEco
    && checks.visualParityBalanced
    && checks.visualParityUltra
  record(
    'visual-evidence',
    'Eco, Balanced, and Ultra visual evidence',
    missingQualityScreenshots.length === 0 && visualChecksReady ? 'pass' : 'fail',
    missingQualityScreenshots.length === 0 && visualChecksReady
      ? 'All quality screenshots and human visual approvals are present.'
      : `Missing ${[
        ...missingQualityScreenshots.map((quality) => `${quality} screenshot`),
        ...(!visualChecksReady ? ['one or more visual approvals'] : []),
      ].join(', ')}.`
  )

  record(
    'interaction',
    'Interaction responsiveness',
    checks.interactionResponsive ? 'pass' : 'fail',
    checks.interactionResponsive
      ? 'Orbit, zoom, search, selection, and panels were approved.'
      : 'Human interaction approval is missing.'
  )

  if (deviceClass === 'android-phone') {
    const hasPortrait = orientations.some((orientation) => /portrait/i.test(orientation))
    const hasLandscape = orientations.some((orientation) => /landscape/i.test(orientation))
    record(
      'phone-orientation',
      'Phone portrait and landscape',
      hasPortrait && hasLandscape && checks.portraitApproved && checks.landscapeApproved
        ? 'pass'
        : 'fail',
      hasPortrait && hasLandscape && checks.portraitApproved && checks.landscapeApproved
        ? 'Portrait and landscape screenshots and approvals are present.'
        : 'Android portrait and landscape screenshots plus approvals are required.'
    )
  }

  const sleepMarker = events.some(({ type }) => type === 'sleep-marker')
  const hidden = events.some(({ type }) => type === 'visibility-hidden')
  const visible = events.some(({ type }) => type === 'visibility-visible')
  const sleepStatus: AcceptanceRequirementStatus = !checks.sleepResumeApproved
    || !sleepMarker
    ? 'fail'
    : hidden && visible
      ? 'pass'
      : 'review'
  record(
    'sleep-resume',
    'Display sleep and resume',
    sleepStatus,
    sleepStatus === 'pass'
      ? 'Sleep marker and hidden/visible transitions were captured and approved.'
      : sleepStatus === 'review'
        ? 'Sleep/resume was approved, but visibility transitions were not both recorded.'
        : 'Sleep/resume approval and a sleep marker are required.'
  )

  const contextLosses = events.filter(({ type }) => type === 'context-lost').length
  const contextRestores = events.filter(({ type }) => type === 'context-restored').length
  const limitation = contextLimitationDocumented(checks.notes)
  const contextStatus: AcceptanceRequirementStatus = contextLosses > contextRestores
    ? 'fail'
    : checks.contextRecoveryApproved && contextLosses > 0 && contextLosses === contextRestores
      ? 'pass'
      : limitation
        ? 'pass'
        : checks.contextRecoveryApproved
          ? 'review'
          : 'fail'
  record(
    'context-recovery',
    'WebGL context recovery',
    contextStatus,
    contextLosses > contextRestores
      ? 'A context loss was not followed by a restore.'
      : limitation
        ? 'The browser limitation was documented in human notes.'
        : contextStatus === 'pass'
          ? `${contextLosses} context loss/restoration pair${contextLosses === 1 ? '' : 's'} captured and approved.`
          : contextStatus === 'review'
            ? 'Recovery was approved, but no automated context event pair was captured.'
            : 'Context recovery evidence or a documented browser limitation is required.'
  )

  record(
    'thermal-approval',
    'Human thermal approval',
    checks.thermalApproved ? 'pass' : 'fail',
    checks.thermalApproved
      ? 'Temperature, fan noise, and end-of-session responsiveness were approved.'
      : 'Human thermal approval is missing.'
  )

  const selectedSessions = [primarySession, thermalSession].filter(
    (session): session is AcceptanceSession => session !== null
  )
  const invariantFailed = selectedSessions.some(
    ({ summary }) => summary.laneClockInvariantPassed === false
  )
  const unrecovered = selectedSessions.some(
    ({ summary }) => summary.contextLosses > summary.contextRestores
  )
  record(
    'runtime-integrity',
    'Runtime integrity',
    invariantFailed || unrecovered ? 'fail' : 'pass',
    invariantFailed
      ? 'A selected session violated the shared-clock invariant.'
      : unrecovered
        ? 'A selected session retained an unrecovered WebGL context loss.'
        : 'Selected sessions retained clock consistency and recovered context state.'
  )

  const textureDrift = resourceDrift.textureDelta
  const geometryDrift = resourceDrift.geometryDelta
  const heapBytes = resourceDrift.heapDeltaBytes
  const heapPercent = resourceDrift.heapDeltaPercent
  const severeHeapGrowth = heapBytes !== null && heapPercent !== null
    && heapBytes > 64 * 1024 * 1024 && heapPercent > 50
  const reviewHeapGrowth = heapBytes !== null && heapPercent !== null
    && heapBytes > 32 * 1024 * 1024 && heapPercent > 25
  const resourceStatus: AcceptanceRequirementStatus =
    (textureDrift !== null && textureDrift > 2)
    || (geometryDrift !== null && geometryDrift > 12)
    || severeHeapGrowth
      ? 'fail'
      : (textureDrift !== null && textureDrift > 0)
        || (geometryDrift !== null && geometryDrift > 4)
        || reviewHeapGrowth
        ? 'review'
        : 'pass'
  record(
    'resource-stability',
    'Thermal resource stability',
    resourceStatus,
    thermalSession
      ? `Texture Δ ${textureDrift?.toFixed(1) ?? 'N/A'} · geometry Δ ${geometryDrift?.toFixed(1) ?? 'N/A'} · heap Δ ${heapBytes === null ? 'N/A' : `${(heapBytes / 1024 / 1024).toFixed(1)} MB`}.`
      : 'Resource drift cannot be evaluated without a thermal session.'
  )

  const verdict: AcceptanceReviewVerdict = blockers.length > 0
    ? 'blocked'
    : warnings.length > 0
      ? 'review'
      : 'ready'

  return {
    deviceClass,
    label: latestBundle?.device.label || DEVICE_LABELS[deviceClass],
    renderer: latestBundle?.device.graphics.renderer ?? null,
    expectedPrimaryQuality,
    verdict,
    bundleCount: bundles.length,
    sessionCount: sessions.length,
    screenshotCount: screenshots.length,
    primarySession,
    thermalSession,
    screenshotQualities,
    orientations,
    requirements,
    blockers,
    warnings,
    resourceDrift,
  }
}

export function analyzeAcceptanceBundles(
  input: AcceptanceEvidenceBundle[]
): AcceptanceMergeReadiness {
  const bundles = dedupeAcceptanceBundles(input)
  const missingDeviceClasses = REQUIRED_ACCEPTANCE_DEVICE_CLASSES.filter((deviceClass) => (
    !bundles.some((bundle) => bundle.device.deviceClass === deviceClass)
  ))
  const devices = REQUIRED_ACCEPTANCE_DEVICE_CLASSES
    .filter((deviceClass) => !missingDeviceClasses.includes(deviceClass))
    .map((deviceClass) => analyzeDevice(
      deviceClass,
      bundles.filter((bundle) => bundle.device.deviceClass === deviceClass)
    ))
  const commitShas = [...new Set(bundles
    .map(({ source }) => source.commitSha)
    .filter((value): value is string => Boolean(value)))]
  const blockers: string[] = []
  const warnings: string[] = []

  missingDeviceClasses.forEach((deviceClass) => {
    blockers.push(`${DEVICE_LABELS[deviceClass]} evidence is missing.`)
  })
  devices.forEach((device) => {
    if (device.verdict === 'blocked') {
      blockers.push(`${DEVICE_LABELS[device.deviceClass]} is blocked: ${device.blockers[0] ?? 'required evidence failed'}`)
    } else if (device.verdict === 'review') {
      warnings.push(`${DEVICE_LABELS[device.deviceClass]} requires review: ${device.warnings[0] ?? 'evidence needs attention'}`)
    }
    if (device.bundleCount > 1) {
      warnings.push(`${DEVICE_LABELS[device.deviceClass]} combines ${device.bundleCount} imported bundles.`)
    }
  })

  if (commitShas.length > 1) {
    blockers.push(`Evidence spans multiple commits: ${commitShas.join(', ')}.`)
  } else if (bundles.length > 0 && bundles.some(({ source }) => !source.commitSha)) {
    warnings.push('One or more bundles do not contain a deployment commit SHA.')
  }
  if (bundles.length === 0) blockers.push('No device evidence bundles were imported.')

  const verdict: AcceptanceReviewVerdict = blockers.length > 0
    ? 'blocked'
    : warnings.length > 0
      ? 'review'
      : 'ready'

  return {
    schema: DEVICE_ACCEPTANCE_REVIEW_SCHEMA,
    schemaVersion: DEVICE_ACCEPTANCE_REVIEW_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    verdict,
    bundleCount: bundles.length,
    requiredDeviceCount: REQUIRED_ACCEPTANCE_DEVICE_CLASSES.length,
    readyDeviceCount: devices.filter(({ verdict: value }) => value === 'ready').length,
    reviewDeviceCount: devices.filter(({ verdict: value }) => value === 'review').length,
    blockedDeviceCount: devices.filter(({ verdict: value }) => value === 'blocked').length
      + missingDeviceClasses.length,
    devices,
    missingDeviceClasses,
    commitShas,
    blockers,
    warnings,
  }
}

function formatMetric(value: number | null, suffix = '') {
  return value === null ? 'N/A' : `${value.toFixed(1)}${suffix}`
}

export function buildAcceptanceMarkdownReport(
  analysis: AcceptanceMergeReadiness
) {
  const lines = [
    '# Solar System Explorer — Device Acceptance Review',
    '',
    `Generated: ${analysis.generatedAt}`,
    `Overall verdict: **${analysis.verdict.toUpperCase()}**`,
    `Bundles: ${analysis.bundleCount}`,
    `Commits: ${analysis.commitShas.join(', ') || 'not recorded'}`,
    '',
    '## Device matrix',
    '',
    '| Device | Verdict | Primary profile | Median FPS | Thermal degradation | Screenshots |',
    '| --- | --- | --- | ---: | ---: | ---: |',
  ]

  for (const deviceClass of REQUIRED_ACCEPTANCE_DEVICE_CLASSES) {
    const device = analysis.devices.find((item) => item.deviceClass === deviceClass)
    lines.push(device
      ? `| ${DEVICE_LABELS[deviceClass]} | ${device.verdict} | ${device.expectedPrimaryQuality} | ${formatMetric(device.primarySession?.summary.medianFps ?? null)} | ${formatMetric(device.thermalSession?.summary.fpsDegradationPercent ?? null, '%')} | ${device.screenshotCount} |`
      : `| ${DEVICE_LABELS[deviceClass]} | blocked | ${PRIMARY_QUALITY[deviceClass]} | N/A | N/A | 0 |`)
  }

  lines.push('', '## Blocking findings', '')
  if (analysis.blockers.length === 0) lines.push('- None.')
  analysis.blockers.forEach((item) => lines.push(`- ${item}`))
  lines.push('', '## Review findings', '')
  if (analysis.warnings.length === 0) lines.push('- None.')
  analysis.warnings.forEach((item) => lines.push(`- ${item}`))

  analysis.devices.forEach((device) => {
    lines.push('', `## ${DEVICE_LABELS[device.deviceClass]}`, '')
    lines.push(`- Label: ${device.label}`)
    lines.push(`- Renderer: ${device.renderer ?? 'not recorded'}`)
    lines.push(`- Verdict: ${device.verdict}`)
    device.requirements.forEach((requirement) => {
      const symbol = requirement.status === 'pass'
        ? 'PASS'
        : requirement.status === 'review'
          ? 'REVIEW'
          : 'FAIL'
      lines.push(`- [${symbol}] ${requirement.label}: ${requirement.detail}`)
    })
  })

  return `${lines.join('\n')}\n`
}

export function createAcceptanceReviewReport(
  bundles: AcceptanceEvidenceBundle[]
): AcceptanceReviewReport {
  const normalized = dedupeAcceptanceBundles(bundles)
  return {
    schema: DEVICE_ACCEPTANCE_REVIEW_SCHEMA,
    schemaVersion: DEVICE_ACCEPTANCE_REVIEW_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    analysis: analyzeAcceptanceBundles(normalized),
    bundles: normalized,
  }
}
