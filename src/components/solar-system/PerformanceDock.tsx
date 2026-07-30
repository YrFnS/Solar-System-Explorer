'use client'

import { useEffect, useState } from 'react'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  type QualityPreset,
  usePerformanceStore,
} from './performance-store'

const OPTIONS: Array<{ id: QualityPreset; label: string; note: string }> = [
  { id: 'auto', label: 'Auto', note: 'Adapts to this device and live frame rate.' },
  { id: 'eco', label: 'Eco', note: 'Best for phones, battery life, and cool operation.' },
  { id: 'balanced', label: 'Balanced', note: 'Smooth exploration with strong visual detail.' },
  { id: 'ultra', label: 'Ultra', note: 'Highest density and resolution for powerful GPUs.' },
]

export default function PerformanceDock() {
  const [open, setOpen] = useState(false)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const fps = usePerformanceStore((state) => state.fps)
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const setPreset = usePerformanceStore((state) => state.setPreset)
  const setReducedMotion = usePerformanceStore((state) => state.setReducedMotion)

  const effectiveQuality = getEffectiveQuality({ preset, autoQuality })
  const profile = QUALITY_PROFILES[effectiveQuality]
  const statusColor = fps >= 52 ? 'bg-emerald-400' : fps >= 36 ? 'bg-amber-400' : 'bg-rose-400'

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  if (screenshotMode) return null

  return (
    <div className="absolute right-3 top-14 sm:right-5 sm:top-16 z-40 pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-white shadow-2xl backdrop-blur-xl transition hover:border-white/20 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
        aria-expanded={open}
        aria-label="Open rendering quality controls"
      >
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${statusColor}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColor}`} />
        </span>
        <span className="text-[9px] font-semibold tracking-[0.18em] text-white/70">
          {preset === 'auto' ? `AUTO · ${profile.label.toUpperCase()}` : profile.label.toUpperCase()}
        </span>
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/45">
          {fps} FPS
        </span>
      </button>

      {open && (
        <div className="mt-2 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#07090f]/95 text-white shadow-2xl backdrop-blur-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">
                  Render engine
                </p>
                <h2 className="mt-1 text-sm font-semibold">Adaptive detail control</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label="Close rendering quality controls"
              >
                ×
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">
              Resolution and object density scale independently, so navigation stays responsive without flattening the scene.
            </p>
          </div>

          <div className="space-y-2 p-3">
            {OPTIONS.map((option) => {
              const selected = preset === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPreset(option.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? 'border-amber-300/35 bg-amber-300/10'
                      : 'border-white/5 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-white/90">{option.label}</span>
                    {selected && (
                      <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-200">
                        Active
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-white/40">{option.note}</span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-[11px] font-medium text-white/80">Reduced motion</span>
                <span className="mt-0.5 block text-[9px] text-white/35">Slows decorative fields and disables camera auto-rotation.</span>
              </span>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
                className="h-4 w-4 accent-amber-300"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
            <div className="bg-[#07090f] px-3 py-2 text-center">
              <span className="block text-[8px] uppercase tracking-wider text-white/30">Detail</span>
              <span className="mt-0.5 block font-mono text-[10px] text-white/65">
                {Math.round(profile.instanceDensity * 100)}%
              </span>
            </div>
            <div className="bg-[#07090f] px-3 py-2 text-center">
              <span className="block text-[8px] uppercase tracking-wider text-white/30">DPR cap</span>
              <span className="mt-0.5 block font-mono text-[10px] text-white/65">{profile.dpr[1]}×</span>
            </div>
            <div className="bg-[#07090f] px-3 py-2 text-center">
              <span className="block text-[8px] uppercase tracking-wider text-white/30">Live</span>
              <span className="mt-0.5 block font-mono text-[10px] text-white/65">{fps} FPS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
