'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, Gauge, RefreshCw } from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import SolarSystemV3 from './SolarSystemV3'
import PerformanceDock from './PerformanceDock'
import SimulationController from './SimulationController'
import ScenePerformanceManager from './ScenePerformanceManager'
import SceneLoadScheduler from './SceneLoadScheduler'
import FramePacingController from './FramePacingController'
import FrameUpdateLanes from './FrameUpdateLanes'
import AdaptiveLodManager from './AdaptiveLodManager'
import RendererBoundary from './RendererBoundary'
import RenderDiagnostics from './RenderDiagnostics'
import ScreenshotCaptureBridge from './ScreenshotCaptureBridge'
import TextureLifecycleManager from './textures/TextureLifecycleManager'
import WebGLContextMonitor, {
  WEBGL_CONTEXT_LOST_EVENT,
  WEBGL_CONTEXT_RESTORED_EVENT,
} from './WebGLContextMonitor'
import { installAssetUrlPolicy } from './asset-policy'
import { installModelAvailabilityPolicy } from './model-policy'
import { useSolarSystemStore } from './store'
import {
  getQualityProfile,
  type RendererPowerPreference,
  usePerformanceStore,
} from './performance-store'

installAssetUrlPolicy()
installModelAvailabilityPolicy()

const UIOverlay = dynamic(() => import('./UIOverlayV4'), {
  ssr: false,
  loading: () => null,
})

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export interface SceneContainerProps {
  interfaceMode?: 'full' | 'acceptance'
}

function DeferredInterface() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const idleWindow = window as IdleWindow
    let timeoutHandle: number | undefined
    let idleHandle: number | undefined

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(() => setReady(true), { timeout: 650 })
    } else {
      timeoutHandle = window.setTimeout(() => setReady(true), 220)
    }

    return () => {
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle)
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle)
    }
  }, [])

  if (ready) return <UIOverlay />

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20 sm:left-6 sm:top-5">
      <div className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">
          Solar System Explorer
        </p>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-white/40">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Preparing the interactive scene
        </div>
      </div>
    </div>
  )
}

function ContextRecovery({ onRetryEco }: { onRetryEco: () => void }) {
  return (
    <div
      role="alert"
      className="pointer-events-auto absolute inset-0 z-[100] grid place-items-center bg-[#02030a]/88 px-4 text-white backdrop-blur-xl"
    >
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-rose-200/15 bg-black/75 shadow-2xl">
        <div className="h-0.5 bg-gradient-to-r from-transparent via-rose-300/70 to-transparent" />
        <div className="p-5 sm:p-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-rose-300/15 bg-rose-300/[0.08]">
            <AlertTriangle className="h-5 w-5 text-rose-200/80" />
          </div>
          <p className="mt-4 text-[8px] font-semibold uppercase tracking-[0.24em] text-rose-200/55">
            Renderer interrupted
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white/92">
            The WebGL context was lost
          </h1>
          <p className="mt-2 text-[10px] leading-relaxed text-white/42">
            The browser or graphics driver released the GPU context. The simulation date,
            selected body, bookmarks, and settings are preserved while the scene recovers.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRetryEco}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-amber-300 px-3 py-2.5 text-[9px] font-semibold text-black transition hover:bg-amber-200"
            >
              <Gauge className="h-3.5 w-3.5" /> Rebuild in Eco
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[9px] text-white/60 transition hover:bg-white/[0.09] hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </button>
          </div>
          <p className="mt-3 text-[8px] leading-relaxed text-white/25">
            Recovery can take a moment after display sleep, a GPU reset, or a remote-session change.
          </p>
        </div>
      </section>
    </div>
  )
}

export default function SceneContainer({
  interfaceMode = 'full',
}: SceneContainerProps) {
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const profile = getQualityProfile({ preset, autoQuality })
  const rendererPowerPreference: RendererPowerPreference = preset === 'ultra'
    ? 'high-performance'
    : 'low-power'

  const [rendererGeneration, setRendererGeneration] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)

  useEffect(() => {
    const handleLost = () => setContextLost(true)
    const handleRestored = () => setContextLost(false)

    window.addEventListener(WEBGL_CONTEXT_LOST_EVENT, handleLost)
    window.addEventListener(WEBGL_CONTEXT_RESTORED_EVENT, handleRestored)
    return () => {
      window.removeEventListener(WEBGL_CONTEXT_LOST_EVENT, handleLost)
      window.removeEventListener(WEBGL_CONTEXT_RESTORED_EVENT, handleRestored)
    }
  }, [])

  const retryEco = () => {
    usePerformanceStore.getState().setPreset('eco')
    setContextLost(false)
    setRendererGeneration((generation) => generation + 1)
  }

  return (
    <RendererBoundary>
      <div className="absolute inset-0 z-0">
        <Canvas
          key={`${rendererGeneration}:${rendererPowerPreference}`}
          camera={{
            position: [80, 60, 80],
            fov: 45,
            near: 0.1,
            far: 10000,
          }}
          dpr={profile.dpr}
          frameloop="never"
          performance={{ min: 0.45, max: 1, debounce: 250 }}
          gl={{
            antialias: false,
            alpha: false,
            depth: true,
            stencil: false,
            powerPreference: rendererPowerPreference,
          }}
          onPointerMissed={() => setSelectedBody(null)}
        >
          <SceneLoadScheduler>
            <FrameUpdateLanes>
              <FramePacingController
                rendererPowerPreference={rendererPowerPreference}
              />
              <SimulationController />
              <ScenePerformanceManager />
              <TextureLifecycleManager />
              <AdaptiveLodManager />
              <ScreenshotCaptureBridge />
              <WebGLContextMonitor />
              <RenderDiagnostics />
              <SolarSystemV3 />
            </FrameUpdateLanes>
          </SceneLoadScheduler>
        </Canvas>
      </div>
      {interfaceMode === 'full' ? <DeferredInterface /> : null}
      {interfaceMode === 'full' ? <PerformanceDock /> : null}
      {contextLost ? <ContextRecovery onRetryEco={retryEco} /> : null}
    </RendererBoundary>
  )
}
