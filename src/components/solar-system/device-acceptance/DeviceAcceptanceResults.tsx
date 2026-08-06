'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileJson,
  FolderOpen,
  Gauge,
  Laptop,
  Monitor,
  RefreshCcw,
  ShieldAlert,
  Smartphone,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type {
  AcceptanceDeviceClass,
  AcceptanceEvidenceBundle,
} from './device-acceptance-protocol'
import {
  acceptanceBundleFromWorkspace,
  analyzeAcceptanceBundles,
  buildAcceptanceMarkdownReport,
  createAcceptanceReviewReport,
  dedupeAcceptanceBundles,
  DEVICE_ACCEPTANCE_REVIEW_STORAGE_KEY,
  DEVICE_ACCEPTANCE_WORKSPACE_STORAGE_KEY,
  parseAcceptancePayload,
  REQUIRED_ACCEPTANCE_DEVICE_CLASSES,
  type AcceptanceDeviceReview,
  type AcceptanceRequirementStatus,
  type AcceptanceReviewVerdict,
  type RequiredAcceptanceDeviceClass,
} from './device-acceptance-review'

interface AcceptanceReviewDiagnostics {
  ready: boolean
  verdict: AcceptanceReviewVerdict
  bundleCount: number
  readyDeviceCount: number
  reviewDeviceCount: number
  blockedDeviceCount: number
  missingDeviceClasses: AcceptanceDeviceClass[]
  commitCount: number
  blockerCount: number
  warningCount: number
  updatedAt: number
}

declare global {
  interface Window {
    __SOLAR_DEVICE_ACCEPTANCE_REVIEW__?: AcceptanceReviewDiagnostics
  }
}

const DEVICE_META: Record<RequiredAcceptanceDeviceClass, {
  label: string
  note: string
}> = {
  'integrated-laptop': {
    label: 'Integrated laptop',
    note: 'Intel or AMD integrated graphics · Balanced primary capture',
  },
  'discrete-desktop': {
    label: 'Discrete desktop',
    note: 'Dedicated desktop GPU · Ultra primary capture',
  },
  'android-phone': {
    label: 'Android phone',
    note: 'Portrait and landscape · Eco primary capture',
  },
}

function readStoredBundles() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DEVICE_ACCEPTANCE_REVIEW_STORAGE_KEY)
    if (!raw) return []
    return parseAcceptancePayload(JSON.parse(raw)).bundles
  } catch {
    return []
  }
}

function downloadText(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function timestampFileStem() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function formatMetric(value: number | null, suffix = '') {
  return value === null ? '—' : `${value.toFixed(1)}${suffix}`
}

function formatBytes(value: number | null) {
  return value === null ? '—' : `${(value / 1024 / 1024).toFixed(1)} MB`
}

function verdictTone(verdict: AcceptanceReviewVerdict) {
  if (verdict === 'ready') {
    return 'border-emerald-200/20 bg-emerald-200/[0.075] text-emerald-100'
  }
  if (verdict === 'blocked') {
    return 'border-rose-200/20 bg-rose-200/[0.075] text-rose-100'
  }
  return 'border-amber-200/20 bg-amber-200/[0.075] text-amber-100'
}

function requirementTone(status: AcceptanceRequirementStatus) {
  if (status === 'pass') return 'border-emerald-200/10 bg-emerald-200/[0.035]'
  if (status === 'fail') return 'border-rose-200/12 bg-rose-200/[0.04]'
  return 'border-amber-200/12 bg-amber-200/[0.04]'
}

function VerdictGlyph({
  verdict,
  className,
}: {
  verdict: AcceptanceReviewVerdict
  className?: string
}) {
  if (verdict === 'ready') return <CheckCircle2 className={className} />
  if (verdict === 'blocked') return <XCircle className={className} />
  return <AlertTriangle className={className} />
}

function RequirementGlyph({
  status,
  className,
}: {
  status: AcceptanceRequirementStatus
  className?: string
}) {
  if (status === 'pass') return <CheckCircle2 className={className} />
  if (status === 'fail') return <XCircle className={className} />
  return <AlertTriangle className={className} />
}

function DeviceGlyph({
  deviceClass,
  className,
}: {
  deviceClass: RequiredAcceptanceDeviceClass
  className?: string
}) {
  if (deviceClass === 'integrated-laptop') return <Laptop className={className} />
  if (deviceClass === 'discrete-desktop') return <Monitor className={className} />
  return <Smartphone className={className} />
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/7 bg-black/22 px-3 py-2.5">
      <span className="block text-[8px] uppercase tracking-[0.14em] text-white/28">
        {label}
      </span>
      <span className="mt-1 block font-mono text-[11px] text-white/72">
        {value}
      </span>
    </div>
  )
}

function DeviceReviewCard({ review }: { review: AcceptanceDeviceReview }) {
  const meta = DEVICE_META[review.deviceClass]

  return (
    <section
      className={`overflow-hidden rounded-3xl border ${verdictTone(review.verdict)}`}
      data-device-review={review.deviceClass}
      data-device-verdict={review.verdict}
    >
      <header className="flex flex-col gap-3 border-b border-white/7 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25">
            <DeviceGlyph deviceClass={review.deviceClass} className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.18em] opacity-55">
              {meta.note}
            </p>
            <h2 className="mt-1 text-base font-semibold text-white/92">{review.label}</h2>
            <p className="mt-1 text-[10px] text-white/42">
              {review.renderer ?? 'GPU renderer not recorded'}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em]">
          <VerdictGlyph verdict={review.verdict} className="h-3.5 w-3.5" />
          {review.verdict}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-1.5 p-4 sm:grid-cols-4">
        <MetricCard
          label="Primary FPS"
          value={formatMetric(review.primarySession?.summary.medianFps ?? null)}
        />
        <MetricCard
          label="Thermal change"
          value={formatMetric(
            review.thermalSession?.summary.fpsDegradationPercent ?? null,
            '%'
          )}
        />
        <MetricCard label="Bundles" value={String(review.bundleCount)} />
        <MetricCard label="Screenshots" value={String(review.screenshotCount)} />
        <MetricCard
          label="Texture drift"
          value={formatMetric(review.resourceDrift.textureDelta)}
        />
        <MetricCard
          label="Geometry drift"
          value={formatMetric(review.resourceDrift.geometryDelta)}
        />
        <MetricCard
          label="Heap drift"
          value={formatBytes(review.resourceDrift.heapDeltaBytes)}
        />
        <MetricCard
          label="Diagnostics"
          value={review.primarySession
            ? `${Math.round(review.primarySession.summary.diagnosticsCoverage * 100)}%`
            : '—'}
        />
      </div>

      <div className="space-y-1.5 border-t border-white/7 p-4">
        {review.requirements.map((requirement) => (
          <div
            key={requirement.id}
            className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 ${requirementTone(requirement.status)}`}
          >
            <RequirementGlyph
              status={requirement.status}
              className="mt-0.5 h-4 w-4 shrink-0 opacity-75"
            />
            <div>
              <p className="text-[10px] font-medium text-white/82">
                {requirement.label}
              </p>
              <p className="mt-0.5 text-[9px] leading-relaxed text-white/42">
                {requirement.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function MissingDeviceCard({
  deviceClass,
}: {
  deviceClass: RequiredAcceptanceDeviceClass
}) {
  const meta = DEVICE_META[deviceClass]
  return (
    <section
      className="rounded-3xl border border-dashed border-rose-200/18 bg-rose-200/[0.025] p-5"
      data-device-review={deviceClass}
      data-device-verdict="blocked"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/8 bg-black/25">
          <DeviceGlyph deviceClass={deviceClass} className="h-5 w-5 text-white/42" />
        </div>
        <div>
          <p className="text-[8px] uppercase tracking-[0.16em] text-rose-100/45">
            Missing evidence
          </p>
          <h2 className="mt-1 text-base font-semibold text-white/82">{meta.label}</h2>
          <p className="mt-2 text-[10px] leading-relaxed text-white/38">{meta.note}</p>
        </div>
      </div>
    </section>
  )
}

export default function DeviceAcceptanceResults() {
  const [bundles, setBundles] = useState<AcceptanceEvidenceBundle[]>(readStoredBundles)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState(
    'Import the exported JSON bundle from each target device.'
  )
  const analysis = useMemo(() => analyzeAcceptanceBundles(bundles), [bundles])

  useEffect(() => {
    window.localStorage.setItem(
      DEVICE_ACCEPTANCE_REVIEW_STORAGE_KEY,
      JSON.stringify(bundles)
    )
  }, [bundles])

  useEffect(() => {
    const diagnostics: AcceptanceReviewDiagnostics = {
      ready: true,
      verdict: analysis.verdict,
      bundleCount: analysis.bundleCount,
      readyDeviceCount: analysis.readyDeviceCount,
      reviewDeviceCount: analysis.reviewDeviceCount,
      blockedDeviceCount: analysis.blockedDeviceCount,
      missingDeviceClasses: analysis.missingDeviceClasses,
      commitCount: analysis.commitShas.length,
      blockerCount: analysis.blockers.length,
      warningCount: analysis.warnings.length,
      updatedAt: Date.now(),
    }
    window.__SOLAR_DEVICE_ACCEPTANCE_REVIEW__ = diagnostics
    return () => {
      if (window.__SOLAR_DEVICE_ACCEPTANCE_REVIEW__ === diagnostics) {
        delete window.__SOLAR_DEVICE_ACCEPTANCE_REVIEW__
      }
    }
  }, [analysis])

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const files = [...(input.files ?? [])]
    const imported: AcceptanceEvidenceBundle[] = []
    const nextErrors: string[] = []

    for (const file of files) {
      try {
        const parsed = parseAcceptancePayload(JSON.parse(await file.text()))
        imported.push(...parsed.bundles)
        nextErrors.push(...parsed.errors.map((error) => `${file.name}: ${error}`))
      } catch {
        nextErrors.push(`${file.name}: invalid JSON.`)
      }
    }

    setBundles((current) => dedupeAcceptanceBundles([...imported, ...current]))
    setErrors(nextErrors)
    setMessage(
      `Imported ${imported.length} valid bundle${imported.length === 1 ? '' : 's'} from ${files.length} file${files.length === 1 ? '' : 's'}.`
    )
    input.value = ''
  }

  function loadLocalWorkspace() {
    try {
      const raw = window.localStorage.getItem(
        DEVICE_ACCEPTANCE_WORKSPACE_STORAGE_KEY
      )
      if (!raw) {
        setMessage('This browser does not contain local acceptance sessions.')
        return
      }
      const bundle = acceptanceBundleFromWorkspace(
        JSON.parse(raw),
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null
      )
      if (!bundle) {
        setMessage('The local acceptance workspace is incomplete or invalid.')
        return
      }
      setBundles((current) => dedupeAcceptanceBundles([bundle, ...current]))
      setErrors([])
      setMessage('Loaded the current browser acceptance workspace.')
    } catch {
      setMessage('The current browser acceptance workspace could not be read.')
    }
  }

  function removeBundle(index: number) {
    setBundles((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setMessage('Removed one imported evidence bundle.')
  }

  function clearReview() {
    setBundles([])
    setErrors([])
    setMessage('Review workspace cleared. Original downloaded bundles were not modified.')
  }

  function exportJson() {
    downloadText(
      `solar-device-merge-readiness-${timestampFileStem()}.json`,
      JSON.stringify(createAcceptanceReviewReport(bundles), null, 2),
      'application/json'
    )
    setMessage('Downloaded the merge-readiness report with normalized source bundles.')
  }

  function exportMarkdown() {
    downloadText(
      `solar-device-merge-readiness-${timestampFileStem()}.md`,
      buildAcceptanceMarkdownReport(analysis),
      'text/markdown'
    )
    setMessage('Downloaded the reviewer-friendly Markdown report.')
  }

  return (
    <main
      className="min-h-screen bg-[#02030a] px-4 py-5 text-white sm:px-6 sm:py-8"
      data-device-acceptance-review
      data-review-verdict={analysis.verdict}
    >
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-200/60">
              P2.2 · Evidence review
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Device merge-readiness workspace
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/44">
              Combine the integrated-laptop, discrete-desktop, and Android bundles,
              validate the complete hardware matrix, and produce one traceable merge verdict.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/lab/device-acceptance"
              className="rounded-xl border border-white/9 bg-white/[0.035] px-3 py-2 text-[10px] text-white/58"
            >
              Capture lab
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-white/9 bg-white/[0.035] px-3 py-2 text-[10px] text-white/58"
            >
              Solar Explorer
            </Link>
          </div>
        </header>

        <section className={`mt-5 overflow-hidden rounded-3xl border ${verdictTone(analysis.verdict)}`}>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25">
                <VerdictGlyph verdict={analysis.verdict} className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-58">
                  Overall gate
                </p>
                <h2 className="mt-1 text-xl font-semibold uppercase tracking-wide">
                  {analysis.verdict}
                </h2>
                <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-white/50">
                  {analysis.blockers[0]
                    ?? analysis.warnings[0]
                    ?? 'All required device, runtime, visual, thermal, and recovery evidence is present.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:w-[330px]">
              <MetricCard label="Ready" value={String(analysis.readyDeviceCount)} />
              <MetricCard label="Review" value={String(analysis.reviewDeviceCount)} />
              <MetricCard label="Blocked" value={String(analysis.blockedDeviceCount)} />
            </div>
          </div>
          <div className="grid gap-px border-t border-white/8 bg-white/8 sm:grid-cols-3">
            <div className="bg-[#07090f] px-4 py-3">
              <p className="text-[8px] uppercase tracking-[0.16em] text-white/30">Bundles</p>
              <p className="mt-1 font-mono text-sm text-white/72">{analysis.bundleCount}</p>
            </div>
            <div className="bg-[#07090f] px-4 py-3">
              <p className="text-[8px] uppercase tracking-[0.16em] text-white/30">Commit provenance</p>
              <p className="mt-1 truncate font-mono text-[10px] text-white/62">
                {analysis.commitShas.join(', ') || 'Not recorded'}
              </p>
            </div>
            <div className="bg-[#07090f] px-4 py-3">
              <p className="text-[8px] uppercase tracking-[0.16em] text-white/30">Device matrix</p>
              <p className="mt-1 font-mono text-sm text-white/72">
                {analysis.devices.length}/{REQUIRED_ACCEPTANCE_DEVICE_CLASSES.length}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-white/8 bg-white/[0.025] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Evidence sources
              </p>
              <p className="mt-1 text-[10px] text-white/32">{message}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-200 px-3 py-2.5 text-[10px] font-semibold text-black">
                <Upload className="h-4 w-4" /> Import JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  multiple
                  onChange={importFiles}
                  className="sr-only"
                  data-testid="review-import"
                />
              </label>
              <button
                type="button"
                onClick={loadLocalWorkspace}
                className="flex items-center gap-2 rounded-xl border border-white/9 bg-white/[0.035] px-3 py-2.5 text-[10px] text-white/58"
                data-testid="review-load-local"
              >
                <FolderOpen className="h-4 w-4" /> This browser
              </button>
              <button
                type="button"
                onClick={exportJson}
                disabled={bundles.length === 0}
                className="flex items-center gap-2 rounded-xl border border-white/9 bg-white/[0.035] px-3 py-2.5 text-[10px] text-white/58 disabled:opacity-35"
                data-testid="review-export-json"
              >
                <FileJson className="h-4 w-4" /> Report JSON
              </button>
              <button
                type="button"
                onClick={exportMarkdown}
                disabled={bundles.length === 0}
                className="flex items-center gap-2 rounded-xl border border-white/9 bg-white/[0.035] px-3 py-2.5 text-[10px] text-white/58 disabled:opacity-35"
                data-testid="review-export-markdown"
              >
                <Download className="h-4 w-4" /> Markdown
              </button>
              <button
                type="button"
                onClick={clearReview}
                disabled={bundles.length === 0}
                className="flex items-center gap-2 rounded-xl border border-white/9 bg-white/[0.035] px-3 py-2.5 text-[10px] text-white/42 disabled:opacity-35"
              >
                <RefreshCcw className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>

          {errors.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-rose-200/15 bg-rose-200/[0.055] p-3 text-[10px] text-rose-100/75">
              {errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          ) : null}

          {bundles.length > 0 ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {bundles.map((bundle, index) => (
                <div
                  key={`${bundle.device.label}:${bundle.generatedAt}:${index}`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/7 bg-black/20 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium text-white/76">
                      {bundle.device.label}
                    </p>
                    <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-white/30">
                      {bundle.device.deviceClass} · {bundle.sessions.length} sessions · {bundle.screenshots.length} screenshots
                    </p>
                    <p className="mt-1 truncate font-mono text-[8px] text-white/25">
                      {bundle.source.commitSha ?? 'commit not recorded'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBundle(index)}
                    className="rounded-xl border border-white/7 p-2 text-white/30 hover:text-rose-200"
                    aria-label={`Remove ${bundle.device.label} bundle`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {(analysis.blockers.length > 0 || analysis.warnings.length > 0) ? (
          <section className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-3xl border border-rose-200/12 bg-rose-200/[0.035] p-4">
              <div className="flex items-center gap-2 text-rose-100/80">
                <ShieldAlert className="h-4 w-4" />
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em]">Blocking findings</h2>
              </div>
              <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-white/48">
                {analysis.blockers.length > 0
                  ? analysis.blockers.map((item) => <p key={item}>• {item}</p>)
                  : <p>No blocking finding.</p>}
              </div>
            </div>
            <div className="rounded-3xl border border-amber-200/12 bg-amber-200/[0.035] p-4">
              <div className="flex items-center gap-2 text-amber-100/80">
                <Gauge className="h-4 w-4" />
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em]">Reviewer attention</h2>
              </div>
              <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-white/48">
                {analysis.warnings.length > 0
                  ? analysis.warnings.map((item) => <p key={item}>• {item}</p>)
                  : <p>No review warning.</p>}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-4 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
            <ClipboardCheck className="h-4 w-4 text-cyan-200/60" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
              Cross-device matrix
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-white/7 text-[8px] uppercase tracking-[0.14em] text-white/28">
                <tr>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-3 py-3">Gate</th>
                  <th className="px-3 py-3">Primary</th>
                  <th className="px-3 py-3">Median FPS</th>
                  <th className="px-3 py-3">P95 interval</th>
                  <th className="px-3 py-3">Thermal change</th>
                  <th className="px-3 py-3">Battery</th>
                  <th className="px-3 py-3">Max dispatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-[10px] text-white/52">
                {REQUIRED_ACCEPTANCE_DEVICE_CLASSES.map((deviceClass) => {
                  const review = analysis.devices.find((item) => item.deviceClass === deviceClass)
                  return (
                    <tr key={deviceClass}>
                      <td className="px-4 py-3 font-medium text-white/76">{DEVICE_META[deviceClass].label}</td>
                      <td className="px-3 py-3 uppercase">{review?.verdict ?? 'missing'}</td>
                      <td className="px-3 py-3">{review?.expectedPrimaryQuality ?? '—'}</td>
                      <td className="px-3 py-3 font-mono">{formatMetric(review?.primarySession?.summary.medianFps ?? null)}</td>
                      <td className="px-3 py-3 font-mono">{formatMetric(review?.primarySession?.summary.medianP95FrameIntervalMs ?? null, ' ms')}</td>
                      <td className="px-3 py-3 font-mono">{formatMetric(review?.thermalSession?.summary.fpsDegradationPercent ?? null, '%')}</td>
                      <td className="px-3 py-3 font-mono">{formatMetric(review?.thermalSession?.summary.batteryDeltaPercent ?? null, '%')}</td>
                      <td className="px-3 py-3 font-mono">{formatMetric(review?.primarySession?.summary.maximumDispatchMs ?? null, ' ms')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {analysis.devices.map((review) => (
            <DeviceReviewCard key={review.deviceClass} review={review} />
          ))}
          {analysis.missingDeviceClasses.map((deviceClass) => (
            <MissingDeviceCard key={deviceClass} deviceClass={deviceClass} />
          ))}
        </div>
      </div>
    </main>
  )
}
