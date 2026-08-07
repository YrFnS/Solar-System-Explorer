'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Compass,
  FlaskConical,
  Gauge,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import {
  EXPERIENCE_MODES,
  activateExperienceMode,
  type ExperienceMode,
  useExperienceStore,
} from './experience-store'
import {
  DAY_MS,
  formatTimeWarp,
  getJulianDate,
  setSimulationDateMs as setClockDateMs,
} from './simulation-clock'
import { useSolarSystemStore } from './store'

interface ExperienceDockProps {
  mobileActive: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface TourStep {
  body: string
  title: string
  lesson: string
}

interface TourTrack {
  id: string
  title: string
  subtitle: string
  preferredMode: ExperienceMode
  steps: TourStep[]
}

const WARP_OPTIONS = [
  { speed: 1, label: 'Minute', note: '1 min/s' },
  { speed: 60, label: 'Hour', note: '1 hr/s' },
  { speed: 1_440, label: 'Day', note: '1 day/s' },
  { speed: 43_200, label: 'Month', note: '30 days/s' },
  { speed: 525_600, label: 'Year', note: '1 yr/s' },
]

const TOUR_TRACKS: TourTrack[] = [
  {
    id: 'inner-worlds',
    title: 'Inner Worlds',
    subtitle: 'Rock, atmosphere, water, and climate',
    preferredMode: 'scientific',
    steps: [
      {
        body: 'mercury',
        title: 'A world at the edge of heat',
        lesson: 'Compare Mercury’s eccentric orbit with its nearly absent atmosphere and extreme temperature range.',
      },
      {
        body: 'venus',
        title: 'The greenhouse warning',
        lesson: 'Venus shows how atmosphere can matter more than distance when controlling a planet’s surface climate.',
      },
      {
        body: 'earth',
        title: 'A living reference point',
        lesson: 'Use Earth as the baseline for orbital speed, axial tilt, liquid water, and the scale of its Moon.',
      },
      {
        body: 'mars',
        title: 'A cold desert with seasons',
        lesson: 'Mars has an Earth-like axial tilt, but its thin atmosphere and greater solar distance create a very different world.',
      },
    ],
  },
  {
    id: 'giant-worlds',
    title: 'Giant Worlds',
    subtitle: 'Atmospheres, rings, and orbital timescales',
    preferredMode: 'explore',
    steps: [
      {
        body: 'jupiter',
        title: 'The system’s heavyweight',
        lesson: 'Jupiter dominates planetary mass and hosts a miniature system of large, geologically active moons.',
      },
      {
        body: 'saturn',
        title: 'A disk of countless particles',
        lesson: 'Saturn’s rings look solid from afar but are made of orbiting ice and rock distributed across many bands.',
      },
      {
        body: 'uranus',
        title: 'The sideways ice giant',
        lesson: 'Uranus’s extreme axial tilt turns its seasons into one of the strangest long-term cycles in the Solar System.',
      },
      {
        body: 'neptune',
        title: 'The distant blue world',
        lesson: 'Neptune’s long year and high winds illustrate how active an atmosphere can remain far from the Sun.',
      },
    ],
  },
  {
    id: 'small-bodies',
    title: 'Small-Body Frontier',
    subtitle: 'Dwarf planets, comets, and visitors',
    preferredMode: 'scientific',
    steps: [
      {
        body: 'ceres',
        title: 'A dwarf planet in the asteroid belt',
        lesson: 'Ceres bridges the categories of asteroid and planet while preserving evidence of water-rich material.',
      },
      {
        body: 'pluto',
        title: 'A tilted, eccentric world',
        lesson: 'Pluto’s orbit is more inclined and eccentric than the major planets, and Charon makes it resemble a binary system.',
      },
      {
        body: 'halley',
        title: 'A returning time capsule',
        lesson: 'Comets spend most of their orbit far away, then accelerate and become active as they approach the Sun.',
      },
      {
        body: 'oumuamua',
        title: 'A messenger from another star',
        lesson: 'A hyperbolic path does not close around the Sun, revealing that this object arrived from interstellar space.',
      },
    ],
  },
]

const MODE_ICONS = {
  explore: Compass,
  scientific: FlaskConical,
  sandbox: Sparkles,
} satisfies Record<ExperienceMode, typeof Compass>

function toDateTimeLocal(dateMs: number) {
  const date = new Date(dateMs)
  const local = new Date(dateMs - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function ExperienceDock({
  mobileActive,
  open,
  onOpenChange,
}: ExperienceDockProps) {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)
  const [tourStep, setTourStep] = useState(0)
  const mode = useExperienceStore((state) => state.mode)
  const simulationDateMs = useExperienceStore((state) => state.simulationDateMs)
  const publishDate = useExperienceStore((state) => state.setSimulationDateMs)
  const showVelocityVectors = useExperienceStore((state) => state.showVelocityVectors)
  const showOrbitalPlanes = useExperienceStore((state) => state.showOrbitalPlanes)
  const showScienceHud = useExperienceStore((state) => state.showScienceHud)
  const showEducationLayer = useExperienceStore((state) => state.showEducationLayer)
  const setShowVelocityVectors = useExperienceStore((state) => state.setShowVelocityVectors)
  const setShowOrbitalPlanes = useExperienceStore((state) => state.setShowOrbitalPlanes)
  const setShowScienceHud = useExperienceStore((state) => state.setShowScienceHud)
  const setShowEducationLayer = useExperienceStore((state) => state.setShowEducationLayer)

  const timeSpeed = useSolarSystemStore((state) => state.timeSpeed)
  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const setTimeSpeed = useSolarSystemStore((state) => state.setTimeSpeed)
  const setCustomDate = useSolarSystemStore((state) => state.setCustomDate)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const spawnObject = useSolarSystemStore((state) => state.spawnObject)
  const spawnedObjects = useSolarSystemStore((state) => state.spawnedObjects)
  const removeSpawnedObject = useSolarSystemStore((state) => state.removeSpawnedObject)
  const lastSpeedRef = useRef(1_440)

  const activeTrack = useMemo(
    () => TOUR_TRACKS.find((track) => track.id === activeTrackId) ?? null,
    [activeTrackId]
  )
  const activeTourStep = activeTrack?.steps[tourStep] ?? null

  useEffect(() => {
    if (mode !== 'explore') activateExperienceMode(mode)
    // Apply a persisted non-default mode once without repeatedly resetting user toggles.
  }, [])

  useEffect(() => {
    if (!isPaused && timeSpeed !== 0) lastSpeedRef.current = timeSpeed
  }, [isPaused, timeSpeed])

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onOpenChange, open])

  const setDate = (dateMs: number) => {
    setClockDateMs(dateMs)
    publishDate(dateMs)
    setCustomDate(new Date(dateMs))
  }

  const togglePlayback = () => {
    if (isPaused || timeSpeed === 0) {
      setTimeSpeed(lastSpeedRef.current || 1_440)
      return
    }
    lastSpeedRef.current = timeSpeed
    setTimeSpeed(0)
  }

  const focusTourStep = (track: TourTrack, index: number) => {
    const safeIndex = Math.max(0, Math.min(track.steps.length - 1, index))
    const step = track.steps[safeIndex]
    setTourStep(safeIndex)
    setSelectedBody(step.body)
    setFocusTarget(step.body)
  }

  const startTrack = (track: TourTrack) => {
    activateExperienceMode(track.preferredMode)
    setActiveTrackId(track.id)
    focusTourStep(track, 0)
  }

  if (screenshotMode) return null

  return (
    <div
      className={`pointer-events-auto z-[55] ${
        mobileActive
          ? 'solar-mobile-safe-bottom fixed inset-x-2'
          : 'max-sm:hidden'
      } sm:absolute sm:inset-x-auto sm:bottom-5 sm:left-5`}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/75 px-3 py-2 text-white shadow-2xl backdrop-blur-xl transition hover:border-amber-300/30 hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 sm:flex"
        aria-expanded={open}
        aria-label="Open mission control"
      >
        <Orbit className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/75">
          {EXPERIENCE_MODES[mode].label}
        </span>
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[8px] text-white/45">
          {isPaused ? 'PAUSED' : formatTimeWarp(timeSpeed)}
        </span>
      </button>

      {open ? (
        <section
          className="solar-mobile-sheet flex max-h-[min(82dvh,44rem)] w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#07090f]/97 text-white shadow-2xl backdrop-blur-2xl sm:mt-2 sm:w-[min(24rem,calc(100vw-1.5rem))]"
          role="dialog"
          aria-label="Mission control"
          data-mobile-bottom-surface="mission-control"
          data-mobile-surface-active={mobileActive ? 'true' : 'false'}
        >
          <div className="flex flex-none justify-center py-2 sm:hidden" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-white/18" />
          </div>

          <header className="flex flex-none items-start justify-between gap-4 border-b border-white/10 px-4 pb-3.5 pt-1 sm:py-3.5">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">
                Mission control
              </p>
              <h2 className="mt-1 text-base font-semibold sm:text-sm">Explore with purpose</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                One ephemeris clock drives the scene, camera, orbit paths, telemetry, and sandbox.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="solar-mobile-icon-button grid h-11 w-11 flex-none place-items-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white sm:h-8 sm:w-8"
              aria-label="Close mission control"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Compass className="h-4 w-4 text-amber-300 sm:h-3.5 sm:w-3.5" />
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
                  Experience
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(EXPERIENCE_MODES) as ExperienceMode[]).map((option) => {
                  const definition = EXPERIENCE_MODES[option]
                  const Icon = MODE_ICONS[option]
                  const selected = mode === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => activateExperienceMode(option)}
                      className={`rounded-2xl border px-2 py-2.5 text-left transition ${
                        selected
                          ? 'border-amber-300/35 bg-amber-300/10'
                          : 'border-white/5 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 sm:h-3.5 sm:w-3.5 ${selected ? 'text-amber-300' : 'text-white/35'}`} />
                      <span className="mt-2 block text-[10px] font-medium text-white/85">
                        {definition.label}
                      </span>
                      <span className="mt-0.5 block text-[8px] leading-snug text-white/35">
                        {definition.eyebrow}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 rounded-xl bg-white/[0.025] px-3 py-2 text-[9px] leading-relaxed text-white/45">
                {EXPERIENCE_MODES[mode].description}
              </p>
            </section>

            <section className="mt-4 border-t border-white/8 pt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-sky-300 sm:h-3.5 sm:w-3.5" />
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
                    Ephemeris time
                  </h3>
                </div>
                <span className="font-mono text-[8px] text-white/35">
                  JD {getJulianDate(simulationDateMs).toFixed(2)}
                </span>
              </div>

              <input
                type="datetime-local"
                value={toDateTimeLocal(simulationDateMs)}
                onChange={(event) => {
                  const next = new Date(event.target.value).getTime()
                  if (Number.isFinite(next)) setDate(next)
                }}
                className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[10px] text-white/80 outline-none transition focus:border-sky-300/40"
              />

              <div className="mt-2 grid grid-cols-[auto_1fr] gap-1.5 sm:grid-cols-[auto_1fr_auto_auto]">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label={isPaused ? 'Resume simulation' : 'Pause simulation'}
                >
                  {isPaused ? <Play className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Pause className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
                </button>
                <div className="grid grid-cols-5 gap-1">
                  {WARP_OPTIONS.map((option) => (
                    <button
                      key={option.speed}
                      type="button"
                      onClick={() => setTimeSpeed(option.speed)}
                      className={`rounded-lg px-1 py-1.5 text-center transition ${
                        !isPaused && timeSpeed === option.speed
                          ? 'bg-sky-300/15 text-sky-200'
                          : 'bg-white/[0.035] text-white/42 hover:bg-white/10 hover:text-white/75'
                      }`}
                      title={option.note}
                    >
                      <span className="block text-[7px] font-semibold uppercase">{option.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setDate(simulationDateMs - DAY_MS)}
                  className="min-w-11 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-[9px] text-white/60 transition hover:bg-white/10 hover:text-white"
                  title="Step back one day"
                >
                  −1d
                </button>
                <button
                  type="button"
                  onClick={() => setDate(simulationDateMs + DAY_MS)}
                  className="min-w-11 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-[9px] text-white/60 transition hover:bg-white/10 hover:text-white"
                  title="Step forward one day"
                >
                  +1d
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDate(Date.now())}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.025] py-1.5 text-[9px] text-white/45 transition hover:bg-white/[0.07] hover:text-white/70"
              >
                <RotateCcw className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                Return to now
              </button>
            </section>

            {mode === 'scientific' ? (
              <section className="mt-4 border-t border-white/8 pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-emerald-300 sm:h-3.5 sm:w-3.5" />
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
                    Scientific layers
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    ['Velocity vectors', showVelocityVectors, setShowVelocityVectors],
                    ['Orbital planes', showOrbitalPlanes, setShowOrbitalPlanes],
                    ['Telemetry HUD', showScienceHud, setShowScienceHud],
                    ['Learning notes', showEducationLayer, setShowEducationLayer],
                  ].map(([label, checked, setter]) => (
                    <label
                      key={label as string}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-white/[0.025] px-2.5 py-2 text-[9px] text-white/60"
                    >
                      {label as string}
                      <input
                        type="checkbox"
                        checked={checked as boolean}
                        onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                        className="h-4 w-4 accent-emerald-300"
                      />
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-4 border-t border-white/8 pt-4">
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-violet-300 sm:h-3.5 sm:w-3.5" />
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
                  Guided learning
                </h3>
              </div>

              {!activeTrack ? (
                <div className="space-y-1.5">
                  {TOUR_TRACKS.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => startTrack(track)}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/[0.025] px-3 py-2.5 text-left transition hover:border-violet-300/20 hover:bg-violet-300/[0.06]"
                    >
                      <span>
                        <span className="block text-[10px] font-medium text-white/80">{track.title}</span>
                        <span className="mt-0.5 block text-[8px] text-white/38">{track.subtitle}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/30 sm:h-3.5 sm:w-3.5" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.18em] text-violet-200/60">
                        {activeTrack.title} · {tourStep + 1}/{activeTrack.steps.length}
                      </p>
                      <h4 className="mt-1 text-[11px] font-semibold text-white/90">{activeTourStep?.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTrackId(null)}
                      className="solar-mobile-icon-button grid h-11 w-11 flex-none place-items-center rounded-lg text-white/35 hover:bg-white/10 hover:text-white sm:h-8 sm:w-8"
                      aria-label="End guided track"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 text-[9px] leading-relaxed text-white/50">{activeTourStep?.lesson}</p>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={tourStep === 0}
                      onClick={() => focusTourStep(activeTrack, tourStep - 1)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-white/[0.05] py-2 text-[9px] text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Previous
                    </button>
                    <button
                      type="button"
                      disabled={tourStep >= activeTrack.steps.length - 1}
                      onClick={() => focusTourStep(activeTrack, tourStep + 1)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-violet-300/15 py-2 text-[9px] text-violet-100 transition hover:bg-violet-300/25 disabled:cursor-not-allowed disabled:opacity-25"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </section>

            {mode === 'sandbox' ? (
              <section className="mt-4 border-t border-white/8 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-rose-300 sm:h-3.5 sm:w-3.5" />
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
                      Sandbox lab
                    </h3>
                  </div>
                  <span className="font-mono text-[8px] text-white/35">{spawnedObjects.length}/10</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['asteroid', 'comet', 'interstellar'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => spawnObject(type)}
                      className="rounded-xl border border-white/5 bg-white/[0.035] px-2 py-2 text-[8px] font-medium capitalize text-white/60 transition hover:border-rose-300/20 hover:bg-rose-300/[0.07] hover:text-white"
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {spawnedObjects.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => spawnedObjects.forEach((object) => removeSpawnedObject(object.id))}
                    className="mt-2 w-full rounded-xl bg-rose-400/[0.08] py-1.5 text-[8px] text-rose-200/70 transition hover:bg-rose-400/[0.14]"
                  >
                    Clear spawned objects
                  </button>
                ) : null}
              </section>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
