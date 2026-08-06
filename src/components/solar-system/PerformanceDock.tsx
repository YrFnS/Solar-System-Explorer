'use client'

import { useEffect, useState } from 'react'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  type QualityPreset,
  usePerformanceStore,
} from './performance-store'
import { KTX2_MANIFEST } from './textures/texture-manifest'
import { useTextureRuntimeStore } from './textures/texture-runtime-store'

const OPTIONS: Array<{ id: QualityPreset; label: string; note: string }> = [
  {
    id: 'auto',
    label: 'Auto',
    note: 'Starts conservatively and promotes only after a complete paced scene benchmark.',
  },
  { id: 'eco', label: 'Eco', note: 'Up to 30 FPS with a low-power GPU preference.' },
  { id: 'balanced', label: 'Balanced', note: 'Adaptive 30–45 FPS with a low-power GPU preference.' },
  { id: 'ultra', label: 'Ultra', note: 'Up to 60 FPS and high-performance GPU preference.' },
]

export default function PerformanceDock() {
  const [open, setOpen] = useState(false)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const autoBaseline = usePerformanceStore((state) => state.autoBaseline)
  const autoCeiling = usePerformanceStore((state) => state.autoCeiling)
  const autoStatus = usePerformanceStore((state) => state.autoStatus)
  const autoReason = usePerformanceStore((state) => state.autoReason)
  const fps = usePerformanceStore((state) => state.fps)
  const frameMode = usePerformanceStore((state) => state.frameMode)
  const frameTargetFps = usePerformanceStore((state) => state.frameTargetFps)
  const rendererPowerPreference = usePerformanceStore(
    (state) => state.rendererPowerPreference
  )
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const setPreset = usePerformanceStore((state) => state.setPreset)
  const setReducedMotion = usePerformanceStore((state) => state.setReducedMotion)
  const textureEnabled = useTextureRuntimeStore((state) => state.enabled)
  const textureBackend = useTextureRuntimeStore((state) => state.backend)
  const requestedTextureIds = useTextureRuntimeStore((state) => state.requestedIds)
  const loadedTextureIds = useTextureRuntimeStore((state) => state.loadedIds)
  const failedTextureIds = useTextureRuntimeStore((state) => state.failedIds)
  const textureFormats = useTextureRuntimeStore((state) => state.formats)
  const setTextureEnabled = useTextureRuntimeStore((state) => state.setEnabled)

  const effectiveQuality = getEffectiveQuality({ preset, autoQuality })
  const profile = QUALITY_PROFILES[effectiveQuality]
  const resting = frameMode === 'static' || frameMode === 'suspended'
  const targetRatio = frameTargetFps > 0 ? fps / frameTargetFps : 1
  const statusColor = frameMode === 'suspended'
    ? 'bg-violet-400'
    : frameMode === 'static'
      ? 'bg-sky-400'
      : targetRatio >= 0.86
        ? 'bg-emerald-400'
        : targetRatio >= 0.62
          ? 'bg-amber-400'
          : 'bg-rose-400'
  const liveLabel = frameMode === 'suspended'
    ? 'SLEEP'
    : frameMode === 'static'
      ? `${frameTargetFps} FPS REST`
      : `${fps}/${frameTargetFps} FPS`
  const textureTier = effectiveQuality === 'eco'
    ? '512'
    : effectiveQuality === 'balanced'
      ? '1K'
      : '2K'
  const textureBackendLabel = textureEnabled
    ? textureBackend.toUpperCase()
    : 'WEBP'
  const requestedTextureCount = requestedTextureIds.length || KTX2_MANIFEST.textures.length
  const textureStatus = textureBackend === 'ktx2'
    ? `${loadedTextureIds.length}/${requestedTextureCount} compressed textures active`
    : textureBackend === 'mixed'
      ? `${loadedTextureIds.length}/${requestedTextureCount} compressed · ${failedTextureIds.length} fallback`
      : 'Quality-tiered WebP fallback active'
  const textureFormat = textureFormats[0]?.replace(/^RGBA?_/, '').replace(/_/g, ' ')

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
    <div
      className="absolute right-3 top-14 z-40 pointer-events-auto sm:right-5 sm:top-16"
      data-texture-backend={textureBackendLabel.toLowerCase()}
      data-auto-quality-status={autoStatus}
      data-frame-pacing-mode={frameMode}
      data-frame-target-fps={frameTargetFps}
      data-renderer-power-preference={rendererPowerPreference}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-white shadow-2xl backdrop-blur-xl transition hover:border-white/20 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
        aria-expanded={open}
        aria-label="Open rendering quality controls"
      >
        <span className="relative flex h-2 w-2">
          {!resting && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${statusColor}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColor}`} />
        </span>
        <span className="text-[9px] font-semibold tracking-[0.18em] text-white/70">
          {preset === 'auto' ? `AUTO · ${profile.label.toUpperCase()}` : profile.label.toUpperCase()}
        </span>
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/45">
          {liveLabel}
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
                <h2 className="mt-1 text-sm font-semibold">Adaptive detail and cadence</h2>
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
              Resolution, textures, workload, render cadence, and GPU preference scale together without changing simulation speed.
            </p>

            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/48">
                  Frame pacing · {frameMode}
                </span>
                <span className="font-mono text-[8px] text-white/42">
                  {frameTargetFps} FPS · {rendererPowerPreference}
                </span>
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-white/38">
                Active interaction uses the profile cap; quiet simulation steps down, paused scenes rest at a few frames per second, and hidden tabs suspend completely.
              </p>
            </div>

            {preset === 'auto' ? (
              <div className="mt-3 rounded-xl border border-sky-300/12 bg-sky-300/[0.055] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-sky-200/65">
                    Auto · {autoStatus}
                  </span>
                  <span className="font-mono text-[8px] text-white/35">
                    {QUALITY_PROFILES[autoBaseline].label} → {QUALITY_PROFILES[autoCeiling].label}
                  </span>
                </div>
                <p className="mt-1.5 text-[9px] leading-relaxed text-white/42">
                  {autoReason}
                </p>
              </div>
            ) : null}
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

          <div className="space-y-3 border-t border-white/10 px-4 py-3">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-[11px] font-medium text-white/80">GPU-compressed textures</span>
                <span className="mt-0.5 block text-[9px] text-white/35">
                  {textureStatus}{textureFormat ? ` · ${textureFormat}` : ''}
                </span>
              </span>
              <input
                type="checkbox"
                checked={textureEnabled}
                onChange={(event) => setTextureEnabled(event.target.checked)}
                className="h-4 w-4 accent-amber-300"
                aria-label="Use KTX2 GPU-compressed textures"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-[11px] font-medium text-white/80">Reduced motion</span>
                <span className="mt-0.5 block text-[9px] text-white/35">Caps active cadence at 30 FPS and disables camera auto-rotation.</span>
              </span>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
                className="h-4 w-4 accent-amber-300"
              />
            </label>
          </div>

          <div className="grid grid-cols-4 gap-px border-t border-white/10 bg-white/10">
            <div className="bg-[#07090f] px-2 py-2 text-center">
              <span className="block text-[8px] uppercase tracking-wider text-white/30">Detail</span>
              <span className="mt-0.5 block font-mono text-[10px] text-white/65">
                {Math.round(profile.instanceDensity * 100)}%
              </span>
            </div>
            <div className="bg-[#07090f] px-2 py-2 text-center">
              <span className="block text-[8px] uppercase tracking-wider text-white/30">Texture</span>
              <span className="mt-0.5 block font-mono text-[10px] text-white/65">
                {textureTier}
              </span>
            </div>
            <div className="bg-[#07090f] px-2 py-2 text-center">
              <span className="block text-[8px] uppercase tracking-wider text-white/30">Power</span>
              <span className="mt-0.5 block font-mono text-[9px] text-white/65">
                {rendererPowerPreference === 'low-power' ? 'LOW' : 'HIGH'}
              </span>
            </div>
            <div className="bg-[#07090f] px-2 py-2 text-center">
              <span className="block text-[8px] uppercase tracking-wider text-white/30">Live</span>
              <span className="mt-0.5 block font-mono text-[9px] text-white/65">{liveLabel}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
