'use client'

import { useMemo } from 'react'
import {
  Activity,
  Atom,
  Gauge,
  Info,
  Orbit,
  Ruler,
} from 'lucide-react'
import { getBodyInfo } from './data'
import { getBodyTelemetry } from './ephemeris'
import { useExperienceStore } from './experience-store'
import { getJulianDate } from './simulation-clock'
import { useSolarSystemStore } from './store'

function formatNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value)
}

function formatDistance(au: number | null, km: number | null) {
  if (au === null || km === null) return '—'
  if (au >= 0.01) return `${formatNumber(au, 4)} AU`
  return `${formatNumber(km, 0)} km`
}

function sourceLabel(source: ReturnType<typeof getBodyTelemetry>['source']) {
  if (source === 'jpl-approximate') return 'JPL approximate elements'
  if (source === 'two-body') return 'Two-body educational model'
  if (source === 'hyperbolic-illustration') return 'Hyperbolic illustration'
  return 'Fixed scene reference'
}

export default function ScienceHUD() {
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const mode = useExperienceStore((state) => state.mode)
  const simulationDateMs = useExperienceStore((state) => state.simulationDateMs)
  const showScienceHud = useExperienceStore((state) => state.showScienceHud)
  const showEducationLayer = useExperienceStore(
    (state) => state.showEducationLayer
  )

  const telemetry = useMemo(
    () =>
      selectedBody
        ? getBodyTelemetry(selectedBody, simulationDateMs, mode)
        : null,
    [mode, selectedBody, simulationDateMs]
  )
  const bodyInfo = useMemo(
    () => (selectedBody ? getBodyInfo(selectedBody) : null),
    [selectedBody]
  )

  if (
    screenshotMode ||
    mode !== 'scientific' ||
    !showScienceHud ||
    !selectedBody ||
    !telemetry
  ) {
    return null
  }

  const title = bodyInfo?.name ?? selectedBody.replace(/[-_]/g, ' ')
  const type = bodyInfo?.type ?? 'Scene object'
  const position = telemetry.visualPosition
  const rows = [
    {
      label: 'Distance',
      value: formatDistance(
        telemetry.distanceFromSunAu,
        telemetry.distanceFromSunKm
      ),
      icon: Ruler,
    },
    {
      label: 'Speed',
      value:
        telemetry.orbitalSpeedKms === null
          ? '—'
          : `${formatNumber(telemetry.orbitalSpeedKms, 2)} km/s`,
      icon: Gauge,
    },
    {
      label: 'Semi-major axis',
      value:
        telemetry.semiMajorAxisAu === null
          ? '—'
          : `${formatNumber(telemetry.semiMajorAxisAu, 4)} AU`,
      icon: Orbit,
    },
    {
      label: 'Eccentricity',
      value: formatNumber(telemetry.eccentricity, 5),
      icon: Activity,
    },
    {
      label: 'Inclination',
      value:
        telemetry.inclinationDeg === null
          ? '—'
          : `${formatNumber(telemetry.inclinationDeg, 3)}°`,
      icon: Atom,
    },
    {
      label: 'Period',
      value:
        telemetry.orbitalPeriodDays === null
          ? '—'
          : telemetry.orbitalPeriodDays > 730
            ? `${formatNumber(telemetry.orbitalPeriodDays / 365.25, 2)} yr`
            : `${formatNumber(telemetry.orbitalPeriodDays, 1)} days`,
      icon: Orbit,
    },
  ]

  return (
    <aside className="pointer-events-auto absolute bottom-3 right-3 z-30 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-emerald-300/15 bg-[#050a0e]/92 text-white shadow-2xl backdrop-blur-2xl sm:bottom-5 sm:right-5">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-emerald-300/65">
              Scientific telemetry
            </p>
            <h2 className="mt-1 text-sm font-semibold capitalize text-white/92">
              {title}
            </h2>
            <p className="mt-0.5 text-[9px] text-white/35">{type}</p>
          </div>
          <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.06] px-2 py-1 text-right">
            <span className="block text-[7px] uppercase tracking-wider text-emerald-200/45">
              Epoch
            </span>
            <span className="font-mono text-[8px] text-emerald-100/70">
              JD {getJulianDate(simulationDateMs).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/8">
        {rows.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#050a0e] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[7px] uppercase tracking-wider text-white/28">
              <Icon className="h-2.5 w-2.5 text-emerald-300/45" />
              {label}
            </div>
            <span className="mt-1 block font-mono text-[10px] text-white/72">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/8 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[8px] uppercase tracking-[0.18em] text-white/28">
            Visual XYZ
          </span>
          <span className="font-mono text-[8px] text-white/48">
            {position.map((value) => value.toFixed(2)).join(' · ')}
          </span>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-white/[0.025] px-3 py-2">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-sky-300/55" />
          <div>
            <p className="text-[8px] font-medium text-white/55">
              {sourceLabel(telemetry.source)}
            </p>
            <p className="mt-0.5 text-[8px] leading-relaxed text-white/30">
              {telemetry.note}
            </p>
          </div>
        </div>

        {showEducationLayer && bodyInfo?.funFacts?.[0] && (
          <div className="mt-2 rounded-xl border border-amber-300/10 bg-amber-300/[0.045] px-3 py-2">
            <p className="text-[7px] font-semibold uppercase tracking-[0.2em] text-amber-200/50">
              Observe
            </p>
            <p className="mt-1 text-[8px] leading-relaxed text-white/38">
              {bodyInfo.funFacts[0]}
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
