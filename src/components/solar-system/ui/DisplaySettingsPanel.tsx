'use client'

import {
  Camera,
  Eye,
  Focus,
  Orbit,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { useSolarSystemStore } from '../store'

interface DisplaySettingsPanelProps {
  open: boolean
  onClose: () => void
}

function ToggleRow({
  label,
  note,
  checked,
  onChange,
}: {
  label: string
  note?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.025] px-3 py-2.5 transition hover:border-white/10 hover:bg-white/[0.045]">
      <span className="min-w-0">
        <span className="block text-[10px] font-medium text-white/75">{label}</span>
        {note ? <span className="mt-0.5 block text-[8px] leading-relaxed text-white/28">{note}</span> : null}
      </span>
      <span className={`relative h-5 w-9 flex-none rounded-full border transition ${checked ? 'border-amber-300/35 bg-amber-300/25' : 'border-white/10 bg-white/5'}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition ${checked ? 'left-[18px] bg-amber-200' : 'left-0.5 bg-white/35'}`} />
      </span>
    </label>
  )
}

export default function DisplaySettingsPanel({ open, onClose }: DisplaySettingsPanelProps) {
  const showLabels = useSolarSystemStore((state) => state.showLabels)
  const showOrbitLines = useSolarSystemStore((state) => state.showOrbitLines)
  const showTrails = useSolarSystemStore((state) => state.showTrails)
  const showAsteroidBelt = useSolarSystemStore((state) => state.showAsteroidBelt)
  const showKuiperBelt = useSolarSystemStore((state) => state.showKuiperBelt)
  const showNebula = useSolarSystemStore((state) => state.showNebula)
  const showHeliosphere = useSolarSystemStore((state) => state.showHeliosphere)
  const showTrojans = useSolarSystemStore((state) => state.showTrojans)
  const showCentaurs = useSolarSystemStore((state) => state.showCentaurs)
  const showScatteredDisc = useSolarSystemStore((state) => state.showScatteredDisc)
  const showPhenomena = useSolarSystemStore((state) => state.showPhenomena)
  const showSolarWind = useSolarSystemStore((state) => state.showSolarWind)
  const showZodiacalLight = useSolarSystemStore((state) => state.showZodiacalLight)
  const autoRotate = useSolarSystemStore((state) => state.autoRotate)
  const followMode = useSolarSystemStore((state) => state.followMode)
  const cameraMode = useSolarSystemStore((state) => state.cameraMode)

  const setShowLabels = useSolarSystemStore((state) => state.setShowLabels)
  const setShowOrbitLines = useSolarSystemStore((state) => state.setShowOrbitLines)
  const setShowTrails = useSolarSystemStore((state) => state.setShowTrails)
  const setShowAsteroidBelt = useSolarSystemStore((state) => state.setShowAsteroidBelt)
  const setShowKuiperBelt = useSolarSystemStore((state) => state.setShowKuiperBelt)
  const setShowNebula = useSolarSystemStore((state) => state.setShowNebula)
  const setShowHeliosphere = useSolarSystemStore((state) => state.setShowHeliosphere)
  const setShowTrojans = useSolarSystemStore((state) => state.setShowTrojans)
  const setShowCentaurs = useSolarSystemStore((state) => state.setShowCentaurs)
  const setShowScatteredDisc = useSolarSystemStore((state) => state.setShowScatteredDisc)
  const setShowPhenomena = useSolarSystemStore((state) => state.setShowPhenomena)
  const setShowSolarWind = useSolarSystemStore((state) => state.setShowSolarWind)
  const setShowZodiacalLight = useSolarSystemStore((state) => state.setShowZodiacalLight)
  const setAutoRotate = useSolarSystemStore((state) => state.setAutoRotate)
  const setFollowMode = useSolarSystemStore((state) => state.setFollowMode)
  const setCameraMode = useSolarSystemStore((state) => state.setCameraMode)
  const setCameraPosition = useSolarSystemStore((state) => state.setCameraPosition)
  const resetCamera = useSolarSystemStore((state) => state.resetCamera)

  if (!open) return null

  return (
    <div className="pointer-events-auto fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:justify-end sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close display settings"
      />
      <aside className="relative flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#080a10]/97 shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:w-[23rem] sm:rounded-3xl">
        <div className="flex items-start justify-between border-b border-white/10 px-4 py-3.5">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-300/75">View system</p>
            <h2 className="mt-1 text-sm font-semibold text-white/90">Display and camera</h2>
            <p className="mt-1 text-[9px] leading-relaxed text-white/32">Choose what the scene reveals without changing the orbital model.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-white/35 hover:bg-white/10 hover:text-white" aria-label="Close display settings">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-3">
          <section>
            <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
              <Camera className="h-3.5 w-3.5 text-sky-300/70" /> Camera
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" onClick={() => setCameraPosition([0, 80, 0])} className="rounded-xl border border-white/6 bg-white/[0.035] py-2 text-[9px] text-white/55 transition hover:bg-white/10 hover:text-white">
                Top
              </button>
              <button type="button" onClick={() => setCameraPosition([80, 5, 0])} className="rounded-xl border border-white/6 bg-white/[0.035] py-2 text-[9px] text-white/55 transition hover:bg-white/10 hover:text-white">
                Side
              </button>
              <button type="button" onClick={resetCamera} className="flex items-center justify-center gap-1 rounded-xl border border-white/6 bg-white/[0.035] py-2 text-[9px] text-white/55 transition hover:bg-white/10 hover:text-white">
                <RefreshCw className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(['orbit', 'fly'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCameraMode(mode)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[9px] capitalize transition ${cameraMode === mode ? 'border-sky-300/25 bg-sky-300/10 text-sky-100' : 'border-white/6 bg-white/[0.025] text-white/40 hover:bg-white/[0.07] hover:text-white/70'}`}
                >
                  {mode === 'orbit' ? <Orbit className="h-3 w-3" /> : <Focus className="h-3 w-3" />}
                  {mode} camera
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4 border-t border-white/8 pt-4">
            <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
              <Eye className="h-3.5 w-3.5 text-emerald-300/70" /> Navigation aids
            </div>
            <div className="space-y-1.5">
              <ToggleRow label="Body labels" checked={showLabels} onChange={setShowLabels} />
              <ToggleRow label="Orbit paths" checked={showOrbitLines} onChange={setShowOrbitLines} />
              <ToggleRow label="Motion trails" note="Shows recent orbital motion for major bodies." checked={showTrails} onChange={setShowTrails} />
              <ToggleRow label="Auto-rotate camera" checked={autoRotate} onChange={setAutoRotate} />
              <ToggleRow label="Follow selected body" checked={followMode} onChange={setFollowMode} />
            </div>
          </section>

          <section className="mt-4 border-t border-white/8 pt-4">
            <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
              <Orbit className="h-3.5 w-3.5 text-violet-300/70" /> System layers
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <ToggleRow label="Asteroid belt" checked={showAsteroidBelt} onChange={setShowAsteroidBelt} />
              <ToggleRow label="Kuiper belt" checked={showKuiperBelt} onChange={setShowKuiperBelt} />
              <ToggleRow label="Nebula backdrop" checked={showNebula} onChange={setShowNebula} />
              <ToggleRow label="Heliosphere" checked={showHeliosphere} onChange={setShowHeliosphere} />
              <ToggleRow label="Jupiter Trojans" checked={showTrojans} onChange={setShowTrojans} />
              <ToggleRow label="Centaur field" checked={showCentaurs} onChange={setShowCentaurs} />
              <ToggleRow label="Scattered disc" checked={showScatteredDisc} onChange={setShowScatteredDisc} />
            </div>
          </section>

          <section className="mt-4 border-t border-white/8 pt-4">
            <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
              <Sparkles className="h-3.5 w-3.5 text-rose-300/70" /> Phenomena
            </div>
            <div className="space-y-1.5">
              <ToggleRow label="Active phenomena" note="Master switch for decorative dynamic effects." checked={showPhenomena} onChange={setShowPhenomena} />
              <ToggleRow label="Solar wind" checked={showSolarWind} onChange={setShowSolarWind} />
              <ToggleRow label="Zodiacal light" checked={showZodiacalLight} onChange={setShowZodiacalLight} />
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
