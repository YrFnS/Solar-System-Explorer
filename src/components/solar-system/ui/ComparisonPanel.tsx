'use client'

import { ArrowLeftRight, Focus, Search, X } from 'lucide-react'
import { getBodyInfo } from '../data'
import { useSolarSystemStore } from '../store'
import {
  BODY_CATALOG,
  getBodyCatalogEntry,
  PRIMARY_NAVIGATION_BODIES,
} from './body-catalog'

interface ComparisonPanelProps {
  onOpenSearch: () => void
}

function valueLabel(value: string | number | undefined) {
  if (value === undefined) return '—'
  return typeof value === 'number' ? value.toLocaleString() : value
}

export default function ComparisonPanel({ onOpenSearch }: ComparisonPanelProps) {
  const comparisonMode = useSolarSystemStore((state) => state.comparisonMode)
  const firstId = useSolarSystemStore((state) => state.comparisonBody)
  const secondId = useSolarSystemStore((state) => state.comparisonBody2)
  const setComparisonMode = useSolarSystemStore((state) => state.setComparisonMode)
  const setComparisonBody = useSolarSystemStore((state) => state.setComparisonBody)
  const setComparisonBody2 = useSolarSystemStore((state) => state.setComparisonBody2)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)

  if (!comparisonMode || !firstId) return null

  const first = getBodyCatalogEntry(firstId)
  const second = getBodyCatalogEntry(secondId)
  const firstInfo = getBodyInfo(firstId)
  const secondInfo = secondId ? getBodyInfo(secondId) : null

  const close = () => {
    setComparisonMode(false)
    setComparisonBody(null)
    setComparisonBody2(null)
  }

  const focus = (id: string) => {
    setSelectedBody(id)
    setFocusTarget(id)
    close()
  }

  const commonKeys = firstInfo && secondInfo
    ? Object.keys(firstInfo.details).filter((key) => key in secondInfo.details).slice(0, 7)
    : []
  const fallbackKeys = firstInfo && secondInfo
    ? [...new Set([...Object.keys(firstInfo.details), ...Object.keys(secondInfo.details)])].slice(0, 7)
    : []
  const rows = commonKeys.length >= 3 ? commonKeys : fallbackKeys

  const diameterRatio = first?.diameterKm && second?.diameterKm
    ? first.diameterKm / second.diameterKm
    : null

  return (
    <div className="pointer-events-auto fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-6">
      <button type="button" onClick={close} aria-label="Close comparison" className="absolute inset-0 bg-black/68 backdrop-blur-md" />
      <section className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/12 bg-[#07090f]/98 text-white shadow-[0_35px_120px_rgba(0,0,0,0.8)]">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-emerald-300/65">Comparison lab</p>
            <h2 className="mt-1 text-sm font-semibold">Read two worlds side by side</h2>
            <p className="mt-1 text-[9px] text-white/32">Physical facts remain independent from the compressed visual scale.</p>
          </div>
          <button type="button" onClick={close} className="rounded-xl p-1.5 text-white/35 hover:bg-white/10 hover:text-white" aria-label="Close comparison">
            <X className="h-4 w-4" />
          </button>
        </header>

        {!secondId ? (
          <div className="overflow-y-auto p-4 sm:p-5">
            <div className="rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.045] px-4 py-3">
              <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-200/50">First selection</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: first?.color ?? '#fbbf24' }} />
                <div>
                  <p className="text-sm font-semibold text-white/90">{firstInfo?.name ?? first?.name ?? firstId}</p>
                  <p className="text-[9px] text-white/35">{firstInfo?.type ?? first?.type}</p>
                </div>
              </div>
            </div>

            <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">Choose the second body</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {PRIMARY_NAVIGATION_BODIES.filter((body) => body.id !== firstId).map((body) => (
                <button
                  key={body.id}
                  type="button"
                  onClick={() => setComparisonBody2(body.id)}
                  className="flex items-center gap-2 rounded-2xl border border-white/6 bg-white/[0.025] px-2.5 py-2.5 text-left transition hover:border-emerald-300/20 hover:bg-emerald-300/[0.055]"
                >
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: body.color }} />
                  <span className="truncate text-[9px] text-white/60">{body.name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenSearch}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.035] py-2.5 text-[9px] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
            >
              <Search className="h-3.5 w-3.5" /> Search all {BODY_CATALOG.length} catalogue entries
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              {[{ body: first, info: firstInfo, id: firstId }, { body: second, info: secondInfo, id: secondId }].map(({ body, info, id }, index) => (
                <div key={id} className={`rounded-2xl border border-white/7 bg-white/[0.028] p-3 ${index === 1 ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-2.5 ${index === 1 ? 'flex-row-reverse' : ''}`}>
                    <span className="h-7 w-7 flex-none rounded-full border border-white/15" style={{ background: `radial-gradient(circle at 30% 25%, #fff8, ${body?.color ?? '#94a3b8'} 40%, #02030a)` }} />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white/90">{info?.name ?? body?.name ?? id}</h3>
                      <p className="truncate text-[8px] uppercase tracking-wider text-white/30">{info?.type ?? body?.type}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => focus(id)} className={`mt-3 inline-flex items-center gap-1 rounded-xl bg-white/[0.045] px-2 py-1.5 text-[8px] text-white/45 hover:bg-white/10 hover:text-white ${index === 1 ? 'ml-auto' : ''}`}>
                    <Focus className="h-3 w-3" /> Focus
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setComparisonBody(secondId)
                  setComparisonBody2(firstId)
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/35 transition hover:bg-white/10 hover:text-white"
                title="Swap bodies"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {diameterRatio ? (
              <div className="mt-3 rounded-2xl border border-amber-300/10 bg-amber-300/[0.04] px-4 py-2.5 text-center text-[9px] text-white/48">
                {diameterRatio >= 1
                  ? `${first?.name} is ${diameterRatio.toFixed(diameterRatio >= 10 ? 0 : 2)}× wider than ${second?.name}.`
                  : `${second?.name} is ${(1 / diameterRatio).toFixed((1 / diameterRatio) >= 10 ? 0 : 2)}× wider than ${first?.name}.`}
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/7">
              <div className="grid grid-cols-[1fr_0.8fr_1fr] bg-white/[0.04] px-3 py-2 text-[7px] font-semibold uppercase tracking-[0.16em] text-white/25">
                <span>{firstInfo?.name ?? first?.name}</span>
                <span className="text-center">Metric</span>
                <span className="text-right">{secondInfo?.name ?? second?.name}</span>
              </div>
              {rows.map((key) => (
                <div key={key} className="grid grid-cols-[1fr_0.8fr_1fr] items-center gap-2 border-t border-white/5 px-3 py-2.5 text-[9px]">
                  <span className="break-words text-white/62">{valueLabel(firstInfo?.details[key])}</span>
                  <span className="text-center text-[8px] text-white/28">{key}</span>
                  <span className="break-words text-right text-white/62">{valueLabel(secondInfo?.details[key])}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setComparisonBody2(null)} className="rounded-xl bg-white/[0.04] py-2 text-[8px] text-white/42 hover:bg-white/10 hover:text-white/70">Choose another</button>
              <button type="button" onClick={close} className="rounded-xl bg-emerald-300/12 py-2 text-[8px] text-emerald-100/70 hover:bg-emerald-300/20">Done</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
