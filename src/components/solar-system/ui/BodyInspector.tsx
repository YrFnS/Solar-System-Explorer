'use client'

import { useMemo } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  Focus,
  GitCompareArrows,
  Milestone,
  Orbit,
  Ruler,
  X,
} from 'lucide-react'
import { getBodyInfo } from '../data'
import { getBodyTelemetry } from '../ephemeris'
import { useExperienceStore } from '../experience-store'
import { useSolarSystemStore } from '../store'
import { getBodyCatalogEntry } from './body-catalog'

function formatDistance(au: number | null, km: number | null) {
  if (au !== null && Number.isFinite(au) && au >= 0.01) {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(au)} AU`
  }
  if (km !== null && Number.isFinite(km)) {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(km)} km`
  }
  return null
}

function InspectorAction({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[8px] font-medium transition ${
        active
          ? 'border-amber-300/30 bg-amber-300/12 text-amber-100'
          : 'border-white/7 bg-white/[0.035] text-white/45 hover:border-white/15 hover:bg-white/[0.08] hover:text-white/80'
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export default function BodyInspector() {
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const spawnedObjects = useSolarSystemStore((state) => state.spawnedObjects)
  const bookmarks = useSolarSystemStore((state) => state.bookmarks)
  const rulerTarget = useSolarSystemStore((state) => state.rulerTarget)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)
  const setRulerTarget = useSolarSystemStore((state) => state.setRulerTarget)
  const addBookmark = useSolarSystemStore((state) => state.addBookmark)
  const removeBookmark = useSolarSystemStore((state) => state.removeBookmark)
  const setComparisonMode = useSolarSystemStore((state) => state.setComparisonMode)
  const setComparisonBody = useSolarSystemStore((state) => state.setComparisonBody)
  const setComparisonBody2 = useSolarSystemStore((state) => state.setComparisonBody2)
  const mode = useExperienceStore((state) => state.mode)
  const simulationDateMs = useExperienceStore((state) => state.simulationDateMs)

  const catalogueBody = getBodyCatalogEntry(selectedBody)
  const spawnedBody = spawnedObjects.find((body) => body.id === selectedBody)
  const info = useMemo(() => (selectedBody ? getBodyInfo(selectedBody) : null), [selectedBody])
  const telemetry = useMemo(() => {
    if (!selectedBody) return null
    try {
      return getBodyTelemetry(selectedBody, simulationDateMs, mode)
    } catch {
      return null
    }
  }, [mode, selectedBody, simulationDateMs])

  if (!selectedBody || screenshotMode) return null

  const title = info?.name ?? spawnedBody?.name ?? catalogueBody?.name ?? selectedBody.replace(/[-_]/g, ' ')
  const type = info?.type ?? (spawnedBody ? `Spawned ${spawnedBody.type}` : catalogueBody?.type ?? 'Scene object')
  const accent = spawnedBody?.color ?? catalogueBody?.color ?? '#fbbf24'
  const existingBookmark = bookmarks.find((bookmark) => bookmark.bodyId === selectedBody)
  const liveDistance = telemetry ? formatDistance(telemetry.distanceFromSunAu, telemetry.distanceFromSunKm) : null
  const liveSpeed = telemetry?.orbitalSpeedKms !== null && telemetry?.orbitalSpeedKms !== undefined
    ? `${telemetry.orbitalSpeedKms.toFixed(2)} km/s`
    : null

  const fallbackDetails: Record<string, string | number> = spawnedBody
    ? {
        'Object class': spawnedBody.type,
        'Visual radius': spawnedBody.radius.toFixed(3),
        'Orbit radius': spawnedBody.orbitRadius.toFixed(2),
        'Eccentricity': spawnedBody.orbitEccentricity.toFixed(3),
        'Inclination': `${spawnedBody.orbitInclination.toFixed(1)}°`,
      }
    : {}
  const details = Object.entries(info?.details ?? fallbackDetails).slice(0, 8)

  const toggleBookmark = () => {
    if (existingBookmark) {
      removeBookmark(existingBookmark.id)
      return
    }
    addBookmark(title, selectedBody)
  }

  const beginComparison = () => {
    setComparisonBody(selectedBody)
    setComparisonBody2(null)
    setComparisonMode(true)
  }

  const toggleRuler = () => {
    if (rulerTarget) {
      setRulerTarget(null)
      return
    }
    setRulerTarget(selectedBody)
  }

  return (
    <aside className="pointer-events-auto fixed inset-x-2 bottom-2 z-40 max-h-[68vh] overflow-hidden rounded-3xl border border-white/10 bg-[#07090f]/96 text-white shadow-2xl backdrop-blur-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:max-h-[calc(100vh-7rem)] sm:w-[21rem]">
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="relative overflow-hidden border-b border-white/8 px-4 py-3.5">
        <div className="absolute inset-0 opacity-[0.08]" style={{ background: `radial-gradient(circle at 15% 20%, ${accent}, transparent 58%)` }} />
        <div className="relative flex items-start gap-3">
          <div
            className="mt-0.5 h-11 w-11 flex-none rounded-full border border-white/15 shadow-lg"
            style={{
              background: `radial-gradient(circle at 32% 28%, #fff8, ${accent} 34%, ${accent}55 68%, #02030a 100%)`,
              boxShadow: `0 0 24px ${accent}35`,
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/30">Selected object</p>
            <h2 className="mt-1 truncate text-base font-semibold text-white/92">{title}</h2>
            <p className="mt-0.5 truncate text-[9px] text-white/38">{type}</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBody(null)}
            className="rounded-xl p-1.5 text-white/32 transition hover:bg-white/10 hover:text-white"
            aria-label="Close body inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {(liveDistance || liveSpeed) && (
          <div className="relative mt-3 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl border border-white/6 bg-black/20 px-2.5 py-2">
              <span className="flex items-center gap-1 text-[7px] uppercase tracking-wider text-white/25"><Ruler className="h-2.5 w-2.5" /> Sun distance</span>
              <span className="mt-1 block font-mono text-[9px] text-white/62">{liveDistance ?? '—'}</span>
            </div>
            <div className="rounded-xl border border-white/6 bg-black/20 px-2.5 py-2">
              <span className="flex items-center gap-1 text-[7px] uppercase tracking-wider text-white/25"><Orbit className="h-2.5 w-2.5" /> Orbital speed</span>
              <span className="mt-1 block font-mono text-[9px] text-white/62">{liveSpeed ?? '—'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="max-h-[44vh] overflow-y-auto overscroll-contain px-4 py-3 sm:max-h-[calc(100vh-22rem)]">
        {info?.physicsNote ? (
          <div className="mb-3 rounded-xl border border-amber-300/12 bg-amber-300/[0.055] px-3 py-2 text-[8px] leading-relaxed text-amber-100/55">
            {info.physicsNote}
          </div>
        ) : null}

        <div className="space-y-1">
          {details.map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-4 border-b border-white/5 py-1.5 last:border-0">
              <span className="text-[9px] text-white/30">{key}</span>
              <span className="max-w-[58%] text-right text-[9px] leading-relaxed text-white/65">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </span>
            </div>
          ))}
        </div>

        {info?.funFacts?.[0] ? (
          <div className="mt-3 rounded-2xl border border-white/6 bg-white/[0.025] px-3 py-2.5">
            <p className="text-[7px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>Observe</p>
            <p className="mt-1.5 text-[9px] leading-relaxed text-white/40">{info.funFacts[0]}</p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-1.5 border-t border-white/8 p-3">
        <InspectorAction label="Focus" onClick={() => setFocusTarget(selectedBody)}>
          <Focus className="h-3 w-3" />
        </InspectorAction>
        <InspectorAction label="Save" active={Boolean(existingBookmark)} onClick={toggleBookmark}>
          {existingBookmark ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
        </InspectorAction>
        <InspectorAction label="Measure" active={Boolean(rulerTarget)} onClick={toggleRuler}>
          <Milestone className="h-3 w-3" />
        </InspectorAction>
        <InspectorAction label="Compare" onClick={beginComparison}>
          <GitCompareArrows className="h-3 w-3" />
        </InspectorAction>
      </div>

      {rulerTarget === selectedBody ? (
        <div className="border-t border-amber-300/10 bg-amber-300/[0.04] px-4 py-2 text-center text-[8px] text-amber-100/45">
          Measurement origin set. Select another body to draw the live ephemeris distance.
        </div>
      ) : null}
    </aside>
  )
}
