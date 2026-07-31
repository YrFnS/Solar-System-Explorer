import assert from 'node:assert/strict'
import {
  analyzeBenchmarkRecords,
  dedupeBenchmarkRecords,
  parseBenchmarkPayload,
  type BenchmarkBackend,
  type BenchmarkRecord,
} from '../src/components/solar-system/webgpu/lab-benchmark-analysis'
import {
  LAB_BENCHMARK_SCHEMA,
  LAB_BENCHMARK_SCHEMA_VERSION,
} from '../src/components/solar-system/webgpu/lab-benchmark-protocol'

interface RecordOptions {
  device: string
  backend: BenchmarkBackend
  bloom: boolean
  averageFrameMs?: number
  p95FrameMs?: number
  longestFrameMs?: number
  initializationMs?: number
  viewportWidth?: number
  samples?: number
}

function createRecord({
  device,
  backend,
  bloom,
  averageFrameMs = backend === 'webgpu' ? 12 : 16,
  p95FrameMs = backend === 'webgpu' ? 16 : 22,
  longestFrameMs = backend === 'webgpu' ? 30 : 35,
  initializationMs = backend === 'webgpu' ? 70 : 95,
  viewportWidth = 1280,
  samples = 120,
}: RecordOptions): BenchmarkRecord {
  return {
    id: `${device}-${backend}-${bloom ? 'bloom' : 'direct'}-${viewportWidth}`,
    capturedAt: '2026-07-31T12:00:00.000Z',
    requestedBackend: backend === 'webgpu' ? 'auto' : 'webgl',
    actualBackend: backend,
    backendClass: backend === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend',
    adapterStatus: backend === 'webgpu' ? 'available' : 'not-requested',
    fallbackReason: null,
    postProcessingEnabled: bloom,
    initializationMs,
    textureBackend: 'ktx2',
    textureFormats: ['RGBA_ASTC_4x4', 'RGB_ETC2'],
    frame: {
      fps: 1_000 / averageFrameMs,
      averageFrameMs,
      p95FrameMs,
      longestFrameMs,
      samples,
      drawCalls: bloom ? 74 : 70,
      triangles: 96_000,
    },
    camera: {
      position: [0, 34, 62],
      target: [0, 0, 0],
    },
    simulation: {
      epoch: '2026-01-01T00:00:00.000Z',
      daysPerSecond: 12,
    },
    scene: {
      starCount: 1_600,
      solarWindCount: 320,
      sunFlareArcs: 5,
      nebulaShellCount: 2,
      gravityObjectCount: 2,
      postStrength: 0.42,
      postRadius: 0.35,
      postThreshold: 0.72,
    },
    environment: {
      userAgent: `SyntheticBrowser/1.0 (${device})`,
      platform: device,
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      reducedMotion: false,
      viewport: {
        width: viewportWidth,
        height: 720,
        devicePixelRatio: 1,
      },
      screen: {
        width: 1920,
        height: 1080,
        colorDepth: 24,
      },
    },
  }
}

function completeDevice(device: string) {
  return [
    createRecord({ device, backend: 'webgpu', bloom: true }),
    createRecord({ device, backend: 'webgpu', bloom: false }),
    createRecord({ device, backend: 'webgl2', bloom: true }),
    createRecord({ device, backend: 'webgl2', bloom: false }),
  ]
}

const twoDeviceRecords = [
  ...completeDevice('Device-A'),
  ...completeDevice('Device-B'),
]
const payload = {
  schema: LAB_BENCHMARK_SCHEMA,
  schemaVersion: LAB_BENCHMARK_SCHEMA_VERSION,
  generatedAt: '2026-07-31T12:30:00.000Z',
  recordCount: twoDeviceRecords.length,
  records: twoDeviceRecords,
}
const parsed = parseBenchmarkPayload(payload)
assert.equal(parsed.errors.length, 0)
assert.equal(parsed.records.length, 8)

const optIn = analyzeBenchmarkRecords(parsed.records)
assert.equal(optIn.distinctDevices, 2)
assert.equal(optIn.completeDevices, 2)
assert.equal(optIn.matchedComparisons, 4)
assert.equal(optIn.recommendation, 'offer-webgpu-opt-in')
assert.equal(optIn.confidence, 'medium')

const fourDeviceRecords = [
  ...twoDeviceRecords,
  ...completeDevice('Device-C'),
  ...completeDevice('Device-D'),
]
const defaultTrial = analyzeBenchmarkRecords(fourDeviceRecords)
assert.equal(defaultTrial.completeDevices, 4)
assert.equal(defaultTrial.matchedComparisons, 8)
assert.equal(defaultTrial.recommendation, 'consider-webgpu-default')
assert.equal(defaultTrial.confidence, 'high')

const regressionRecords = [
  ...twoDeviceRecords.filter((record) => !(
    record.environment.platform === 'Device-B'
    && record.actualBackend === 'webgpu'
    && record.postProcessingEnabled
  )),
  createRecord({
    device: 'Device-B',
    backend: 'webgpu',
    bloom: true,
    averageFrameMs: 22,
    p95FrameMs: 31,
    longestFrameMs: 55,
  }),
].map((record, index) => ({ ...record, id: `${record.id}-${index}` }))
const regression = analyzeBenchmarkRecords(regressionRecords)
assert.equal(regression.recommendation, 'keep-webgl2')
assert.ok(regression.devices.some((device) => (
  device.comparisons.some((comparison) => comparison.verdict === 'webgl2-faster')
)))

const mismatchedViewport = analyzeBenchmarkRecords([
  createRecord({ device: 'Device-E', backend: 'webgpu', bloom: true, viewportWidth: 1440 }),
  createRecord({ device: 'Device-E', backend: 'webgl2', bloom: true, viewportWidth: 1280 }),
])
assert.equal(mismatchedViewport.distinctDevices, 2)
assert.equal(mismatchedViewport.matchedComparisons, 0)
assert.equal(mismatchedViewport.recommendation, 'insufficient-evidence')

const duplicate = createRecord({ device: 'Device-F', backend: 'webgpu', bloom: true })
assert.equal(dedupeBenchmarkRecords([duplicate, duplicate]).length, 1)

const lowSamplePayload = {
  ...payload,
  records: [createRecord({
    device: 'Device-G',
    backend: 'webgpu',
    bloom: true,
    samples: 30,
  })],
}
const lowSampleResult = parseBenchmarkPayload(lowSamplePayload)
assert.equal(lowSampleResult.records.length, 0)
assert.equal(lowSampleResult.errors.length, 1)

const wrongSchema = parseBenchmarkPayload({
  schema: 'unrelated-benchmark',
  schemaVersion: 1,
  records: [],
})
assert.equal(wrongSchema.records.length, 0)
assert.equal(wrongSchema.errors.length, 1)

console.log('[webgpu-analysis] parser, pairing, regression, and promotion thresholds passed')
