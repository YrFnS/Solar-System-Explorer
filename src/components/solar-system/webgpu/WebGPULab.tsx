'use client'

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { Canvas, extend } from '@react-three/fiber'
import type { WebGLRenderer as LegacyWebGLRenderer } from 'three'
import * as THREE from 'three/webgpu'
import WebGPULabScene, { type LabFrameMetrics } from './WebGPULabScene'

extend(THREE as any)

type RequestedBackend = 'auto' | 'webgl'
type ActualBackend = 'webgpu' | 'webgl2' | 'unknown'
type RendererStatus = 'idle' | 'initializing' | 'ready' | 'error'
type AdapterStatus = 'not-requested' | 'available' | 'unavailable' | 'error'

interface BackendLike {
  isWebGPUBackend?: boolean
  isWebGLBackend?: boolean
  compatibilityMode?: boolean | null
  constructor?: { name?: string }
}

interface BackendSelection {
  forceWebGL: boolean
  device?: unknown
  adapterStatus: AdapterStatus
  fallbackReason: string | null
}

interface RendererInfo {
  status: RendererStatus
  actual: ActualBackend
  backendClass: string
  compatibilityMode: boolean | null
  initializationMs: number | null
  adapterStatus: AdapterStatus
  fallbackReason: string | null
  error: string | null
}

interface LabDiagnostics {
  requestedBackend: RequestedBackend
  actualBackend: ActualBackend
  backendClass: string
  webgpuApiAvailable: boolean
  adapterStatus: AdapterStatus
  fallbackReason: string | null
  compatibilityMode: boolean | null
  initializationMs: number | null
  metrics: LabFrameMetrics | null
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_LAB__?: LabDiagnostics
  }
}

const EMPTY_RENDERER_INFO: RendererInfo = {
  status: 'idle',
  actual: 'unknown',
  backendClass: 'Not initialized',
  compatibilityMode: null,
  initializationMs: null,
  adapterStatus: 'not-requested',
  fallbackReason: null,
  error: null,
}

function readRequestedBackend(): RequestedBackend {
  if (typeof window === 'undefined') return 'auto'
  return new URLSearchParams(window.location.search).get('backend') === 'webgl'
    ? 'webgl'
    : 'auto'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function selectBackend(requestedBackend: RequestedBackend): Promise<BackendSelection> {
  if (requestedBackend === 'webgl') {
    return {
      forceWebGL: true,
      adapterStatus: 'not-requested',
      fallbackReason: null,
    }
  }

  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return {
      forceWebGL: true,
      adapterStatus: 'unavailable',
      fallbackReason: 'navigator.gpu is unavailable in this browser.',
    }
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    }) ?? await navigator.gpu.requestAdapter()

    if (!adapter) {
      return {
        forceWebGL: true,
        adapterStatus: 'unavailable',
        fallbackReason: 'The browser exposed WebGPU, but no usable GPU adapter was returned.',
      }
    }

    const device = await adapter.requestDevice({
      requiredFeatures: [...adapter.features],
    })

    return {
      forceWebGL: false,
      device,
      adapterStatus: 'available',
      fallbackReason: null,
    }
  } catch (error) {
    return {
      forceWebGL: true,
      adapterStatus: 'error',
      fallbackReason: `WebGPU adapter preflight failed: ${errorMessage(error)}`,
    }
  }
}

async function createRenderer(
  canvasProps: unknown,
  selection: BackendSelection
) {
  const renderer = new THREE.WebGPURenderer({
    ...(canvasProps as Record<string, unknown>),
    antialias: false,
    samples: 0,
    alpha: false,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    outputBufferType: THREE.UnsignedByteType,
    forceWebGL: selection.forceWebGL,
    ...(selection.device ? { device: selection.device } : {}),
  } as ConstructorParameters<typeof THREE.WebGPURenderer>[0])

  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  try {
    await renderer.init()
    return renderer
  } catch (error) {
    renderer.dispose()
    throw error
  }
}

function inspectBackend(renderer: THREE.WebGPURenderer) {
  const backend = (renderer as unknown as { backend?: BackendLike }).backend
  const actual: ActualBackend = backend?.isWebGPUBackend
    ? 'webgpu'
    : backend?.isWebGLBackend
      ? 'webgl2'
      : 'unknown'

  return {
    actual,
    backendClass: backend?.constructor?.name ?? 'Unknown backend',
    compatibilityMode: backend?.compatibilityMode ?? null,
  }
}

class LabRendererBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[webgpu-lab] renderer boundary', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="absolute inset-0 grid place-items-center bg-[#02030a] px-4 text-white">
        <section className="w-full max-w-md rounded-3xl border border-rose-300/15 bg-black/70 p-6 shadow-2xl backdrop-blur-xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-rose-200/60">
            Renderer initialization failed
          </p>
          <h1 className="mt-2 text-xl font-semibold">The laboratory could not start this backend.</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/45">
            {this.state.error.message}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.assign('/lab/webgpu?backend=webgl')}
              className="rounded-xl bg-cyan-200 px-4 py-2 text-xs font-semibold text-black"
            >
              Retry with WebGL 2 backend
            </button>
            <Link
              href="/"
              className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              Return to production explorer
            </Link>
          </div>
        </section>
      </div>
    )
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
      <span className="block text-[8px] font-semibold uppercase tracking-[0.16em] text-white/30">
        {label}
      </span>
      <span className="mt-1 block font-mono text-[11px] text-white/75">{value}</span>
    </div>
  )
}

export default function WebGPULab() {
  const [requestedBackend, setRequestedBackend] = useState<RequestedBackend>(readRequestedBackend)
  const [rendererInfo, setRendererInfo] = useState<RendererInfo>(EMPTY_RENDERER_INFO)
  const [metrics, setMetrics] = useState<LabFrameMetrics | null>(null)
  const generationRef = useRef(0)
  const webgpuApiAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator

  const rendererFactory = useCallback(async (canvasProps: unknown) => {
    const generation = generationRef.current
    const startedAt = performance.now()
    let selection: BackendSelection = {
      forceWebGL: requestedBackend === 'webgl',
      adapterStatus: 'not-requested',
      fallbackReason: null,
    }

    queueMicrotask(() => {
      if (generation !== generationRef.current) return
      setRendererInfo({
        ...EMPTY_RENDERER_INFO,
        status: 'initializing',
      })
    })

    try {
      selection = await selectBackend(requestedBackend)
      let renderer: THREE.WebGPURenderer

      try {
        renderer = await createRenderer(canvasProps, selection)
      } catch (error) {
        if (requestedBackend !== 'auto' || selection.forceWebGL) throw error

        selection = {
          ...selection,
          forceWebGL: true,
          device: undefined,
          fallbackReason: `WebGPU renderer initialization failed: ${errorMessage(error)}`,
        }
        renderer = await createRenderer(canvasProps, selection)
      }

      const backend = inspectBackend(renderer)
      const initializationMs = performance.now() - startedAt

      queueMicrotask(() => {
        if (generation !== generationRef.current) {
          renderer.dispose()
          return
        }
        setRendererInfo({
          status: 'ready',
          ...backend,
          initializationMs,
          adapterStatus: selection.adapterStatus,
          fallbackReason: selection.fallbackReason,
          error: null,
        })
      })

      return renderer as unknown as LegacyWebGLRenderer
    } catch (error) {
      const message = errorMessage(error)
      queueMicrotask(() => {
        if (generation !== generationRef.current) return
        setRendererInfo({
          ...EMPTY_RENDERER_INFO,
          status: 'error',
          adapterStatus: selection.adapterStatus,
          fallbackReason: selection.fallbackReason,
          error: message,
        })
      })
      throw error
    }
  }, [requestedBackend])

  const switchBackend = useCallback((next: RequestedBackend) => {
    if (next === requestedBackend) return
    generationRef.current += 1
    setMetrics(null)
    setRendererInfo({
      ...EMPTY_RENDERER_INFO,
      status: 'initializing',
    })
    setRequestedBackend(next)

    const url = new URL(window.location.href)
    if (next === 'webgl') url.searchParams.set('backend', 'webgl')
    else url.searchParams.delete('backend')
    window.history.replaceState(null, '', url)
  }, [requestedBackend])

  const handleMetrics = useCallback((nextMetrics: LabFrameMetrics) => {
    setMetrics(nextMetrics)
  }, [])

  useEffect(() => {
    window.__SOLAR_WEBGPU_LAB__ = {
      requestedBackend,
      actualBackend: rendererInfo.actual,
      backendClass: rendererInfo.backendClass,
      webgpuApiAvailable,
      adapterStatus: rendererInfo.adapterStatus,
      fallbackReason: rendererInfo.fallbackReason,
      compatibilityMode: rendererInfo.compatibilityMode,
      initializationMs: rendererInfo.initializationMs,
      metrics,
    }
  }, [metrics, rendererInfo, requestedBackend, webgpuApiAvailable])

  const actualLabel = rendererInfo.actual === 'webgpu'
    ? 'WebGPU'
    : rendererInfo.actual === 'webgl2'
      ? 'WebGL 2 backend'
      : rendererInfo.status === 'initializing'
        ? 'Initializing…'
        : 'Not initialized'
  const actualTone = rendererInfo.actual === 'webgpu'
    ? 'text-emerald-200'
    : rendererInfo.actual === 'webgl2'
      ? 'text-sky-200'
      : 'text-white/45'
  const adapterLabel = rendererInfo.adapterStatus === 'available'
    ? 'available'
    : rendererInfo.adapterStatus === 'unavailable'
      ? 'unavailable'
      : rendererInfo.adapterStatus === 'error'
        ? 'probe failed'
        : 'not requested'
  const fallbackActive = requestedBackend === 'auto'
    && rendererInfo.status === 'ready'
    && rendererInfo.actual === 'webgl2'

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#02030a] text-white">
      <LabRendererBoundary key={requestedBackend}>
        <Canvas
          key={requestedBackend}
          camera={{
            position: [0, 34, 62],
            fov: 44,
            near: 0.1,
            far: 400,
          }}
          dpr={[0.75, 1.35]}
          frameloop="always"
          performance={{ min: 0.5, max: 1, debounce: 300 }}
          gl={rendererFactory}
          fallback={(
            <div className="grid h-full w-full place-items-center bg-[#02030a] text-white/60">
              This browser cannot initialize the laboratory canvas.
            </div>
          )}
        >
          <WebGPULabScene onMetrics={handleMetrics} />
        </Canvas>
      </LabRendererBoundary>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-5">
        <aside className="pointer-events-auto max-h-[calc(100vh-1.5rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-3xl border border-white/10 bg-[#060914]/88 shadow-2xl backdrop-blur-2xl">
          <header className="border-b border-white/10 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.26em] text-cyan-200/65">
                  Isolated experiment
                </p>
                <h1 className="mt-1 text-lg font-semibold">WebGPU / TSL laboratory</h1>
              </div>
              <Link
                href="/"
                className="rounded-xl border border-white/10 px-2.5 py-1.5 text-[9px] text-white/45 transition hover:bg-white/10 hover:text-white"
              >
                Production ↗
              </Link>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-white/42">
              A minimal Sun-and-planets parity scene using backend-neutral node materials. The production explorer remains unchanged on WebGL 2.
            </p>
          </header>

          <section className="space-y-4 p-4 sm:p-5">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/30">
                Requested renderer
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchBackend('auto')}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                    requestedBackend === 'auto'
                      ? 'border-emerald-300/35 bg-emerald-300/10'
                      : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="block text-[10px] font-semibold">Auto WebGPU</span>
                  <span className="mt-1 block text-[8px] leading-relaxed text-white/35">
                    WebGPU first, WebGL 2 fallback
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => switchBackend('webgl')}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                    requestedBackend === 'webgl'
                      ? 'border-sky-300/35 bg-sky-300/10'
                      : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="block text-[10px] font-semibold">Force WebGL 2</span>
                  <span className="mt-1 block text-[8px] leading-relaxed text-white/35">
                    Same renderer and TSL graph
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/25 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/30">
                  Actual backend
                </span>
                <span className={`font-mono text-[10px] font-semibold ${actualTone}`}>
                  {actualLabel}
                </span>
              </div>
              <div className="mt-2 space-y-1 font-mono text-[8px] text-white/35">
                <p>class: {rendererInfo.backendClass}</p>
                <p>navigator.gpu: {webgpuApiAvailable ? 'available' : 'unavailable'}</p>
                <p>adapter preflight: {adapterLabel}</p>
                <p>
                  compatibility mode:{' '}
                  {rendererInfo.compatibilityMode === null
                    ? 'n/a'
                    : rendererInfo.compatibilityMode
                      ? 'active'
                      : 'off'}
                </p>
              </div>
              {fallbackActive ? (
                <p className="mt-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.06] px-3 py-2 text-[9px] leading-relaxed text-sky-100/60">
                  Auto mode selected WebGL 2 safely.{' '}
                  {rendererInfo.fallbackReason ?? 'No usable WebGPU adapter was available.'}
                </p>
              ) : null}
              {rendererInfo.error ? (
                <p className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2 text-[9px] text-rose-100/65">
                  {rendererInfo.error}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/30">
                Live frame sample
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Metric label="FPS" value={metrics ? metrics.fps.toFixed(1) : '—'} />
                <Metric
                  label="Average"
                  value={metrics ? `${metrics.averageFrameMs.toFixed(2)} ms` : '—'}
                />
                <Metric
                  label="P95"
                  value={metrics ? `${metrics.p95FrameMs.toFixed(2)} ms` : '—'}
                />
                <Metric
                  label="Longest"
                  value={metrics ? `${metrics.longestFrameMs.toFixed(2)} ms` : '—'}
                />
                <Metric
                  label="Init"
                  value={rendererInfo.initializationMs === null
                    ? '—'
                    : `${rendererInfo.initializationMs.toFixed(1)} ms`}
                />
                <Metric
                  label="Samples"
                  value={metrics ? String(metrics.samples) : '—'}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200/10 bg-cyan-200/[0.035] p-3.5">
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-cyan-100/45">
                W1 parity scope
              </p>
              <ul className="mt-2 space-y-1 text-[9px] leading-relaxed text-white/42">
                <li>• One ephemeris-driven Sun and eight planets</li>
                <li>• TSL colour graphs on node materials</li>
                <li>• Identical geometry and camera for both backends</li>
                <li>• No production GLSL shaders or post-processing</li>
              </ul>
            </div>
          </section>
        </aside>

        <div className="hidden rounded-full border border-white/10 bg-black/55 px-3 py-2 font-mono text-[9px] text-white/40 backdrop-blur-xl sm:block">
          Drag to orbit · wheel to zoom
        </div>
      </div>
    </main>
  )
}
