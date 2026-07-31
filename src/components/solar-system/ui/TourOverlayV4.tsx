'use client'

import { ChevronLeft, ChevronRight, Footprints, X } from 'lucide-react'
import { TOUR_STEPS, useSolarSystemStore } from '../store'
import { getBodyCatalogEntry } from './body-catalog'

export default function TourOverlayV4() {
  const isTourMode = useSolarSystemStore((state) => state.isTourMode)
  const tourStep = useSolarSystemStore((state) => state.tourStep)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const stopTour = useSolarSystemStore((state) => state.stopTour)
  const nextTourStep = useSolarSystemStore((state) => state.nextTourStep)
  const prevTourStep = useSolarSystemStore((state) => state.prevTourStep)

  if (!isTourMode || screenshotMode) return null

  const step = TOUR_STEPS[tourStep]
  if (!step) return null
  const body = getBodyCatalogEntry(step.body)
  const progress = ((tourStep + 1) / TOUR_STEPS.length) * 100

  return (
    <div className="pointer-events-auto absolute bottom-28 left-1/2 z-[45] w-[min(34rem,calc(100vw-1rem))] -translate-x-1/2 sm:bottom-20">
      <section className="overflow-hidden rounded-3xl border border-white/12 bg-[#07090f]/94 text-white shadow-2xl backdrop-blur-2xl">
        <div className="h-0.5 bg-white/5">
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: `linear-gradient(90deg,#fbbf24,${body?.color ?? '#fb923c'})` }} />
        </div>
        <div className="p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 flex-none place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.075]">
              <Footprints className="h-4 w-4 text-amber-200/70" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[7px] font-semibold uppercase tracking-[0.22em] text-amber-200/50">Classic tour · {tourStep + 1}/{TOUR_STEPS.length}</p>
              <h2 className="mt-1 text-sm font-semibold text-white/90">{step.title}</h2>
              <p className="mt-1 text-[9px] leading-relaxed text-white/38">{step.description}</p>
            </div>
            <button type="button" onClick={stopTour} className="rounded-xl p-1.5 text-white/28 hover:bg-white/10 hover:text-white" aria-label="End guided tour">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prevTourStep}
              disabled={tourStep === 0}
              className="flex items-center gap-1 rounded-xl bg-white/[0.04] px-3 py-2 text-[8px] text-white/45 transition hover:bg-white/10 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronLeft className="h-3 w-3" /> Previous
            </button>
            <div className="flex items-center gap-1">
              {TOUR_STEPS.map((_, index) => (
                <span key={index} className={`h-1.5 rounded-full transition-all ${index === tourStep ? 'w-4 bg-amber-300' : index < tourStep ? 'w-1.5 bg-amber-300/35' : 'w-1.5 bg-white/12'}`} />
              ))}
            </div>
            {tourStep < TOUR_STEPS.length - 1 ? (
              <button type="button" onClick={nextTourStep} className="flex items-center gap-1 rounded-xl bg-amber-300/12 px-3 py-2 text-[8px] text-amber-100/70 transition hover:bg-amber-300/20">
                Next <ChevronRight className="h-3 w-3" />
              </button>
            ) : (
              <button type="button" onClick={stopTour} className="rounded-xl bg-emerald-300/12 px-3 py-2 text-[8px] text-emerald-100/70 transition hover:bg-emerald-300/20">Finish</button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
