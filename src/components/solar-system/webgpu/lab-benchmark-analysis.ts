import {
  LAB_BENCHMARK_MINIMUM_SAMPLES,
  LAB_BENCHMARK_SCHEMA,
  LAB_BENCHMARK_SCHEMA_VERSION,
} from './lab-benchmark-protocol'

export type BenchmarkBackend = 'webgpu' | 'webgl2'
export type BenchmarkMode = 'bloom' | 'direct'
export type BenchmarkPairVerdict =
  | 'webgpu-faster'
  | 'webgl2-faster'
  | 'equivalent'
  | 'mixed'
export type BenchmarkRecommendation =
  | 'insufficient-evidence'
  | 'keep-webgl2'
  | 'offer-webgpu-opt-in'
  | 'consider-webgpu-default'
export type BenchmarkConfidence = 'low' | 'medium' | 'high'

export interface BenchmarkFrameRecord {
  fps: number
  averageFrameMs: number
  p95FrameMs: number
  longestFrameMs: number
  samples: number
  drawCalls: number | null
  triangles: number | null
}

export interface BenchmarkEnvironmentRecord {
  userAgent: string
  platform: string
  hardwareConcurrency: number | null
  deviceMemoryGb: number | null
  reducedMotion: boolean
  viewport: {
    width: number
    height: number
    devicePixelRatio: number
  }
  screen: {
    width: number
    height: number
    colorDepth: number
  }
}

export interface BenchmarkRecord {
  id: string
  capturedAt: string
  requestedBackend: 'auto' | 'webgl'
  actualBackend: BenchmarkBackend
  backendClass: string
  adapterStatus: 'not-requested' | 'available' | 'unavailable' | 'error'
  fallbackReason: string | null
  postProcessingEnabled: boolean
  initializationMs: number
  textureBackend: 'procedural' | 'ktx2' | 'mixed'
  textureFormats: string[]
  frame: BenchmarkFrameRecord
  camera: {
    position: number[]
    target: number[]
  }
  simulation: {
    epoch: string
    daysPerSecond: number
  }
  scene: {
    starCount: number
    solarWindCount: number
    sunFlareArcs: number
    nebulaShellCount: number
    gravityObjectCount: number
    postStrength: number
    postRadius: number
    postThreshold: number
  }
  environment: BenchmarkEnvironmentRecord
}

export interface BenchmarkParseResult {
  records: BenchmarkRecord[]
  errors: string[]
}

export interface BenchmarkAggregate {
  records: number
  averageFrameMs: number
  p95FrameMs: number
  longestFrameMs: number
  initializationMs: number
  fps: number
}

export interface BenchmarkModeComparison {
  mode: BenchmarkMode
  verdict: BenchmarkPairVerdict
  webgpu: BenchmarkAggregate
  webgl2: BenchmarkAggregate
  improvement: {
    averageFrameMs: number
    p95FrameMs: number
    longestFrameMs: number
    initializationMs: number
    fps: number
  }
}

export interface BenchmarkDeviceAnalysis {
  fingerprint: string
  label: string
  platform: string
  viewport: string
  hardware: string
  recordCount: number
  complete: boolean
  comparisons: BenchmarkModeComparison[]
  recommendation: BenchmarkRecommendation
}

export interface BenchmarkAnalysis {
  recordCount: number
  validRecordCount: number
  distinctDevices: number
  completeDevices: number
  matchedComparisons: number
  confidence: BenchmarkConfidence
  recommendation: BenchmarkRecommendation
  recommendationLabel: string
  rationale: string[]
  devices: BenchmarkDeviceAnalysis[]
}

interface JsonObject {
  [key: string]: unknown
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isBenchmarkFrame(value: unknown): value is BenchmarkFrameRecord {
  if (!isObject(value)) return false
  return isFiniteNumber(value.fps)
    && isFiniteNumber(value.averageFrameMs)
    && isFiniteNumber(value.p95FrameMs)
    && isFiniteNumber(value.longestFrameMs)
    && isFiniteNumber(value.samples)
    && isNullableFiniteNumber(value.drawCalls)
    && isNullableFiniteNumber(value.triangles)
    && value.fps > 0
    && value.averageFrameMs > 0
    && value.p95FrameMs > 0
    && value.longestFrameMs > 0
    && value.samples >= LAB_BENCHMARK_MINIMUM_SAMPLES
}

function isBenchmarkEnvironment(value: unknown): value is BenchmarkEnvironmentRecord {
  if (!isObject(value) || !isObject(value.viewport) || !isObject(value.screen)) {
    return false
  }

  return typeof value.userAgent === 'string'
    && typeof value.platform === 'string'
    && isNullableFiniteNumber(value.hardwareConcurrency)
    && isNullableFiniteNumber(value.deviceMemoryGb)
    && typeof value.reducedMotion === 'boolean'
    && isFiniteNumber(value.viewport.width)
    && isFiniteNumber(value.viewport.height)
    && isFiniteNumber(value.viewport.devicePixelRatio)
    && isFiniteNumber(value.screen.width)
    && isFiniteNumber(value.screen.height)
    && isFiniteNumber(value.screen.colorDepth)
}

export function isBenchmarkRecord(value: unknown): value is BenchmarkRecord {
  if (
    !isObject(value)
    || !isObject(value.camera)
    || !isObject(value.simulation)
    || !isObject(value.scene)
  ) {
    return false
  }

  return typeof value.id === 'string'
    && typeof value.capturedAt === 'string'
    && (value.requestedBackend === 'auto' || value.requestedBackend === 'webgl')
    && (value.actualBackend === 'webgpu' || value.actualBackend === 'webgl2')
    && typeof value.backendClass === 'string'
    && (
      value.adapterStatus === 'not-requested'
      || value.adapterStatus === 'available'
      || value.adapterStatus === 'unavailable'
      || value.adapterStatus === 'error'
    )
    && (value.fallbackReason === null || typeof value.fallbackReason === 'string')
    && typeof value.postProcessingEnabled === 'boolean'
    && isFiniteNumber(value.initializationMs)
    && value.initializationMs >= 0
    && (
      value.textureBackend === 'procedural'
      || value.textureBackend === 'ktx2'
      || value.textureBackend === 'mixed'
    )
    && isStringArray(value.textureFormats)
    && isBenchmarkFrame(value.frame)
    && isNumberArray(value.camera.position)
    && isNumberArray(value.camera.target)
    && typeof value.simulation.epoch === 'string'
    && isFiniteNumber(value.simulation.daysPerSecond)
    && isFiniteNumber(value.scene.starCount)
    && isFiniteNumber(value.scene.solarWindCount)
    && isFiniteNumber(value.scene.sunFlareArcs)
    && isFiniteNumber(value.scene.nebulaShellCount)
    && isFiniteNumber(value.scene.gravityObjectCount)
    && isFiniteNumber(value.scene.postStrength)
    && isFiniteNumber(value.scene.postRadius)
    && isFiniteNumber(value.scene.postThreshold)
    && isBenchmarkEnvironment(value.environment)
}

export function dedupeBenchmarkRecords(records: BenchmarkRecord[]) {
  const seen = new Set<string>()
  const deduped: BenchmarkRecord[] = []

  for (const record of records) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    deduped.push(record)
  }

  return deduped
}

export function parseBenchmarkPayload(value: unknown): BenchmarkParseResult {
  const errors: string[] = []
  let candidateRecords: unknown[] = []

  if (Array.isArray(value)) {
    candidateRecords = value
  } else if (isObject(value)) {
    if (value.schema !== LAB_BENCHMARK_SCHEMA) {
      errors.push(`Unsupported benchmark schema: ${String(value.schema ?? 'missing')}`)
      return { records: [], errors }
    }
    if (value.schemaVersion !== LAB_BENCHMARK_SCHEMA_VERSION) {
      errors.push(`Unsupported benchmark schema version: ${String(value.schemaVersion ?? 'missing')}`)
      return { records: [], errors }
    }
    if (!Array.isArray(value.records)) {
      errors.push('Benchmark payload does not contain a records array.')
      return { records: [], errors }
    }
    candidateRecords = value.records
  } else {
    errors.push('Benchmark data must be an exported object or a records array.')
    return { records: [], errors }
  }

  const records: BenchmarkRecord[] = []
  candidateRecords.forEach((record, index) => {
    if (isBenchmarkRecord(record)) {
      records.push(record)
    } else {
      errors.push(`Record ${index + 1} is incomplete or has fewer than ${LAB_BENCHMARK_MINIMUM_SAMPLES} samples.`)
    }
  })

  return {
    records: dedupeBenchmarkRecords(records),
    errors,
  }
}

function rounded(value: number) {
  return Math.round(value * 100) / 100
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

function aggregate(records: BenchmarkRecord[]): BenchmarkAggregate {
  return {
    records: records.length,
    averageFrameMs: rounded(median(records.map((record) => record.frame.averageFrameMs))),
    p95FrameMs: rounded(median(records.map((record) => record.frame.p95FrameMs))),
    longestFrameMs: rounded(median(records.map((record) => record.frame.longestFrameMs))),
    initializationMs: rounded(median(records.map((record) => record.initializationMs))),
    fps: rounded(median(records.map((record) => record.frame.fps))),
  }
}

function improvementPercent(webgl2: number, webgpu: number) {
  if (webgl2 <= 0) return 0
  return rounded(((webgl2 - webgpu) / webgl2) * 100)
}

function fpsImprovementPercent(webgl2: number, webgpu: number) {
  if (webgl2 <= 0) return 0
  return rounded(((webgpu - webgl2) / webgl2) * 100)
}

function pairVerdict(
  improvement: BenchmarkModeComparison['improvement']
): BenchmarkPairVerdict {
  const severeInitializationRegression = improvement.initializationMs < -120
    && improvement.averageFrameMs < 15
  const webgpuWin = improvement.averageFrameMs >= 5
    && improvement.p95FrameMs >= 5
    && improvement.longestFrameMs >= -15
    && !severeInitializationRegression
  const webgl2Win = improvement.averageFrameMs <= -8
    || improvement.p95FrameMs <= -8
    || improvement.longestFrameMs <= -25
  const equivalent = Math.abs(improvement.averageFrameMs) < 5
    && Math.abs(improvement.p95FrameMs) < 5
    && Math.abs(improvement.longestFrameMs) < 15

  if (webgpuWin) return 'webgpu-faster'
  if (webgl2Win) return 'webgl2-faster'
  if (equivalent) return 'equivalent'
  return 'mixed'
}

function deviceFingerprint(record: BenchmarkRecord) {
  return JSON.stringify({
    userAgent: record.environment.userAgent,
    platform: record.environment.platform,
    hardwareConcurrency: record.environment.hardwareConcurrency,
    deviceMemoryGb: record.environment.deviceMemoryGb,
    viewport: record.environment.viewport,
    screen: record.environment.screen,
  })
}

function configurationKey(record: BenchmarkRecord) {
  return JSON.stringify({
    camera: record.camera,
    simulation: record.simulation,
    scene: record.scene,
    textureBackend: record.textureBackend,
    textureFormats: [...record.textureFormats].sort(),
  })
}

function deviceLabel(record: BenchmarkRecord) {
  const cores = record.environment.hardwareConcurrency
  const memory = record.environment.deviceMemoryGb
  const hardware = [
    cores ? `${cores} threads` : null,
    memory ? `${memory} GB` : null,
  ].filter(Boolean).join(' · ') || 'hardware undisclosed'
  const viewport = `${record.environment.viewport.width}×${record.environment.viewport.height} @ ${record.environment.viewport.devicePixelRatio}×`

  return {
    label: `${record.environment.platform || 'Unknown platform'} · ${viewport}`,
    viewport,
    hardware,
  }
}

function compareMode(records: BenchmarkRecord[], mode: BenchmarkMode) {
  const postProcessingEnabled = mode === 'bloom'
  const modeRecords = records.filter((record) => (
    record.postProcessingEnabled === postProcessingEnabled
  ))
  const webgpuRecords = modeRecords.filter((record) => record.actualBackend === 'webgpu')
  const webgl2Records = modeRecords.filter((record) => record.actualBackend === 'webgl2')

  if (webgpuRecords.length === 0 || webgl2Records.length === 0) return null

  const baselineConfigurations = new Set(webgl2Records.map(configurationKey))
  const compatibleWebgpuRecords = webgpuRecords.filter((record) => (
    baselineConfigurations.has(configurationKey(record))
  ))
  if (compatibleWebgpuRecords.length === 0) return null

  const compatibleConfigurations = new Set(compatibleWebgpuRecords.map(configurationKey))
  const compatibleWebgl2Records = webgl2Records.filter((record) => (
    compatibleConfigurations.has(configurationKey(record))
  ))
  if (compatibleWebgl2Records.length === 0) return null

  const webgpu = aggregate(compatibleWebgpuRecords)
  const webgl2 = aggregate(compatibleWebgl2Records)
  const improvement = {
    averageFrameMs: improvementPercent(webgl2.averageFrameMs, webgpu.averageFrameMs),
    p95FrameMs: improvementPercent(webgl2.p95FrameMs, webgpu.p95FrameMs),
    longestFrameMs: improvementPercent(webgl2.longestFrameMs, webgpu.longestFrameMs),
    initializationMs: improvementPercent(webgl2.initializationMs, webgpu.initializationMs),
    fps: fpsImprovementPercent(webgl2.fps, webgpu.fps),
  }

  return {
    mode,
    verdict: pairVerdict(improvement),
    webgpu,
    webgl2,
    improvement,
  } satisfies BenchmarkModeComparison
}

function recommendationLabel(recommendation: BenchmarkRecommendation) {
  if (recommendation === 'consider-webgpu-default') {
    return 'Evidence supports a controlled WebGPU-default trial.'
  }
  if (recommendation === 'offer-webgpu-opt-in') {
    return 'WebGPU opt-in is justified; keep WebGL 2 as the default.'
  }
  if (recommendation === 'keep-webgl2') {
    return 'Keep WebGL 2 as the production default.'
  }
  return 'More matched real-device evidence is required.'
}

export function analyzeBenchmarkRecords(inputRecords: BenchmarkRecord[]): BenchmarkAnalysis {
  const records = dedupeBenchmarkRecords(inputRecords).filter(isBenchmarkRecord)
  const grouped = new Map<string, BenchmarkRecord[]>()

  for (const record of records) {
    const fingerprint = deviceFingerprint(record)
    grouped.set(fingerprint, [...(grouped.get(fingerprint) ?? []), record])
  }

  const devices: BenchmarkDeviceAnalysis[] = []
  for (const [fingerprint, deviceRecords] of grouped) {
    const representative = deviceRecords[0]
    if (!representative) continue
    const comparisons = (['bloom', 'direct'] as const)
      .map((mode) => compareMode(deviceRecords, mode))
      .filter((comparison): comparison is BenchmarkModeComparison => Boolean(comparison))
    const complete = comparisons.length === 2
    const verdicts = comparisons.map((comparison) => comparison.verdict)
    let recommendation: BenchmarkRecommendation = 'insufficient-evidence'

    if (verdicts.includes('webgl2-faster')) recommendation = 'keep-webgl2'
    else if (complete && verdicts.every((verdict) => verdict === 'webgpu-faster')) {
      recommendation = 'offer-webgpu-opt-in'
    } else if (comparisons.length > 0) recommendation = 'keep-webgl2'

    const label = deviceLabel(representative)
    devices.push({
      fingerprint,
      label: label.label,
      platform: representative.environment.platform,
      viewport: label.viewport,
      hardware: label.hardware,
      recordCount: deviceRecords.length,
      complete,
      comparisons,
      recommendation,
    })
  }

  devices.sort((a, b) => a.label.localeCompare(b.label))
  const comparisons = devices.flatMap((device) => device.comparisons)
  const completeDevices = devices.filter((device) => device.complete).length
  const wins = comparisons.filter((comparison) => comparison.verdict === 'webgpu-faster')
  const regressions = comparisons.filter((comparison) => comparison.verdict === 'webgl2-faster')
  const medianP95Improvement = comparisons.length > 0
    ? median(comparisons.map((comparison) => comparison.improvement.p95FrameMs))
    : 0
  let recommendation: BenchmarkRecommendation = 'insufficient-evidence'

  if (completeDevices >= 2) {
    if (regressions.length > 0) {
      recommendation = 'keep-webgl2'
    } else if (
      completeDevices >= 4
      && wins.length >= Math.ceil(comparisons.length * 0.75)
      && medianP95Improvement >= 5
    ) {
      recommendation = 'consider-webgpu-default'
    } else if (wins.length >= Math.ceil(comparisons.length * 0.5)) {
      recommendation = 'offer-webgpu-opt-in'
    } else {
      recommendation = 'keep-webgl2'
    }
  }

  const confidence: BenchmarkConfidence = completeDevices >= 4
    ? 'high'
    : completeDevices >= 2
      ? 'medium'
      : 'low'
  const rationale: string[] = []

  if (completeDevices < 2) {
    rationale.push('At least two devices need matched WebGPU/WebGL 2 bloom and direct samples.')
  } else {
    rationale.push(`${completeDevices} device${completeDevices === 1 ? '' : 's'} have complete four-configuration coverage.`)
  }
  if (wins.length > 0) {
    rationale.push(`WebGPU wins ${wins.length} of ${comparisons.length} matched mode comparison${comparisons.length === 1 ? '' : 's'}.`)
  }
  if (regressions.length > 0) {
    rationale.push(`${regressions.length} matched comparison${regressions.length === 1 ? '' : 's'} show a material WebGPU regression.`)
  }
  if (comparisons.length > 0) {
    rationale.push(`Median matched P95 improvement is ${rounded(medianP95Improvement)}%.`)
  }
  rationale.push('Renderer promotion still requires visual, stability, and power checks on the same physical devices.')

  return {
    recordCount: inputRecords.length,
    validRecordCount: records.length,
    distinctDevices: devices.length,
    completeDevices,
    matchedComparisons: comparisons.length,
    confidence,
    recommendation,
    recommendationLabel: recommendationLabel(recommendation),
    rationale,
    devices,
  }
}
