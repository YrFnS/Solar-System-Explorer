'use client'

import { Search } from 'lucide-react'
import { useSolarSystemStore } from '../store'
import { PRIMARY_NAVIGATION_BODIES } from './body-catalog'

interface NavigatorBarProps {
  onOpenSearch: () => void
}

export default function NavigatorBar({ onOpenSearch }: NavigatorBarProps) {
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)

  if (screenshotMode) return null

  return (
    <nav className="pointer-events-auto absolute bottom-3 left-1/2 z-30 w-[min(44rem,calc(100vw-8.5rem))] -translate-x-1/2 sm:bottom-5 sm:w-auto" aria-label="Primary celestial navigation">
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/68 p-1.5 shadow-2xl backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              className={`group flex h-9 flex-none items-center gap-1.5 rounded-xl px-2 transition sm:h-10 sm:px-2.5 ${
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
              <span className={`${selected ? 'block' : 'hidden lg:block'} text-[8px] font-medium`}>{body.name}</span>
            </button>
          )
        })}
        <span className="mx-0.5 h-5 w-px flex-none bg-white/10" />
        <button
          type="button"
          onClick={onOpenSearch}
          title="Search all bodies"
          aria-label="Search all bodies"
          className="grid h-9 w-9 flex-none place-items-center rounded-xl text-white/35 transition hover:bg-white/[0.07] hover:text-white sm:h-10 sm:w-10"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  )
}
