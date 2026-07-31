'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Compass, Search, Sparkles, X } from 'lucide-react'
import { activateExperienceMode } from '../experience-store'
import { useSolarSystemStore } from '../store'

const GUIDE_KEY = 'solar-explorer-interface-guide-v4'

interface FirstRunGuideProps {
  onOpenSearch: () => void
}

const STEPS = [
  {
    eyebrow: 'Navigate',
    title: 'Start with a world',
    copy: 'Use the planet strip or click any object in the scene. The inspector, camera, and live ephemeris stay synchronized.',
    icon: Compass,
  },
  {
    eyebrow: 'Discover',
    title: 'Search the whole catalogue',
    copy: 'Press Ctrl/⌘ K or “/” to find planets, moons, missions, comets, interstellar visitors, and sandbox objects.',
    icon: Search,
  },
  {
    eyebrow: 'Change perspective',
    title: 'Three experiences, one system',
    copy: 'Explore is cinematic, Scientific exposes orbital telemetry, and Sandbox unlocks experimental phenomena.',
    icon: Sparkles,
  },
]

export default function FirstRunGuide({ onOpenSearch }: FirstRunGuideProps) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const startTour = useSolarSystemStore((state) => state.startTour)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(GUIDE_KEY)) return
    } catch {
      // The guide can still be dismissed for this session.
    }
    const timer = window.setTimeout(() => setVisible(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible || screenshotMode) return null

  const current = STEPS[step]
  const Icon = current.icon

  const dismiss = () => {
    try {
      window.localStorage.setItem(GUIDE_KEY, 'complete')
    } catch {
      // Ignore unavailable local storage.
    }
    setVisible(false)
  }

  const primaryAction = () => {
    if (step < STEPS.length - 1) {
      setStep((value) => value + 1)
      return
    }
    dismiss()
    activateExperienceMode('explore')
    startTour()
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[65] flex items-center justify-center p-3 sm:items-end sm:justify-start sm:p-5">
      <button type="button" onClick={dismiss} aria-label="Dismiss explorer guide" className="absolute inset-0 bg-black/38 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none" />
      <section className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/12 bg-[#080a10]/97 text-white shadow-[0_30px_90px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-300/75 to-transparent" />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.075]">
              <Icon className="h-4 w-4 text-amber-200/75" />
            </div>
            <button type="button" onClick={dismiss} className="rounded-xl p-1.5 text-white/28 hover:bg-white/10 hover:text-white" aria-label="Close explorer guide">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 text-[8px] font-semibold uppercase tracking-[0.24em] text-amber-200/50">{current.eyebrow}</p>
          <h2 className="mt-1 text-base font-semibold text-white/92">{current.title}</h2>
          <p className="mt-2 text-[10px] leading-relaxed text-white/40">{current.copy}</p>

          {step === 1 ? (
            <button type="button" onClick={() => { dismiss(); onOpenSearch() }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] py-2.5 text-[9px] text-white/55 transition hover:bg-white/[0.09] hover:text-white">
              <Search className="h-3.5 w-3.5" /> Open catalogue search
            </button>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {STEPS.map((_, index) => (
                <span key={index} className={`h-1.5 rounded-full transition-all ${index === step ? 'w-5 bg-amber-300' : index < step ? 'w-1.5 bg-amber-300/35' : 'w-1.5 bg-white/12'}`} />
              ))}
            </div>
            <button type="button" onClick={primaryAction} className="flex items-center gap-1.5 rounded-xl bg-amber-300 px-3 py-2 text-[9px] font-semibold text-black transition hover:bg-amber-200">
              {step === STEPS.length - 1 ? 'Start tour' : 'Next'} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
