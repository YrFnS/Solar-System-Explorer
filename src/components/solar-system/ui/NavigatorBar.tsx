'use client'

import { Orbit, Search } from 'lucide-react'
import { useSolarSystemStore } from '../store'
import { PRIMARY_NAVIGATION_BODIES } from './body-catalog'

interface NavigatorBarProps {
  mobileActive: boolean
  onOpenMissionControl: () => void
  onOpenSearch: () => void
}

export default function NavigatorBar({
  mobileActive,
  onOpenMissionControl,
  onOpenSearch,
}: NavigatorBarProps) {
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)

  if (screenshotMode) return null

  return (
    <nav
      className={`solar-mobile-safe-bottom pointer-events-auto fixed left-1/2 z-40 w-[calc(100vw-1rem)] -translate-x-1/2 ${
        mobileActive ? '' : 'max-sm:hidden'
      } sm:absolute sm:bottom-5 sm:w-auto`}
      aria-label="Primary celestial navigation"
      data-mobile-bottom-surface="navigator"
      data-mobile-surface-active={mobileActive ? 'true' : 'false'}
    >
      <div className="flex min-h-14 items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/72 p-1.5 shadow-2xl backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:min-h-0">
        <button
          type="button"
          onClick={onOpenMissionControl}
          title="Open mission control"
          aria-label="Open mission control"
          className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-amber-300/10 bg-amber-300/[0.055] text-amber-200/70 transition hover:border-amber-300/25 hover:bg-amber-300/10 hover:text-amber-100 sm:hidden"
        >
          <Orbit className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-6 w-px flex-none bg-white/10 sm:hidden" />

        {PRIMARY_NAVIGATION_BODIES.map((body) => {
          const selected = selectedBody === body.id
          return (
            <button
              key={body.id}
              type="button"
              onClick={() => {
                setSelectedBody(body.id)
                setFocusTarget(body.id)
              }}
              title={body.name}
              aria-label={`Navigate to ${body.name}`}
              aria-current={selected ? 'true' : undefined}
              className={`group flex h-11 min-w-11 flex-none items-center justify-center gap-1.5 rounded-xl px-2.5 transition sm:h-10 sm:min-w-0 ${
                selected
                  ? 'bg-white/[0.11] text-white'
                  : 'text-white/35 hover:bg-white/[0.065] hover:text-white/75'
              }`}
            >
              <span
                className={`rounded-full border border-white/10 transition ${selected ? 'h-3 w-3' : 'h-2.5 w-2.5 group-hover:scale-125'}`}
                style={{
                  backgroundColor: body.color,
                  boxShadow: selected ? `0 0 12px ${body.color}` : `0 0 5px ${body.color}55`,
                }}
              />
              <span className={`${selected ? 'block' : 'hidden lg:block'} text-[10px] font-medium sm:text-[8px]`}>
                {body.name}
              </span>
            </button>
          )
        })}
        <span className="mx-0.5 h-6 w-px flex-none bg-white/10 sm:h-5" />
        <button
          type="button"
          onClick={onOpenSearch}
          title="Search all bodies"
          aria-label="Search all bodies"
          className="grid h-11 w-11 flex-none place-items-center rounded-xl text-white/40 transition hover:bg-white/[0.07] hover:text-white sm:h-10 sm:w-10"
        >
          <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      </div>
    </nav>
  )
}
