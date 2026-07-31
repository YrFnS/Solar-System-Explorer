'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Search,
  X,
} from 'lucide-react'
import { useSolarSystemStore } from '../store'
import {
  BODY_CATALOG,
  type BodyCatalogEntry,
  searchBodyCatalog,
} from './body-catalog'

interface SearchPaletteProps {
  onClose: () => void
}

const CATEGORY_LABELS: Record<BodyCatalogEntry['category'], string> = {
  star: 'Star',
  planet: 'Planet',
  moon: 'Moon',
  dwarf: 'Dwarf world',
  comet: 'Comet',
  interstellar: 'Interstellar',
  centaur: 'Centaur',
  'scattered-disc': 'Outer system',
  artifact: 'Mission',
  exotic: 'Sandbox',
}

export default function SearchPalette({ onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const spawnedObjects = useSolarSystemStore((state) => state.spawnedObjects)
  const comparisonMode = useSolarSystemStore((state) => state.comparisonMode)
  const comparisonBody = useSolarSystemStore((state) => state.comparisonBody)
  const comparisonBody2 = useSolarSystemStore((state) => state.comparisonBody2)
  const setComparisonBody2 = useSolarSystemStore((state) => state.setComparisonBody2)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)

  const results = useMemo(() => {
    const staticResults = searchBodyCatalog(query, 18)
    if (spawnedObjects.length === 0) return staticResults

    const normalized = query.trim().toLowerCase()
    const spawnedResults: BodyCatalogEntry[] = spawnedObjects
      .filter((object) => (
        !normalized
        || object.name.toLowerCase().includes(normalized)
        || object.type.includes(normalized)
      ))
      .map((object) => ({
        id: object.id,
        name: object.name,
        type: `Spawned ${object.type}`,
        category: object.type === 'interstellar'
          ? 'interstellar'
          : object.type === 'comet'
            ? 'comet'
            : 'dwarf',
        color: object.color,
        searchText: `${object.name} ${object.type} spawned`.toLowerCase(),
      }))

    const unique = new Map<string, BodyCatalogEntry>()
    for (const body of [...spawnedResults, ...staticResults, ...BODY_CATALOG]) {
      if (!unique.has(body.id)) unique.set(body.id, body)
      if (unique.size >= 18) break
    }
    return [...unique.values()]
  }, [query, spawnedObjects])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, results.length - 1))

  const choose = (body: BodyCatalogEntry) => {
    if (
      comparisonMode
      && comparisonBody
      && !comparisonBody2
      && body.id !== comparisonBody
    ) {
      setComparisonBody2(body.id)
      setSelectedBody(body.id)
      onClose()
      return
    }

    setSelectedBody(body.id)
    setFocusTarget(body.id)
    onClose()
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[11vh] sm:pt-[14vh]">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search celestial bodies"
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/12 bg-[#080a10]/97 shadow-[0_35px_100px_rgba(0,0,0,0.75)]"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
          <Search className="h-4 w-4 flex-none text-amber-300/80" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((index) => Math.min(results.length - 1, index + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(0, index - 1))
              } else if (event.key === 'Enter' && results[safeActiveIndex]) {
                event.preventDefault()
                choose(results[safeActiveIndex])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
            placeholder={comparisonMode && comparisonBody && !comparisonBody2
              ? 'Choose a body to compare…'
              : 'Search planets, moons, missions, comets…'}
            className="min-w-0 flex-1 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/35 transition hover:bg-white/10 hover:text-white"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {comparisonMode && comparisonBody && !comparisonBody2 ? (
          <div className="border-b border-amber-300/10 bg-amber-300/[0.055] px-4 py-2 text-[9px] text-amber-100/60">
            Comparison mode is active. Selecting a result will fill the second comparison slot.
          </div>
        ) : null}

        <div className="max-h-[54vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Search className="mx-auto h-6 w-6 text-white/15" />
              <p className="mt-3 text-[11px] text-white/35">No matching body or mission</p>
            </div>
          ) : (
            results.map((body, index) => {
              const active = index === safeActiveIndex
              return (
                <button
                  key={body.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(body)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                    active
                      ? 'bg-white/[0.09] text-white'
                      : 'text-white/62 hover:bg-white/[0.055] hover:text-white/90'
                  }`}
                >
                  <span
                    className="h-3 w-3 flex-none rounded-full border border-white/15 shadow-[0_0_10px_currentColor]"
                    style={{ backgroundColor: body.color, color: body.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium">{body.name}</span>
                    <span className="mt-0.5 block truncate text-[8px] uppercase tracking-[0.12em] text-white/28">
                      {CATEGORY_LABELS[body.category]} · {body.type}
                    </span>
                  </span>
                  {active ? (
                    <CornerDownLeft className="h-3.5 w-3.5 flex-none text-amber-300/70" />
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/8 px-4 py-2 text-[8px] text-white/25">
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-2.5 w-2.5" />
              <ArrowDown className="h-2.5 w-2.5" /> navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-2.5 w-2.5" /> select
            </span>
          </span>
          <span>Ctrl/⌘ K</span>
        </div>
      </div>
    </div>
  )
}
