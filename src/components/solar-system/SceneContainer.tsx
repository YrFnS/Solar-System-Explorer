'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Canvas } from '@react-three/fiber'
import SolarSystem from './SolarSystem'
import PerformanceDock from './PerformanceDock'
import ScenePerformanceManager from './ScenePerformanceManager'
import AdaptiveLodManager from './AdaptiveLodManager'
import ProgressiveSceneWarmup, {
  prepareSceneWarmup,
} from './ProgressiveSceneWarmup'
import { installAssetUrlPolicy } from './asset-policy'
import { useSolarSystemStore } from './store'
import { getQualityProfile, usePerformanceStore } from './performance-store'

installAssetUrlPolicy()

const UIOverlay = dynamic(() => import('./UIOverlay'), {
  ssr: false,
  loading: () => null,
})

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
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
    <div className="absolute left-4 top-4 z-20 pointer-events-none sm:left-6 sm:top-5">
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

export default function SceneContainer() {
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const profile = getQualityProfile({ preset, autoQuality })
  const [warmupPlan] = useState(() => prepareSceneWarmup())

  return (
    <>
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{
            position: [80, 60, 80],
            fov: 45,
            near: 0.1,
            far: 10000,
          }}
          dpr={profile.dpr}
          frameloop="always"
          performance={{ min: 0.45, max: 1, debounce: 250 }}
          gl={{
            antialias: false,
            alpha: false,
            depth: true,
            stencil: false,
            powerPreference: 'high-performance',
          }}
          onPointerMissed={() => setSelectedBody(null)}
        >
          <ScenePerformanceManager />
          <ProgressiveSceneWarmup plan={warmupPlan} />
          <AdaptiveLodManager />
          <SolarSystem />
        </Canvas>
      </div>
      <DeferredInterface />
      <PerformanceDock />
    </>
  )
}
