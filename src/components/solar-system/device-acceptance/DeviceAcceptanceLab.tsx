'use client'

import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Gauge,
  Laptop,
  Monitor,
  Play,
  RotateCcw,
  Smartphone,
  Square,
  Thermometer,
  Zap,
  XCircle,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import SceneContainer from '../SceneContainer'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  type EffectiveQuality,
  type QualityPreset,
  usePerformanceStore,
} from '../performance-store'
import {
  SCREENSHOT_CAPTURE_EVENT,
  SCREENSHOT_COMPLETE_EVENT,
} from '../ScreenshotCaptureBridge'
import { useSolarSystemStore } from '../store'
import {
  WEBGL_CONTEXT_LOST_EVENT,
  WEBGL_CONTEXT_RESTORED_EVENT,
} from '../WebGLContextMonitor'
import {
  createDefaultManualChecks,
  DEVICE_ACCEPTANCE_SCHEMA,
  DEVICE_ACCEPTANCE_SCHEMA_VERSION,
  readDiagnosticBoolean,
  readDiagnosticNumber,
  summarizeAcceptanceSession,
  type AcceptanceBatterySnapshot,
  type AcceptanceCompletion,
  type AcceptanceDeviceClass,
  type AcceptanceDeviceProfile,
  type AcceptanceDiagnosticsSnapshot,
  type AcceptanceEvent,
  type AcceptanceEventType,
  type AcceptanceEvidenceBundle,
  type AcceptanceManualChecks,
  type AcceptanceSample,
  type AcceptanceScenario,
  type AcceptanceScreenshotEvidence,
  type AcceptanceSession,
  type AcceptanceVerdict,
  type JsonValue,
} from './device-acceptance-protocol'

const STORAGE_KEY = 'solar-explorer-device-acceptance-v1'
const DEFAULT_PROFILE_DURATION_SECONDS = 60
const DEFAULT_THERMAL_DURATION_SECONDS = 15 * 60
const DEFAULT_SAMPLE_INTERVAL_MS = 1_000
const FAST_PROFILE_DURATION_SECONDS = 6
const FAST_THERMAL_DURATION_SECONDS = 12
const FAST_SAMPLE_INTERVAL_MS = 500

interface BatteryManagerLike extends EventTarget {
  charging: boolean
  chargingTime: number
  dischargingTime: number
  level: number
}

interface NavigatorAcceptance extends Navigator {
  deviceMemory?: number
  getBattery?: () => Promise<BatteryManagerLike>
  connection?: {
    effectiveType?: string
    saveData?: boolean
  }
  standalone?: boolean
  gpu?: unknown
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number
  }
}

interface AcceptanceWindow extends Window {
  __SOLAR_EXPLORER_DIAGNOSTICS__?: unknown
  __SOLAR_FRAME_PACING__?: unknown
  __SOLAR_FRAME_LANES__?: unknown
  __SOLAR_SCENE_LOADING__?: unknown
  __SOLAR_PERFORMANCE_POLICY__?: unknown
  __SOLAR_TEXTURE_DIAGNOSTICS__?: unknown
  __SOLAR_TEXTURE_LIFECYCLE__?: unknown
  __SOLAR_ADAPTIVE_LOD__?: unknown
  __SOLAR_SIMULATION_TIMING__?: unknown
  __SOLAR_SMALL_BODY_RUNTIME__?: unknown
  __SOLAR_DEVICE_ACCEPTANCE__?: AcceptanceLabDiagnostics
}

interface StoredWorkspace {
  deviceClass: AcceptanceDeviceClass
  deviceLabel: string
  manualChecks: AcceptanceManualChecks
  screenshots: AcceptanceScreenshotEvidence[]
  sessions: AcceptanceSession[]
}

interface ActiveCapture {
  id: string
  scenario: AcceptanceScenario
  targetDurationSeconds: number
  quality: EffectiveQuality
  startedAt: string
  startedPerformanceMs: number
  device: AcceptanceDeviceProfile
  samples: AcceptanceSample[]
  events: AcceptanceEvent[]
}

interface ActiveStatus {
  scenario: AcceptanceScenario
  elapsedSeconds: number
  targetDurationSeconds: number
  sampleCount: number
}

interface AcceptanceLabDiagnostics {
  ready: boolean
  sceneComplete: boolean
  active: boolean
  activeScenario: AcceptanceScenario | null
  activeSampleCount: number
  sessionCount: number
  screenshotCount: number
  effectiveQuality: EffectiveQuality
  latestFps: number | null
  latestDispatchMs: number | null
  contextLosses: number
  contextRestores: number
  updatedAt: number
}

interface ScreenshotResultDetail {
  ok: boolean
  message?: string
}

const DEFAULT_WORKSPACE: StoredWorkspace = {
  deviceClass: 'other',
  deviceLabel: '',
  manualChecks: createDefaultManualChecks(),
  screenshots: [],
  sessions: [],
}

const DEVICE_OPTIONS: Array<{
  id: AcceptanceDeviceClass
  label: string
  icon: typeof Laptop
}> = [
  { id: 'integrated-laptop', label: 'Integrated laptop', icon: Laptop },
  { id: 'discrete-desktop', label: 'Discrete desktop', icon: Monitor },
  { id: 'android-phone', label: 'Android phone', icon: Smartphone },
  { id: 'other', label: 'Other device', icon: Gauge },
]

const QUALITY_OPTIONS: Array<{ id: QualityPreset; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'eco', label: 'Eco' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'ultra', label: 'Ultra' },
]

const CHECK_LABELS: Array<{
  key: Exclude<keyof AcceptanceManualChecks, 'notes'>
  label: string
}> = [
  { key: 'interactionResponsive', label: 'Orbit, zoom, search, select, and panels stay responsive' },
  { key: 'visualParityEco', label: 'Eco screenshot approved' },
  { key: 'visualParityBalanced', label: 'Balanced screenshot approved' },
  { key: 'visualParityUltra', label: 'Ultra screenshot approved' },
  { key: 'portraitApproved', label: 'Phone portrait composition approved' },
  { key: 'landscapeApproved', label: 'Phone landscape composition approved' },
  { key: 'sleepResumeApproved', label: 'Display sleep and resume approved' },
  { key: 'contextRecoveryApproved', label: 'WebGL context recovery approved' },
  { key: 'thermalApproved', label: '10–15 minute thermal session approved' },
]

function createId(prefix: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${suffix}`
}

function cloneJson(value: unknown): JsonValue {
  if (value === undefined) return null

  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue
  } catch {
    return null
  }
}

function orientationLabel() {
  return screen.orientation?.type
    ?? (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait')
}

function readWorkspace(): StoredWorkspace {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WORKSPACE
    const parsed = JSON.parse(raw) as Partial<StoredWorkspace>
    const deviceClass = DEVICE_OPTIONS.some((option) => option.id === parsed.deviceClass)
      ? parsed.deviceClass as AcceptanceDeviceClass
      : 'other'

    return {
      deviceClass,
      deviceLabel: typeof parsed.deviceLabel === 'string' ? parsed.deviceLabel : '',
      manualChecks: {
        ...createDefaultManualChecks(),
        ...(parsed.manualChecks ?? {}),
      },
      screenshots: Array.isArray(parsed.screenshots) ? parsed.screenshots : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    }
  } catch {
    return DEFAULT_WORKSPACE
  }
}

function normalizeTimer(value: number) {
  return Number.isFinite(value) ? value : null
}

function getBatterySnapshot(
  battery: BatteryManagerLike | null
): AcceptanceBatterySnapshot | null {
  if (!battery) return null
  return {
    level: battery.level,
    charging: battery.charging,
    chargingTimeSeconds: normalizeTimer(battery.chargingTime),
    dischargingTimeSeconds: normalizeTimer(battery.dischargingTime),
  }
}

function readGraphicsProfile() {
  const canvas = document.querySelector('canvas')
  const webgl2 = canvas?.getContext('webgl2') ?? null
  const webgl = webgl2 ?? canvas?.getContext('webgl') ?? null

  if (!webgl) {
    return {
      api: 'unavailable' as const,
      vendor: null,
      renderer: null,
      version: null,
      shadingLanguageVersion: null,
    }
  }

  const debug = webgl.getExtension('WEBGL_debug_renderer_info') as {
    UNMASKED_VENDOR_WEBGL: number
    UNMASKED_RENDERER_WEBGL: number
  } | null

  return {
    api: webgl2 ? 'webgl2' as const : 'webgl' as const,
    vendor: debug
      ? String(webgl.getParameter(debug.UNMASKED_VENDOR_WEBGL))
      : String(webgl.getParameter(webgl.VENDOR)),
    renderer: debug
      ? String(webgl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(webgl.getParameter(webgl.RENDERER)),
    version: String(webgl.getParameter(webgl.VERSION)),
    shadingLanguageVersion: String(
      webgl.getParameter(webgl.SHADING_LANGUAGE_VERSION)
    ),
  }
}

function buildDeviceProfile(
  deviceClass: AcceptanceDeviceClass,
  label: string
): AcceptanceDeviceProfile {
  const nav = navigator as NavigatorAcceptance
  const connection = nav.connection
  const cleanLabel = label.trim()

  return {
    id: createId('device'),
    label: cleanLabel || `${DEVICE_OPTIONS.find((option) => option.id === deviceClass)?.label ?? 'Device'} · ${navigator.platform || 'unknown platform'}`,
    deviceClass,
    capturedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    language: navigator.language,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      orientation: orientationLabel(),
    },
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
    },
    capabilityHints: {
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemoryGb: nav.deviceMemory ?? null,
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      saveData: connection?.saveData ?? null,
      effectiveConnectionType: connection?.effectiveType ?? null,
      standalone: Boolean(
        nav.standalone
        || window.matchMedia('(display-mode: standalone)').matches
      ),
      batteryApi: typeof nav.getBattery === 'function',
      webgpuApi: nav.gpu !== undefined,
    },
    graphics: readGraphicsProfile(),
  }
}

function readDiagnostics(): AcceptanceDiagnosticsSnapshot {
  const diagnosticWindow = window as unknown as AcceptanceWindow
  return {
    explorer: cloneJson(diagnosticWindow.__SOLAR_EXPLORER_DIAGNOSTICS__),
    framePacing: cloneJson(diagnosticWindow.__SOLAR_FRAME_PACING__),
    frameLanes: cloneJson(diagnosticWindow.__SOLAR_FRAME_LANES__),
    sceneLoading: cloneJson(diagnosticWindow.__SOLAR_SCENE_LOADING__),
    performancePolicy: cloneJson(diagnosticWindow.__SOLAR_PERFORMANCE_POLICY__),
    textures: cloneJson(diagnosticWindow.__SOLAR_TEXTURE_DIAGNOSTICS__),
    textureLifecycle: cloneJson(diagnosticWindow.__SOLAR_TEXTURE_LIFECYCLE__),
    adaptiveLod: cloneJson(diagnosticWindow.__SOLAR_ADAPTIVE_LOD__),
    simulationTiming: cloneJson(diagnosticWindow.__SOLAR_SIMULATION_TIMING__),
    smallBodies: cloneJson(diagnosticWindow.__SOLAR_SMALL_BODY_RUNTIME__),
  }
}

function captureSample(
  startedPerformanceMs: number,
  battery: BatteryManagerLike | null
): AcceptanceSample {
  const performanceState = usePerformanceStore.getState()
  const memory = (performance as PerformanceWithMemory).memory

  return {
    capturedAt: new Date().toISOString(),
    elapsedMs: Math.max(0, performance.now() - startedPerformanceMs),
    quality: getEffectiveQuality(performanceState),
    visibility: document.visibilityState,
    orientation: orientationLabel(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    battery: getBatterySnapshot(battery),
    usedJsHeapBytes: memory?.usedJSHeapSize ?? null,
    diagnostics: readDiagnostics(),
  }
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(2, '0')}`
    : `${remainder}s`
}

function formatMetric(value: number | null, suffix = '') {
  return value === null ? '—' : `${value.toFixed(1)}${suffix}`
}

function verdictTone(verdict: AcceptanceVerdict) {
  if (verdict === 'pass') return 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
  if (verdict === 'fail') return 'border-rose-300/20 bg-rose-300/[0.08] text-rose-100'
  return 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
}

function verdictIcon(verdict: AcceptanceVerdict) {
  if (verdict === 'pass') return CheckCircle2
  if (verdict === 'fail') return XCircle
  return AlertTriangle
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/7 bg-black/25 px-2.5 py-2">
      <span className="block text-[8px] uppercase tracking-[0.14em] text-white/28">
        {label}
      </span>
      <span className="mt-1 block font-mono text-[11px] text-white/72">
        {value}
      </span>
    </div>
  )
}

export default function DeviceAcceptanceLab() {
  const [ready, setReady] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [message, setMessage] = useState(
    'Choose the physical device class, let the scene settle, then capture evidence.'
  )
  const [workspace, setWorkspace] = useState<StoredWorkspace>(readWorkspace)
  const [liveSample, setLiveSample] = useState<AcceptanceSample | null>(null)
  const [activeStatus, setActiveStatus] = useState<ActiveStatus | null>(null)
  const [batteryAvailable, setBatteryAvailable] = useState(false)
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const setPreset = usePerformanceStore((state) => state.setPreset)
  const effectiveQuality = getEffectiveQuality({ preset, autoQuality })
  const activeRef = useRef<ActiveCapture | null>(null)
  const captureTimerRef = useRef<number | null>(null)
  const batteryRef = useRef<BatteryManagerLike | null>(null)
  const contextLossesRef = useRef(0)
  const contextRestoresRef = useRef(0)
  const pageStartedRef = useRef(
    typeof performance === 'undefined' ? 0 : performance.now()
  )
  const fastMode = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('acceptance-fast') === '1'
  }, [])
  const profileDurationSeconds = fastMode
    ? FAST_PROFILE_DURATION_SECONDS
    : DEFAULT_PROFILE_DURATION_SECONDS
  const thermalDurationSeconds = fastMode
    ? FAST_THERMAL_DURATION_SECONDS
    : DEFAULT_THERMAL_DURATION_SECONDS
  const sampleIntervalMs = fastMode
    ? FAST_SAMPLE_INTERVAL_MS
    : DEFAULT_SAMPLE_INTERVAL_MS

  const appendActiveEvent = useCallback((
    type: AcceptanceEventType,
    detail?: string
  ) => {
    const active = activeRef.current
    if (!active) return
    active.events.push({
      type,
      detail,
      capturedAt: new Date().toISOString(),
      elapsedMs: Math.max(0, performance.now() - active.startedPerformanceMs),
    })
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('diagnostics') !== '1') {
      url.searchParams.set('diagnostics', '1')
      window.history.replaceState(null, '', url)
    }
    queueMicrotask(() => setReady(true))
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  }, [workspace])

  useEffect(() => {
    if (!ready) return

    const update = () => {
      setLiveSample(captureSample(pageStartedRef.current, batteryRef.current))
    }
    queueMicrotask(update)
    const handle = window.setInterval(update, 1_000)
    return () => window.clearInterval(handle)
  }, [ready])

  useEffect(() => {
    const nav = navigator as NavigatorAcceptance
    if (!nav.getBattery) return

    nav.getBattery().then((battery) => {
      batteryRef.current = battery
      queueMicrotask(() => setBatteryAvailable(true))
    }).catch(() => {
      batteryRef.current = null
    })
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      appendActiveEvent(
        document.visibilityState === 'hidden'
          ? 'visibility-hidden'
          : 'visibility-visible'
      )
    }
    const handleOrientation = () => {
      appendActiveEvent('orientation-change', orientationLabel())
    }
    const handleContextLost = () => {
      contextLossesRef.current += 1
      appendActiveEvent('context-lost')
    }
    const handleContextRestored = () => {
      contextRestoresRef.current += 1
      appendActiveEvent('context-restored')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('orientationchange', handleOrientation)
    window.addEventListener(WEBGL_CONTEXT_LOST_EVENT, handleContextLost)
    window.addEventListener(WEBGL_CONTEXT_RESTORED_EVENT, handleContextRestored)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('orientationchange', handleOrientation)
      window.removeEventListener(WEBGL_CONTEXT_LOST_EVENT, handleContextLost)
      window.removeEventListener(WEBGL_CONTEXT_RESTORED_EVENT, handleContextRestored)
    }
  }, [appendActiveEvent])

  useEffect(() => () => {
    if (captureTimerRef.current !== null) {
      window.clearInterval(captureTimerRef.current)
    }
  }, [])

  const sceneComplete = liveSample
    ? readDiagnosticBoolean(liveSample.diagnostics.sceneLoading, 'complete') === true
    : false
  const latestFps = liveSample
    ? readDiagnosticNumber(liveSample.diagnostics.framePacing, 'actualFps')
    : null
  const targetFps = liveSample
    ? readDiagnosticNumber(liveSample.diagnostics.framePacing, 'targetFps')
    : null
  const latestDispatchMs = liveSample
    ? readDiagnosticNumber(liveSample.diagnostics.frameLanes, 'lastDispatchMs')
    : null
  const drawCalls = liveSample
    ? readDiagnosticNumber(liveSample.diagnostics.explorer, 'drawCalls')
    : null
  const textures = liveSample
    ? readDiagnosticNumber(liveSample.diagnostics.explorer, 'textures')
    : null
  const batteryLevel = liveSample?.battery
    ? liveSample.battery.level * 100
    : null

  function finishCapture(completion: AcceptanceCompletion) {
    const active = activeRef.current
    if (!active) return

    if (captureTimerRef.current !== null) {
      window.clearInterval(captureTimerRef.current)
      captureTimerRef.current = null
    }

    active.events.push({
      type: completion === 'completed' ? 'capture-completed' : 'capture-stopped',
      capturedAt: new Date().toISOString(),
      elapsedMs: Math.max(0, performance.now() - active.startedPerformanceMs),
    })
    const summary = summarizeAcceptanceSession({
      scenario: active.scenario,
      completion,
      targetDurationSeconds: active.targetDurationSeconds,
      quality: active.quality,
      deviceClass: active.device.deviceClass,
      samples: active.samples,
      events: active.events,
    })
    const session: AcceptanceSession = {
      id: active.id,
      schema: DEVICE_ACCEPTANCE_SCHEMA,
      schemaVersion: DEVICE_ACCEPTANCE_SCHEMA_VERSION,
      scenario: active.scenario,
      completion,
      targetDurationSeconds: active.targetDurationSeconds,
      quality: active.quality,
      startedAt: active.startedAt,
      endedAt: new Date().toISOString(),
      device: active.device,
      samples: active.samples,
      events: active.events,
      summary,
    }

    activeRef.current = null
    setActiveStatus(null)
    setWorkspace((current) => ({
      ...current,
      sessions: [session, ...current.sessions].slice(0, 24),
    }))
    setMessage(
      `${active.scenario === 'thermal' ? 'Thermal' : 'Profile'} capture finished with a ${summary.verdict.toUpperCase()} automated signal.`
    )
  }

  function startCapture(scenario: AcceptanceScenario) {
    if (activeRef.current) return
    if (!sceneComplete) {
      setMessage('The staged scene is still settling. Start the capture after diagnostics report complete.')
      return
    }

    const targetDurationSeconds = scenario === 'thermal'
      ? thermalDurationSeconds
      : profileDurationSeconds
    const device = buildDeviceProfile(
      workspace.deviceClass,
      workspace.deviceLabel
    )
    const startedPerformanceMs = performance.now()
    const startedAt = new Date().toISOString()
    const active: ActiveCapture = {
      id: createId('acceptance'),
      scenario,
      targetDurationSeconds,
      quality: effectiveQuality,
      startedAt,
      startedPerformanceMs,
      device,
      samples: [],
      events: [{
        type: 'capture-started',
        capturedAt: startedAt,
        elapsedMs: 0,
        detail: `${effectiveQuality}:${scenario}`,
      }],
    }

    activeRef.current = active
    setActiveStatus({
      scenario,
      elapsedSeconds: 0,
      targetDurationSeconds,
      sampleCount: 0,
    })
    setMessage(
      `${scenario === 'thermal' ? 'Thermal' : 'Profile'} capture started in ${QUALITY_PROFILES[effectiveQuality].label}. Keep the scene active and interact naturally.`
    )

    const sample = () => {
      const current = activeRef.current
      if (!current) return
      const nextSample = captureSample(
        current.startedPerformanceMs,
        batteryRef.current
      )
      current.samples.push(nextSample)
      setLiveSample(nextSample)
      const elapsedSeconds = nextSample.elapsedMs / 1_000
      setActiveStatus({
        scenario: current.scenario,
        elapsedSeconds,
        targetDurationSeconds: current.targetDurationSeconds,
        sampleCount: current.samples.length,
      })
      if (elapsedSeconds >= current.targetDurationSeconds) {
        finishCapture('completed')
      }
    }

    sample()
    captureTimerRef.current = window.setInterval(sample, sampleIntervalMs)
  }

  function testContextRecovery() {
    if (!activeRef.current) {
      setMessage('Start a capture before testing context recovery so the lost and restored events are preserved.')
      return
    }
    const canvas = document.querySelector('canvas')
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl') ?? null
    const extension = gl?.getExtension('WEBGL_lose_context') as {
      loseContext: () => void
      restoreContext: () => void
    } | null

    if (!extension) {
      setMessage('This browser does not expose WEBGL_lose_context. Use display sleep and resume instead.')
      return
    }

    appendActiveEvent('context-test-requested')
    setMessage('WebGL context recovery test started. The scene should show recovery and return without losing state.')
    extension.loseContext()
    window.setTimeout(() => extension.restoreContext(), 1_600)
  }

  function markSleepResume() {
    appendActiveEvent('sleep-marker', 'Tester is about to lock the display or put the device to sleep.')
    setMessage('Sleep marker recorded. Lock the display, then return and confirm the scene resumes correctly.')
  }

  function captureScreenshot() {
    const canvas = document.querySelector('canvas')
    if (!canvas) {
      setMessage('The scene canvas is not available yet.')
      return
    }

    const capturedAt = new Date().toISOString()
    const fileName = `solar-${effectiveQuality}-${orientationLabel()}-${capturedAt.replace(/[:.]/g, '-')}.webp`
    let timeoutHandle = 0

    const handleComplete = (event: Event) => {
      window.clearTimeout(timeoutHandle)
      const detail = (event as CustomEvent<ScreenshotResultDetail>).detail
      if (!detail?.ok) {
        setMessage(detail?.message ?? 'The renderer could not capture the scene.')
        return
      }

      const objectUrl = useSolarSystemStore.getState().screenshotGallery.at(-1)
      if (!objectUrl) {
        setMessage('The renderer completed the capture but did not expose an image URL.')
        return
      }

      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()

      const evidence: AcceptanceScreenshotEvidence = {
        id: createId('screenshot'),
        fileName,
        capturedAt,
        quality: effectiveQuality,
        orientation: orientationLabel(),
        width: canvas.width,
        height: canvas.height,
      }
      setWorkspace((current) => ({
        ...current,
        screenshots: [evidence, ...current.screenshots].slice(0, 18),
      }))
      appendActiveEvent('screenshot', fileName)
      setMessage(`Downloaded ${QUALITY_PROFILES[effectiveQuality].label} visual evidence.`)
    }

    window.addEventListener(SCREENSHOT_COMPLETE_EVENT, handleComplete, { once: true })
    timeoutHandle = window.setTimeout(() => {
      window.removeEventListener(SCREENSHOT_COMPLETE_EVENT, handleComplete)
      setMessage('Screenshot capture timed out before the renderer responded.')
    }, 12_000)
    window.dispatchEvent(new Event(SCREENSHOT_CAPTURE_EVENT))
  }

  function exportEvidence() {
    const device = workspace.sessions[0]?.device
      ?? buildDeviceProfile(workspace.deviceClass, workspace.deviceLabel)
    const payload: AcceptanceEvidenceBundle = {
      schema: DEVICE_ACCEPTANCE_SCHEMA,
      schemaVersion: DEVICE_ACCEPTANCE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      source: {
        route: window.location.pathname,
        commitSha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null,
      },
      device,
      manualChecks: workspace.manualChecks,
      screenshots: workspace.screenshots,
      sessions: workspace.sessions,
    }
    const url = URL.createObjectURL(new Blob([
      JSON.stringify(payload, null, 2),
    ], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `solar-device-acceptance-${device.deviceClass}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage(`Exported ${workspace.sessions.length} session${workspace.sessions.length === 1 ? '' : 's'} and ${workspace.screenshots.length} screenshot record${workspace.screenshots.length === 1 ? '' : 's'}.`)
  }

  function clearEvidence() {
    if (activeRef.current) return
    setWorkspace((current) => ({
      ...DEFAULT_WORKSPACE,
      deviceClass: current.deviceClass,
      deviceLabel: current.deviceLabel,
    }))
    setMessage('Local device-acceptance evidence cleared.')
  }

  const progress = activeStatus
    ? Math.min(1, activeStatus.elapsedSeconds / activeStatus.targetDurationSeconds)
    : 0
  const latestSession = workspace.sessions[0] ?? null
  const automatedPasses = workspace.sessions.filter(
    (session) => session.summary.verdict === 'pass'
  ).length
  const manualApproved = CHECK_LABELS.every(
    ({ key }) => workspace.manualChecks[key]
  )

  useEffect(() => {
    if (!ready) return
    const diagnosticWindow = window as unknown as AcceptanceWindow
    const diagnostics: AcceptanceLabDiagnostics = {
      ready,
      sceneComplete,
      active: activeStatus !== null,
      activeScenario: activeStatus?.scenario ?? null,
      activeSampleCount: activeStatus?.sampleCount ?? 0,
      sessionCount: workspace.sessions.length,
      screenshotCount: workspace.screenshots.length,
      effectiveQuality,
      latestFps,
      latestDispatchMs,
      contextLosses: contextLossesRef.current,
      contextRestores: contextRestoresRef.current,
      updatedAt: Date.now(),
    }
    diagnosticWindow.__SOLAR_DEVICE_ACCEPTANCE__ = diagnostics

    return () => {
      if (diagnosticWindow.__SOLAR_DEVICE_ACCEPTANCE__ === diagnostics) {
        delete diagnosticWindow.__SOLAR_DEVICE_ACCEPTANCE__
      }
    }
  }, [
    activeStatus,
    effectiveQuality,
    latestDispatchMs,
    latestFps,
    ready,
    sceneComplete,
    workspace.screenshots.length,
    workspace.sessions.length,
  ])

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#02030a] px-4 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-5 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/65">
            Device acceptance
          </p>
          <p className="mt-2 text-sm text-white/55">Enabling production diagnostics…</p>
        </div>
      </main>
    )
  }

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-black text-white"
      data-device-acceptance-lab
    >
      <SceneContainer interfaceMode="acceptance" />

      <div className="pointer-events-none absolute left-3 top-3 z-[115] sm:left-4 sm:top-4">
        <Link
          href="/"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/58 shadow-2xl backdrop-blur-xl transition hover:bg-black/80 hover:text-white"
        >
          Solar Explorer
        </Link>
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="pointer-events-auto fixed bottom-3 right-3 z-[120] flex items-center gap-2 rounded-full border border-amber-200/20 bg-[#07090f]/95 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-100 shadow-2xl backdrop-blur-2xl"
          aria-label="Open device acceptance controls"
        >
          <Activity className="h-4 w-4" /> Acceptance lab <ChevronUp className="h-3.5 w-3.5" />
        </button>
      ) : (
        <aside className="pointer-events-auto fixed bottom-2 left-2 right-2 z-[120] max-h-[58vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#05070d]/94 shadow-2xl backdrop-blur-2xl sm:bottom-3 sm:left-auto sm:right-3 sm:top-3 sm:max-h-none sm:w-[430px]">
          <div className="sticky top-0 z-10 border-b border-white/8 bg-[#05070d]/94 px-4 py-3 backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-amber-200/58">
                  P2.1 · Physical device acceptance
                </p>
                <h1 className="mt-1 text-sm font-semibold text-white/92">
                  Merge-readiness evidence lab
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-2 text-white/45 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Collapse device acceptance controls"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-white/38">
              This page runs the real production WebGL scene. Captures are stored locally until exported; no telemetry is uploaded.
            </p>
            <div className="mt-3 rounded-xl border border-white/7 bg-black/20 px-3 py-2 text-[9px] leading-relaxed text-white/46">
              {message}
            </div>
          </div>

          <div className="space-y-4 p-4">
            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                  Live production signals
                </p>
                <span className={`flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${
                  sceneComplete ? 'text-emerald-200/70' : 'text-amber-200/65'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    sceneComplete ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'
                  }`} />
                  {sceneComplete ? 'Settled' : 'Warming'}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <MetricCard label="Paced FPS" value={latestFps === null ? '—' : `${latestFps.toFixed(1)} / ${targetFps ?? '—'}`} />
                <MetricCard label="Dispatch" value={formatMetric(latestDispatchMs, ' ms')} />
                <MetricCard label="Draws" value={drawCalls === null ? '—' : String(drawCalls)} />
                <MetricCard label="Textures" value={textures === null ? '—' : String(textures)} />
                <MetricCard label="Battery" value={batteryAvailable ? formatMetric(batteryLevel, '%') : 'N/A'} />
                <MetricCard label="Quality" value={QUALITY_PROFILES[effectiveQuality].label} />
              </div>
            </section>

            <section className="rounded-2xl border border-white/7 bg-white/[0.025] p-3">
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                Device identity
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {DEVICE_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const selected = workspace.deviceClass === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={activeStatus !== null}
                      onClick={() => setWorkspace((current) => ({
                        ...current,
                        deviceClass: option.id,
                      }))}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[9px] transition ${
                        selected
                          ? 'border-amber-200/30 bg-amber-200/[0.09] text-amber-100'
                          : 'border-white/6 bg-black/15 text-white/48 hover:border-white/14 hover:text-white/72'
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {option.label}
                    </button>
                  )
                })}
              </div>
              <input
                value={workspace.deviceLabel}
                disabled={activeStatus !== null}
                onChange={(event) => setWorkspace((current) => ({
                  ...current,
                  deviceLabel: event.target.value,
                }))}
                placeholder="Device label, e.g. ThinkPad T14 · Ryzen 7"
                className="mt-2 w-full rounded-xl border border-white/7 bg-black/25 px-3 py-2 text-[9px] text-white/72 outline-none placeholder:text-white/22 focus:border-amber-200/25 disabled:opacity-45"
              />
            </section>

            <section>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                Quality under test
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={activeStatus !== null}
                    onClick={() => setPreset(option.id)}
                    className={`rounded-xl border px-2 py-2 text-[9px] font-medium transition ${
                      preset === option.id
                        ? 'border-cyan-200/28 bg-cyan-200/[0.09] text-cyan-100'
                        : 'border-white/6 bg-white/[0.02] text-white/42 hover:border-white/14 hover:text-white/70'
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/7 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                    Automated capture
                  </p>
                  <p className="mt-1 text-[9px] text-white/34">
                    {fastMode ? 'CI fast mode' : '60s profile · 15m thermal'}
                  </p>
                </div>
                {activeStatus ? (
                  <span className="font-mono text-[9px] text-amber-100/75">
                    {formatDuration(activeStatus.elapsedSeconds)} / {formatDuration(activeStatus.targetDurationSeconds)}
                  </span>
                ) : null}
              </div>

              {activeStatus ? (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-300 to-cyan-300 transition-[width]"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[8px] text-white/32">
                    <span>{activeStatus.sampleCount} samples</span>
                    <span>{activeStatus.scenario}</span>
                  </div>
                  <button
                    type="button"
                    data-testid="acceptance-stop"
                    onClick={() => finishCapture('stopped')}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/18 bg-rose-200/[0.07] px-3 py-2.5 text-[9px] font-semibold text-rose-100 transition hover:bg-rose-200/[0.12]"
                  >
                    <Square className="h-3.5 w-3.5" /> Stop and keep partial evidence
                  </button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="acceptance-start-profile"
                    disabled={!sceneComplete}
                    onClick={() => startCapture('profile')}
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-2.5 text-[9px] font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Play className="h-3.5 w-3.5" /> Profile capture
                  </button>
                  <button
                    type="button"
                    disabled={!sceneComplete}
                    onClick={() => startCapture('thermal')}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/9 bg-white/[0.04] px-3 py-2.5 text-[9px] font-semibold text-white/62 transition hover:bg-white/[0.09] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Thermometer className="h-3.5 w-3.5" /> Thermal capture
                  </button>
                </div>
              )}
            </section>

            <section>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                Recovery and visual evidence
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={captureScreenshot}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/7 bg-white/[0.025] px-2 py-2.5 text-[8px] text-white/50 transition hover:border-white/15 hover:text-white/80"
                >
                  <Camera className="h-4 w-4" /> Screenshot
                </button>
                <button
                  type="button"
                  onClick={markSleepResume}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/7 bg-white/[0.025] px-2 py-2.5 text-[8px] text-white/50 transition hover:border-white/15 hover:text-white/80"
                >
                  <BatteryCharging className="h-4 w-4" /> Sleep marker
                </button>
                <button
                  type="button"
                  onClick={testContextRecovery}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/7 bg-white/[0.025] px-2 py-2.5 text-[8px] text-white/50 transition hover:border-white/15 hover:text-white/80"
                >
                  <Zap className="h-4 w-4" /> GPU recovery
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/7 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                  Human acceptance checklist
                </p>
                <span className={`text-[8px] font-semibold uppercase tracking-[0.14em] ${
                  manualApproved ? 'text-emerald-200/70' : 'text-white/28'
                }`}>
                  {manualApproved ? 'Complete' : 'Required before merge'}
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {CHECK_LABELS.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/5 bg-black/15 px-2.5 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={workspace.manualChecks[key]}
                      onChange={(event) => setWorkspace((current) => ({
                        ...current,
                        manualChecks: {
                          ...current.manualChecks,
                          [key]: event.target.checked,
                        },
                      }))}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber-300"
                    />
                    <span className="text-[9px] leading-relaxed text-white/46">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              <textarea
                value={workspace.manualChecks.notes}
                onChange={(event) => setWorkspace((current) => ({
                  ...current,
                  manualChecks: {
                    ...current.manualChecks,
                    notes: event.target.value,
                  },
                }))}
                placeholder="Thermal behavior, fan noise, visual differences, driver details, or reproduction notes…"
                className="mt-2 min-h-20 w-full resize-y rounded-xl border border-white/7 bg-black/25 px-3 py-2 text-[9px] leading-relaxed text-white/62 outline-none placeholder:text-white/20 focus:border-amber-200/25"
              />
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                  Captured sessions
                </p>
                <span
                  data-testid="acceptance-session-count"
                  className="font-mono text-[8px] text-white/34"
                >
                  {workspace.sessions.length} total · {automatedPasses} pass
                </span>
              </div>

              {latestSession ? (
                <div className={`mt-2 rounded-2xl border p-3 ${verdictTone(latestSession.summary.verdict)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = verdictIcon(latestSession.summary.verdict)
                        return <Icon className="h-4 w-4" />
                      })()}
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.14em]">
                          {latestSession.summary.verdict} · {latestSession.scenario}
                        </p>
                        <p className="mt-0.5 text-[8px] opacity-60">
                          {QUALITY_PROFILES[latestSession.quality].label} · {formatDuration(latestSession.summary.durationSeconds)}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[8px] opacity-60">
                      {latestSession.summary.sampleCount} samples
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    <MetricCard label="Median FPS" value={formatMetric(latestSession.summary.medianFps)} />
                    <MetricCard label="Max dispatch" value={formatMetric(latestSession.summary.maximumDispatchMs, ' ms')} />
                    <MetricCard label="Coverage" value={`${Math.round(latestSession.summary.diagnosticsCoverage * 100)}%`} />
                  </div>
                  <p className="mt-2 text-[8px] leading-relaxed opacity-65">
                    {latestSession.summary.reasons[0]}
                  </p>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-dashed border-white/8 px-3 py-4 text-center text-[9px] text-white/27">
                  No local sessions yet.
                </div>
              )}
            </section>

            <section className="grid grid-cols-2 gap-2 border-t border-white/8 pt-4">
              <button
                type="button"
                data-testid="acceptance-export"
                onClick={exportEvidence}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-200 px-3 py-2.5 text-[9px] font-semibold text-black transition hover:bg-cyan-100"
              >
                <Download className="h-3.5 w-3.5" /> Export JSON
              </button>
              <button
                type="button"
                disabled={activeStatus !== null}
                onClick={clearEvidence}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-[9px] text-white/48 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Clear local data
              </button>
            </section>
          </div>
        </aside>
      )}
    </main>
  )
}
