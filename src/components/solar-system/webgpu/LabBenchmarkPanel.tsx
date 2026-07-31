'use client'

import { useEffect, useState } from 'react'
import type { LabFrameMetrics } from './WebGPULabScene'
import {
  LAB_GRAVITY_OBJECT_COUNT,
} from './LabGravitationalObjects'
import {
  LAB_NEBULA_SHELL_COUNT,
} from './LabNebulaHaze'
import {
  LAB_SOLAR_WIND_COUNT,
  LAB_STAR_COUNT,
} from './LabParticleFields'
import {
  LAB_POST_RADIUS,
  LAB_POST_STRENGTH,
  LAB_POST_THRESHOLD,
} from './LabPostProcessing'
import {
  LAB_SUN_FLARE_ARCS,
} from './LabSunEffects'
import {
  LAB_BENCHMARK_BASELINE_CAMERA,
  LAB_BENCHMARK_BASELINE_TARGET,
  LAB_BENCHMARK_MAX_RECORDS,
  LAB_BENCHMARK_MINIMUM_SAMPLES,
  LAB_BENCHMARK_SCHEMA,
  LAB_BENCHMARK_SCHEMA_VERSION,
  LAB_BENCHMARK_STORAGE_KEY,
} from './lab-benchmark-protocol'

type RequestedBackend = 'auto' | 'webgl'
type ActualBackend = 'webgpu' | 'webgl2' | 'unknown'
type AdapterStatus = 'not-requested' | 'available' | 'unavailable' | 'error'
type TextureBackend = 'procedural' | 'ktx2' | 'mixed'

interface BenchmarkEnvironment {
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

export interface LabBenchmarkRecord {
  id: string
  capturedAt: string
  requestedBackend: RequestedBackend
  actualBackend: Exclude<ActualBackend, 'unknown'>
  backendClass: string
  adapterStatus: AdapterStatus
  fallbackReason: string | null
  postProcessingEnabled: boolean
  initializationMs: number
  textureBackend: TextureBackend
  textureFormats: string[]
  frame: LabFrameMetrics
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
  environment: BenchmarkEnvironment
}

interface BenchmarkCoverage {
  webgpuBloom: number
  webgpuDirect: number
  webgl2Bloom: number
  webgl2Direct: number
}

interface LabBenchmarkDiagnostics {
  schema: string
  schemaVersion: number
  minimumSamples: number
  maximumRecords: number
  baselinePrepared: boolean
  ready: boolean
  recordCount: number
  coverage: BenchmarkCoverage
  currentConfiguration: {
    requestedBackend: RequestedBackend
    actualBackend: ActualBackend
    postProcessingEnabled: boolean
    samples: number
  }
  baselineCamera: number[]
  baselineTarget: number[]
  sessionPersistence: 'sessionStorage'
  exportFormats: string[]
  lastRecord: LabBenchmarkRecord | null
  records: LabBenchmarkRecord[]
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_LAB_BENCHMARK__?: LabBenchmarkDiagnostics
  }
}

interface LabBenchmarkPanelProps {
  requestedBackend: RequestedBackend
  actualBackend: ActualBackend
  backendClass: string
  adapterStatus: AdapterStatus
  fallbackReason: string | null
  postProcessingEnabled: boolean
  initializationMs: number | null
  textureBackend: TextureBackend
  textureFormats: string[]
  metrics: LabFrameMetrics | null
  baselinePrepared: boolean
  onPrepareBaseline: () => void
}

function isBenchmarkRecord(value: unknown): value is LabBenchmarkRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<LabBenchmarkRecord>
  return typeof record.id === 'string'
    && typeof record.capturedAt === 'string'
    && (record.actualBackend === 'webgpu' || record.actualBackend === 'webgl2')
    && typeof record.postProcessingEnabled === 'boolean'
    && typeof record.initializationMs === 'number'
    && Boolean(record.frame)
}

function readStoredRecords() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.sessionStorage.getItem(LAB_BENCHMARK_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isBenchmarkRecord).slice(0, LAB_BENCHMARK_MAX_RECORDS)
  } catch {
    return []
  }
}

function getCoverage(records: LabBenchmarkRecord[]): BenchmarkCoverage {
  return {
    webgpuBloom: records.filter((record) => (
      record.actualBackend === 'webgpu' && record.postProcessingEnabled
    )).length,
    webgpuDirect: records.filter((record) => (
      record.actualBackend === 'webgpu' && !record.postProcessingEnabled
    )).length,
    webgl2Bloom: records.filter((record) => (
      record.actualBackend === 'webgl2' && record.postProcessingEnabled
    )).length,
    webgl2Direct: records.filter((record) => (
      record.actualBackend === 'webgl2' && !record.postProcessingEnabled
    )).length,
  }
}

function buildExportPayload(records: LabBenchmarkRecord[]) {
  return {
    schema: LAB_BENCHMARK_SCHEMA,
    schemaVersion: LAB_BENCHMARK_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  }
}

function createEnvironment(): BenchmarkEnvironment {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null,
    deviceMemoryGb: Number.isFinite(navigatorWithMemory.deviceMemory)
      ? navigatorWithMemory.deviceMemory ?? null
      : null,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
    },
  }
}

export default function LabBenchmarkPanel({
  requestedBackend,
  actualBackend,
  backendClass,
  adapterStatus,
  fallbackReason,
  postProcessingEnabled,
  initializationMs,
  textureBackend,
  textureFormats,
  metrics,
  baselinePrepared,
  onPrepareBaseline,
}: LabBenchmarkPanelProps) {
  const [records, setRecords] = useState<LabBenchmarkRecord[]>(() => readStoredRecords())
  const [message, setMessage] = useState('Prepare the fixed camera before recording.')
  const coverage = getCoverage(records)
  const ready = baselinePrepared
    && actualBackend !== 'unknown'
    && initializationMs !== null
    && textureBackend === 'ktx2'
    && Boolean(metrics && metrics.samples >= LAB_BENCHMARK_MINIMUM_SAMPLES)
  const currentSamples = metrics?.samples ?? 0
  const currentLabel = `${actualBackend === 'unknown' ? 'pending' : actualBackend} · ${
    postProcessingEnabled ? 'bloom' : 'direct'
  }`

  useEffect(() => {
    try {
      window.sessionStorage.setItem(LAB_BENCHMARK_STORAGE_KEY, JSON.stringify(records))
    } catch {
      // The benchmark remains usable even when session storage is unavailable.
    }
  }, [records])

  useEffect(() => {
    const diagnostics: LabBenchmarkDiagnostics = {
      schema: LAB_BENCHMARK_SCHEMA,
      schemaVersion: LAB_BENCHMARK_SCHEMA_VERSION,
      minimumSamples: LAB_BENCHMARK_MINIMUM_SAMPLES,
      maximumRecords: LAB_BENCHMARK_MAX_RECORDS,
      baselinePrepared,
      ready,
      recordCount: records.length,
      coverage,
      currentConfiguration: {
        requestedBackend,
        actualBackend,
        postProcessingEnabled,
        samples: currentSamples,
      },
      baselineCamera: [...LAB_BENCHMARK_BASELINE_CAMERA],
      baselineTarget: [...LAB_BENCHMARK_BASELINE_TARGET],
      sessionPersistence: 'sessionStorage',
      exportFormats: ['json', 'clipboard'],
      lastRecord: records[0] ?? null,
      records,
    }
    window.__SOLAR_WEBGPU_LAB_BENCHMARK__ = diagnostics

    return () => {
      if (window.__SOLAR_WEBGPU_LAB_BENCHMARK__ === diagnostics) {
        delete window.__SOLAR_WEBGPU_LAB_BENCHMARK__
      }
    }
  }, [
    actualBackend,
    baselinePrepared,
    coverage.webgl2Bloom,
    coverage.webgl2Direct,
    coverage.webgpuBloom,
    coverage.webgpuDirect,
    currentSamples,
    postProcessingEnabled,
    ready,
    records,
    requestedBackend,
  ])

  const prepareBaseline = () => {
    onPrepareBaseline()
    setMessage(`Collecting ${LAB_BENCHMARK_MINIMUM_SAMPLES} fresh baseline frames…`)
  }

  const recordCurrentSample = () => {
    if (
      !ready
      || !metrics
      || initializationMs === null
    ) {
      setMessage('The current baseline sample is not ready yet.')
      return
    }

    const id = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}-${actualBackend}-${postProcessingEnabled ? 'bloom' : 'direct'}`
    const record: LabBenchmarkRecord = {
      id,
      capturedAt: new Date().toISOString(),
      requestedBackend,
      actualBackend,
      backendClass,
      adapterStatus,
      fallbackReason,
      postProcessingEnabled,
      initializationMs,
      textureBackend,
      textureFormats: [...textureFormats],
      frame: { ...metrics },
      camera: {
        position: [...LAB_BENCHMARK_BASELINE_CAMERA],
        target: [...LAB_BENCHMARK_BASELINE_TARGET],
      },
      simulation: {
        epoch: '2026-01-01T00:00:00.000Z',
        daysPerSecond: 12,
      },
      scene: {
        starCount: LAB_STAR_COUNT,
        solarWindCount: LAB_SOLAR_WIND_COUNT,
        sunFlareArcs: LAB_SUN_FLARE_ARCS,
        nebulaShellCount: LAB_NEBULA_SHELL_COUNT,
        gravityObjectCount: LAB_GRAVITY_OBJECT_COUNT,
        postStrength: LAB_POST_STRENGTH,
        postRadius: LAB_POST_RADIUS,
        postThreshold: LAB_POST_THRESHOLD,
      },
      environment: createEnvironment(),
    }

    setRecords((current) => [record, ...current].slice(0, LAB_BENCHMARK_MAX_RECORDS))
    setMessage(`Recorded ${actualBackend} with ${postProcessingEnabled ? 'bloom' : 'direct rendering'}.`)
  }

  const copyResults = async () => {
    if (records.length === 0) return
    if (!navigator.clipboard) {
      setMessage('Clipboard access is unavailable; use Download JSON instead.')
      return
    }

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(buildExportPayload(records), null, 2)
      )
      setMessage(`Copied ${records.length} benchmark record${records.length === 1 ? '' : 's'}.`)
    } catch {
      setMessage('Clipboard permission was denied; use Download JSON instead.')
    }
  }

  const downloadResults = () => {
    if (records.length === 0) return
    const payload = JSON.stringify(buildExportPayload(records), null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `solar-webgpu-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage(`Downloaded ${records.length} benchmark record${records.length === 1 ? '' : 's'}.`)
  }

  const clearResults = () => {
    setRecords([])
    setMessage('Benchmark session cleared.')
  }

  const coverageItems = [
    ['WebGPU + bloom', coverage.webgpuBloom],
    ['WebGPU + direct', coverage.webgpuDirect],
    ['WebGL 2 + bloom', coverage.webgl2Bloom],
    ['WebGL 2 + direct', coverage.webgl2Direct],
  ] as const

  return (
    <div className="rounded-2xl border border-emerald-200/10 bg-emerald-200/[0.025] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-emerald-100/45">
            Real-device benchmark
          </p>
          <p className="mt-1 text-[10px] font-semibold text-white/76">
            Fixed-camera evidence capture
          </p>
        </div>
        <span className={`rounded-full border px-2 py-1 font-mono text-[8px] ${
          ready
            ? 'border-emerald-200/15 bg-emerald-200/[0.08] text-emerald-100/70'
            : 'border-white/8 bg-white/[0.025] text-white/35'
        }`}>
          {ready ? 'ready' : `${currentSamples}/${LAB_BENCHMARK_MINIMUM_SAMPLES}`}
        </span>
      </div>

      <p className="mt-2 text-[8px] leading-relaxed text-white/32">
        Reset to the shared camera, collect a fresh frame window, then record each backend with bloom on and off. Results stay in this browser session and export as JSON.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {coverageItems.map(([label, count]) => (
          <div
            key={label}
            className={`rounded-xl border px-2 py-2 font-mono text-[8px] ${
              count > 0
                ? 'border-emerald-200/12 bg-emerald-200/[0.05] text-emerald-100/65'
                : 'border-white/6 bg-black/15 text-white/28'
            }`}
          >
            <span className="block">{label}</span>
            <span className="mt-0.5 block text-[9px]">{count}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={prepareBaseline}
          className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[9px] font-semibold text-white/65 transition hover:bg-white/[0.08] hover:text-white"
          aria-label="Prepare benchmark baseline"
        >
          Prepare baseline
        </button>
        <button
          type="button"
          onClick={recordCurrentSample}
          disabled={!ready}
          className="rounded-xl border border-emerald-200/15 bg-emerald-200/[0.08] px-3 py-2 text-[9px] font-semibold text-emerald-100/75 transition enabled:hover:bg-emerald-200/[0.14] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Record benchmark sample"
        >
          Record {currentLabel}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={copyResults}
          disabled={records.length === 0}
          className="rounded-xl border border-white/8 px-2 py-1.5 text-[8px] text-white/45 transition enabled:hover:bg-white/[0.07] enabled:hover:text-white disabled:opacity-30"
          aria-label="Copy benchmark JSON"
        >
          Copy JSON
        </button>
        <button
          type="button"
          onClick={downloadResults}
          disabled={records.length === 0}
          className="rounded-xl border border-white/8 px-2 py-1.5 text-[8px] text-white/45 transition enabled:hover:bg-white/[0.07] enabled:hover:text-white disabled:opacity-30"
          aria-label="Download benchmark JSON"
        >
          Download
        </button>
        <button
          type="button"
          onClick={clearResults}
          disabled={records.length === 0}
          className="rounded-xl border border-white/8 px-2 py-1.5 text-[8px] text-white/45 transition enabled:hover:bg-white/[0.07] enabled:hover:text-white disabled:opacity-30"
          aria-label="Clear benchmark records"
        >
          Clear
        </button>
      </div>

      <p className="mt-2 font-mono text-[8px] text-white/30" aria-live="polite">
        {records.length} saved · {message}
      </p>
    </div>
  )
}
