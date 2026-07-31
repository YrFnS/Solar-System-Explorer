'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  analyzeBenchmarkRecords,
  dedupeBenchmarkRecords,
  parseBenchmarkPayload,
  type BenchmarkAnalysis,
  type BenchmarkModeComparison,
  type BenchmarkPairVerdict,
  type BenchmarkRecord,
  type BenchmarkRecommendation,
} from './lab-benchmark-analysis'
import {
  LAB_BENCHMARK_SCHEMA,
  LAB_BENCHMARK_SCHEMA_VERSION,
  LAB_BENCHMARK_STORAGE_KEY,
} from './lab-benchmark-protocol'

const DECISION_REPORT_SCHEMA = 'solar-system-explorer-webgpu-decision-report'
const DECISION_REPORT_VERSION = 1

interface BenchmarkAnalysisDiagnostics {
  recordCount: number
  validRecordCount: number
  distinctDevices: number
  completeDevices: number
  matchedComparisons: number
  recommendation: BenchmarkRecommendation
  confidence: BenchmarkAnalysis['confidence']
  errorCount: number
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_BENCHMARK_ANALYSIS__?: BenchmarkAnalysisDiagnostics
  }
}

function recommendationTone(recommendation: BenchmarkRecommendation) {
  if (recommendation === 'consider-webgpu-default') {
    return 'border-emerald-200/20 bg-emerald-200/[0.08] text-emerald-100'
  }
  if (recommendation === 'offer-webgpu-opt-in') {
    return 'border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100'
  }
  if (recommendation === 'keep-webgl2') {
    return 'border-amber-200/20 bg-amber-200/[0.08] text-amber-100'
  }
  return 'border-white/10 bg-white/[0.035] text-white/70'
}

function verdictLabel(verdict: BenchmarkPairVerdict) {
  if (verdict === 'webgpu-faster') return 'WebGPU faster'
  if (verdict === 'webgl2-faster') return 'WebGL 2 faster'
  if (verdict === 'equivalent') return 'Equivalent'
  return 'Mixed result'
}

function verdictTone(verdict: BenchmarkPairVerdict) {
  if (verdict === 'webgpu-faster') return 'text-emerald-200'
  if (verdict === 'webgl2-faster') return 'text-amber-200'
  if (verdict === 'equivalent') return 'text-sky-200'
  return 'text-fuchsia-200'
}

function formatDelta(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

function MetricDelta({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
      <span className="block text-[8px] uppercase tracking-[0.12em] text-white/25">
        {label}
      </span>
      <span className={`mt-1 block font-mono text-[10px] ${
        value >= 5
          ? 'text-emerald-200/80'
          : value <= -8
            ? 'text-amber-200/80'
            : 'text-white/60'
      }`}>
        {formatDelta(value)}
      </span>
    </div>
  )
}

function ComparisonCard({ comparison }: { comparison: BenchmarkModeComparison }) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] uppercase tracking-[0.18em] text-white/30">
            {comparison.mode === 'bloom' ? 'Bloom pipeline' : 'Direct rendering'}
          </p>
          <p className={`mt-1 text-[10px] font-semibold ${verdictTone(comparison.verdict)}`}>
            {verdictLabel(comparison.verdict)}
          </p>
        </div>
        <span className="font-mono text-[8px] text-white/30">
          {comparison.webgpu.records} GPU · {comparison.webgl2.records} GL
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        <MetricDelta label="Average" value={comparison.improvement.averageFrameMs} />
        <MetricDelta label="P95" value={comparison.improvement.p95FrameMs} />
        <MetricDelta label="Longest" value={comparison.improvement.longestFrameMs} />
        <MetricDelta label="FPS" value={comparison.improvement.fps} />
        <MetricDelta label="Init" value={comparison.improvement.initializationMs} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[8px] text-white/36">
        <div className="rounded-xl border border-white/6 bg-black/15 px-2.5 py-2">
          <span className="block text-white/25">WebGPU median</span>
          <span className="mt-1 block">
            {comparison.webgpu.averageFrameMs.toFixed(2)} ms avg · {comparison.webgpu.p95FrameMs.toFixed(2)} ms P95
          </span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/15 px-2.5 py-2">
          <span className="block text-white/25">WebGL 2 median</span>
          <span className="mt-1 block">
            {comparison.webgl2.averageFrameMs.toFixed(2)} ms avg · {comparison.webgl2.p95FrameMs.toFixed(2)} ms P95
          </span>
        </div>
      </div>
    </section>
  )
}

function mergeRecords(current: BenchmarkRecord[], incoming: BenchmarkRecord[]) {
  return dedupeBenchmarkRecords([...incoming, ...current]).sort((a, b) => (
    b.capturedAt.localeCompare(a.capturedAt)
  ))
}

export default function LabBenchmarkResults() {
  const [records, setRecords] = useState<BenchmarkRecord[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState(
    'Load the current browser session or import benchmark JSON from physical devices.'
  )
  const analysis = useMemo(() => analyzeBenchmarkRecords(records), [records])

  useEffect(() => {
    const diagnostics: BenchmarkAnalysisDiagnostics = {
      recordCount: analysis.recordCount,
      validRecordCount: analysis.validRecordCount,
      distinctDevices: analysis.distinctDevices,
      completeDevices: analysis.completeDevices,
      matchedComparisons: analysis.matchedComparisons,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      errorCount: errors.length,
    }
    window.__SOLAR_WEBGPU_BENCHMARK_ANALYSIS__ = diagnostics

    return () => {
      if (window.__SOLAR_WEBGPU_BENCHMARK_ANALYSIS__ === diagnostics) {
        delete window.__SOLAR_WEBGPU_BENCHMARK_ANALYSIS__
      }
    }
  }, [analysis, errors.length])

  const loadCurrentSession = () => {
    try {
      const raw = window.sessionStorage.getItem(LAB_BENCHMARK_STORAGE_KEY)
      if (!raw) {
        setMessage('No benchmark records are stored in this browser tab.')
        return
      }
      const parsed = parseBenchmarkPayload(JSON.parse(raw))
      setRecords((current) => mergeRecords(current, parsed.records))
      setErrors(parsed.errors)
      setMessage(`Loaded ${parsed.records.length} record${parsed.records.length === 1 ? '' : 's'} from this browser session.`)
    } catch {
      setErrors(['The current browser session contains invalid benchmark JSON.'])
      setMessage('Could not load the current browser session.')
    }
  }

  const importFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const files = [...(input.files ?? [])]
    const imported: BenchmarkRecord[] = []
    const nextErrors: string[] = []

    for (const file of files) {
      try {
        const parsed = parseBenchmarkPayload(JSON.parse(await file.text()))
        imported.push(...parsed.records)
        nextErrors.push(...parsed.errors.map((error) => `${file.name}: ${error}`))
      } catch {
        nextErrors.push(`${file.name}: invalid JSON.`)
      }
    }

    setRecords((current) => mergeRecords(current, imported))
    setErrors(nextErrors)
    setMessage(`Imported ${imported.length} valid record${imported.length === 1 ? '' : 's'} from ${files.length} file${files.length === 1 ? '' : 's'}.`)
    input.value = ''
  }

  const downloadDecisionReport = () => {
    if (records.length === 0) return
    const payload = {
      schema: DECISION_REPORT_SCHEMA,
      schemaVersion: DECISION_REPORT_VERSION,
      benchmarkSchema: LAB_BENCHMARK_SCHEMA,
      benchmarkSchemaVersion: LAB_BENCHMARK_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      analysis,
      records,
    }
    const url = URL.createObjectURL(new Blob([
      JSON.stringify(payload, null, 2),
    ], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `solar-webgpu-decision-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage('Downloaded the evidence report with raw records and the derived recommendation.')
  }

  const clear = () => {
    setRecords([])
    setErrors([])
    setMessage('Evidence workspace cleared. Stored benchmark sessions were not modified.')
  }

  return (
    <main className="min-h-screen bg-[#02030a] px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="rounded-3xl border border-white/10 bg-[#060914]/90 p-5 shadow-2xl backdrop-blur-2xl sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-200/60">
                WebGPU evidence review
              </p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
                Turn device captures into a renderer decision
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/45">
                This workspace pairs WebGPU and WebGL 2 only when they came from the same device, viewport, DPR, camera, simulation epoch, texture workload, and scene settings. Positive deltas mean WebGPU was faster.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/lab/webgpu"
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:bg-white/10 hover:text-white"
              >
                Back to laboratory
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:bg-white/10 hover:text-white"
              >
                Production explorer
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={loadCurrentSession}
              className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06] px-4 py-3 text-left transition hover:bg-cyan-200/[0.1]"
            >
              <span className="block text-xs font-semibold text-cyan-100/80">Load current session</span>
              <span className="mt-1 block text-[10px] text-white/35">Use captures recorded in this browser tab.</span>
            </button>
            <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 transition hover:bg-white/[0.07]">
              <span className="block text-xs font-semibold text-white/75">Import benchmark JSON</span>
              <span className="mt-1 block text-[10px] text-white/35">Select one or many device exports.</span>
              <input
                type="file"
                accept="application/json,.json"
                multiple
                onChange={importFiles}
                className="sr-only"
                aria-label="Import benchmark JSON files"
              />
            </label>
            <button
              type="button"
              onClick={downloadDecisionReport}
              disabled={records.length === 0}
              className="rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.06] px-4 py-3 text-left transition enabled:hover:bg-emerald-200/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span className="block text-xs font-semibold text-emerald-100/80">Download decision report</span>
              <span className="mt-1 block text-[10px] text-white/35">Includes raw evidence and analysis.</span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[9px] text-white/32" aria-live="polite">
              {message}
            </p>
            <button
              type="button"
              onClick={clear}
              disabled={records.length === 0 && errors.length === 0}
              className="text-[9px] text-white/30 transition enabled:hover:text-white disabled:opacity-30"
            >
              Clear workspace
            </button>
          </div>

          {errors.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-3 text-[10px] text-amber-100/65">
              {errors.slice(0, 6).map((error) => <p key={error}>{error}</p>)}
              {errors.length > 6 ? <p>…and {errors.length - 6} more validation messages.</p> : null}
            </div>
          ) : null}
        </header>

        <section className={`mt-5 rounded-3xl border p-5 sm:p-6 ${recommendationTone(analysis.recommendation)}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] opacity-55">
                Current recommendation
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {analysis.recommendationLabel}
              </h2>
              <p className="mt-2 text-xs opacity-55">
                Confidence: {analysis.confidence} · conservative thresholds · no cross-device pairing
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Records', analysis.validRecordCount],
                ['Devices', analysis.distinctDevices],
                ['Complete', analysis.completeDevices],
                ['Pairs', analysis.matchedComparisons],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-current/10 bg-black/15 px-3 py-2 text-center">
                  <span className="block text-[8px] uppercase tracking-[0.12em] opacity-40">{label}</span>
                  <span className="mt-1 block font-mono text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-1.5 text-[10px] leading-relaxed opacity-60 sm:grid-cols-2">
            {analysis.rationale.map((reason) => <p key={reason}>• {reason}</p>)}
          </div>
        </section>

        {analysis.devices.length === 0 ? (
          <section className="mt-5 grid min-h-64 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <div className="max-w-lg">
              <p className="text-sm font-semibold text-white/65">No matched device evidence yet</p>
              <p className="mt-2 text-xs leading-relaxed text-white/35">
                Record WebGPU and WebGL 2 with bloom on and off on each physical device. Import the exported JSON files here; records with different viewports, DPRs, cameras, or workloads will not be paired.
              </p>
            </div>
          </section>
        ) : (
          <div className="mt-5 space-y-4">
            {analysis.devices.map((device) => (
              <article key={device.fingerprint} className="rounded-3xl border border-white/10 bg-[#060914]/82 p-4 shadow-xl sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white/78">{device.label}</p>
                    <p className="mt-1 font-mono text-[9px] text-white/32">
                      {device.hardware} · {device.recordCount} records
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] ${
                    device.complete
                      ? 'border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-100/65'
                      : 'border-amber-200/15 bg-amber-200/[0.06] text-amber-100/65'
                  }`}>
                    {device.complete ? 'four-way complete' : 'partial evidence'}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {device.comparisons.map((comparison) => (
                    <ComparisonCard key={comparison.mode} comparison={comparison} />
                  ))}
                </div>
                {device.comparisons.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-white/6 bg-black/15 p-3 text-[10px] text-white/35">
                    This device has records, but no compatible WebGPU/WebGL 2 pair with identical workload settings.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <footer className="mx-auto mt-6 max-w-3xl text-center text-[10px] leading-relaxed text-white/28">
          The recommendation covers renderer timing only. Visual parity, crashes, device loss, thermals, fan noise, battery drain, and browser support remain separate release criteria.
        </footer>
      </div>
    </main>
  )
}
