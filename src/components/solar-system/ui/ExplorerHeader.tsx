'use client'

import { useMemo } from 'react'
import {
  Bookmark,
  Camera,
  Clock3,
  History,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { EXPERIENCE_MODES, useExperienceStore } from '../experience-store'
import { formatTimeWarp } from '../simulation-clock'
import { useSolarSystemStore } from '../store'
import { getBodyCatalogEntry } from './body-catalog'

interface ExplorerHeaderProps {
  onOpenSearch: () => void
  onOpenBookmarks: () => void
  onOpenSettings: () => void
}

function HeaderAction({
  label,
  onClick,
  children,
  badge,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/65 text-white/45 shadow-xl backdrop-blur-xl transition hover:border-white/20 hover:bg-black/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-amber-300 px-1 text-[7px] font-bold text-black">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  )
}

export default function ExplorerHeader({
  onOpenSearch,
  onOpenBookmarks,
  onOpenSettings,
}: ExplorerHeaderProps) {
  const mode = useExperienceStore((state) => state.mode)
  const simulationDateMs = useExperienceStore((state) => state.simulationDateMs)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const timeSpeed = useSolarSystemStore((state) => state.timeSpeed)
  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const screenshots = useSolarSystemStore((state) => state.screenshotGallery.length)
  const setShowTimeline = useSolarSystemStore((state) => state.setShowTimeline)
  const setScreenshotMode = useSolarSystemStore((state) => state.setScreenshotMode)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)

  const body = getBodyCatalogEntry(selectedBody)
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(simulationDateMs)), [simulationDateMs])

  if (screenshotMode) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-black/60 px-3 py-2 shadow-2xl backdrop-blur-xl sm:px-3.5">
          <div className="relative grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full bg-gradient-to-br from-amber-200 via-orange-400 to-rose-600 shadow-lg shadow-orange-500/20">
            <span className="absolute inset-1 rounded-full border border-white/25" />
            <Sparkles className="relative h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85 sm:text-[11px]">
              Solar System Explorer
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[8px] text-white/35">
              <span>{EXPERIENCE_MODES[mode].label}</span>
              <span className="text-white/15">•</span>
              <span className="truncate">{body?.name ?? 'System overview'}</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto absolute left-1/2 top-4 hidden -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/8 bg-black/50 px-3 py-2 shadow-xl backdrop-blur-xl md:flex">
          <Clock3 className="h-3 w-3 text-sky-300/75" />
          <span className="font-mono text-[9px] text-white/55">{dateLabel}</span>
          <span className="h-3 w-px bg-white/10" />
          <span className={`text-[8px] font-semibold uppercase tracking-[0.14em] ${isPaused ? 'text-rose-300' : 'text-emerald-300'}`}>
            {isPaused ? 'Paused' : formatTimeWarp(timeSpeed)}
          </span>
        </div>

        <div className="pointer-events-auto flex flex-none items-center gap-1.5">
          <HeaderAction label="Search celestial bodies" onClick={onOpenSearch}>
            <Search className="h-3.5 w-3.5" />
          </HeaderAction>
          <div className="hidden items-center gap-1.5 sm:flex">
            <HeaderAction label="Bookmarks" onClick={onOpenBookmarks}>
              <Bookmark className="h-3.5 w-3.5" />
            </HeaderAction>
            <HeaderAction label="Space history" onClick={() => setShowTimeline(true)}>
              <History className="h-3.5 w-3.5" />
            </HeaderAction>
            <HeaderAction label="Display settings" onClick={onOpenSettings}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </HeaderAction>
          </div>
          <HeaderAction
            label="Enter screenshot mode"
            onClick={() => setScreenshotMode(true)}
            badge={screenshots}
          >
            <Camera className="h-3.5 w-3.5" />
          </HeaderAction>
        </div>
      </div>
    </div>
  )
}
