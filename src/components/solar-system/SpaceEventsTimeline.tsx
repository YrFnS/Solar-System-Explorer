'use client'

import { useState } from 'react'
import { useSolarSystemStore } from './store'
import { X, Calendar, Rocket, Telescope, Globe, Satellite, Award } from 'lucide-react'

interface TimelineEvent {
  year: number
  title: string
  description: string
  category: 'exploration' | 'discovery' | 'milestone' | 'spacecraft'
  relatedBody?: string
}

const SPACE_EVENTS: TimelineEvent[] = [
  { year: 1957, title: 'Sputnik 1', description: 'First artificial satellite launched by the Soviet Union, marking the beginning of the Space Age.', category: 'spacecraft' },
  { year: 1961, title: 'First Human in Space', description: 'Yuri Gagarin becomes the first human to orbit Earth aboard Vostok 1.', category: 'milestone' },
  { year: 1969, title: 'Moon Landing', description: 'Apollo 11 lands on the Moon. Neil Armstrong takes humanity\'s first steps on another world.', category: 'exploration', relatedBody: 'earth' },
  { year: 1971, title: 'First Space Station', description: 'Salyut 1, the first space station, is launched by the Soviet Union.', category: 'spacecraft' },
  { year: 1977, title: 'Voyager 1 & 2 Launch', description: 'Twin spacecraft begin their grand tour of the outer planets, now in interstellar space.', category: 'spacecraft', relatedBody: 'saturn' },
  { year: 1986, title: 'Mir Space Station', description: 'The Soviet Union launches Mir, the first modular space station, operating for 15 years.', category: 'spacecraft' },
  { year: 1990, title: 'Hubble Space Telescope', description: 'Hubble is deployed into orbit, revolutionizing our understanding of the universe.', category: 'discovery' },
  { year: 1997, title: 'Mars Pathfinder', description: 'Sojourner becomes the first rover to explore Mars, paving the way for future missions.', category: 'exploration', relatedBody: 'mars' },
  { year: 2004, title: 'Spirit & Opportunity Rovers', description: 'Twin rovers land on Mars. Opportunity operates for nearly 15 years.', category: 'exploration', relatedBody: 'mars' },
  { year: 2006, title: 'Pluto Reclassified', description: 'The IAU reclassifies Pluto as a dwarf planet, reshaping our definition of a planet.', category: 'discovery', relatedBody: 'pluto' },
  { year: 2012, title: 'Curiosity Lands on Mars', description: 'NASA\'s Curiosity rover lands in Gale Crater, discovering evidence of ancient water.', category: 'exploration', relatedBody: 'mars' },
  { year: 2015, title: 'New Horizons at Pluto', description: 'First spacecraft to fly by Pluto, revealing stunning details of the dwarf planet.', category: 'exploration', relatedBody: 'pluto' },
  { year: 2017, title: 'Cassini Grand Finale', description: 'After 13 years studying Saturn, Cassini plunges into the planet\'s atmosphere.', category: 'spacecraft', relatedBody: 'saturn' },
  { year: 2020, title: 'Perseverance & Ingenuity', description: 'Perseverance lands on Mars with Ingenuity, the first helicopter to fly on another planet.', category: 'exploration', relatedBody: 'mars' },
  { year: 2021, title: 'James Webb Space Telescope', description: 'JWST launches, the most powerful space telescope ever built, peering into the early universe.', category: 'discovery' },
  { year: 2022, title: 'DART Mission', description: 'NASA\'s DART successfully changes an asteroid\'s orbit, demonstrating planetary defense.', category: 'milestone' },
  { year: 2023, title: 'OSIRIS-REx Sample Return', description: 'First US mission to return an asteroid sample to Earth, from Bennu.', category: 'exploration' },
  { year: 2024, title: 'Artemis Program', description: 'NASA advances plans to return humans to the Moon and establish a sustainable presence.', category: 'milestone', relatedBody: 'earth' },
]

const CATEGORY_STYLES: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  exploration: { color: '#34D399', bg: 'rgba(52,211,153,0.1)', icon: <Rocket className="w-3 h-3" />, label: 'Exploration' },
  discovery: { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)', icon: <Telescope className="w-3 h-3" />, label: 'Discovery' },
  milestone: { color: '#F87171', bg: 'rgba(248,113,113,0.1)', icon: <Award className="w-3 h-3" />, label: 'Milestone' },
  spacecraft: { color: '#38BDF8', bg: 'rgba(56,189,248,0.1)', icon: <Satellite className="w-3 h-3" />, label: 'Spacecraft' },
}

export default function SpaceEventsTimeline() {
  const showTimeline = useSolarSystemStore((s) => s.showTimeline)
  const setShowTimeline = useSolarSystemStore((s) => s.setShowTimeline)
  const setFocusTarget = useSolarSystemStore((s) => s.setFocusTarget)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const [filter, setFilter] = useState<string>('all')

  if (!showTimeline) return null

  const filteredEvents = filter === 'all'
    ? SPACE_EVENTS
    : SPACE_EVENTS.filter((e) => e.category === filter)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowTimeline(false)}
      />

      {/* Timeline panel */}
      <div className="relative w-[90vw] max-w-xl max-h-[80vh] bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up-bottom">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Space Exploration Timeline</h2>
                <p className="text-[8px] text-white/30 uppercase tracking-wider">Key moments in space history</p>
              </div>
            </div>
            <button
              onClick={() => setShowTimeline(false)}
              className="text-white/40 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Category filters */}
          <div className="flex gap-1.5 mt-3">
            <button
              onClick={() => setFilter('all')}
              className={`text-[9px] px-2.5 py-1 rounded-lg transition-all border ${
                filter === 'all'
                  ? 'bg-white/15 text-white border-white/20'
                  : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              <Globe className="w-2.5 h-2.5 inline mr-1" />
              All
            </button>
            {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-[9px] px-2.5 py-1 rounded-lg transition-all border flex items-center gap-1 ${
                  filter === key
                    ? 'text-white border-white/20'
                    : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white/70'
                }`}
                style={filter === key ? { backgroundColor: style.bg, borderColor: `${style.color}30`, color: style.color } : {}}
              >
                {style.icon}
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline content */}
        <div className="overflow-y-auto max-h-[60vh] p-4 sm:p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-[1px] bg-gradient-to-b from-amber-400/30 via-white/10 to-transparent" />

            <div className="space-y-4">
              {filteredEvents.map((event, i) => {
                const catStyle = CATEGORY_STYLES[event.category]
                return (
                  <div key={i} className="relative flex gap-4 group">
                    {/* Timeline dot */}
                    <div className="relative flex-shrink-0 z-10">
                      <div
                        className="w-[37px] h-[37px] rounded-full flex items-center justify-center border transition-transform group-hover:scale-110"
                        style={{ borderColor: `${catStyle.color}40`, backgroundColor: catStyle.bg }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catStyle.color, boxShadow: `0 0 6px ${catStyle.color}60` }} />
                      </div>
                    </div>

                    {/* Event card */}
                    <div
                      className="flex-1 bg-white/5 hover:bg-white/8 border border-white/5 hover:border-white/15 rounded-xl p-3 transition-all duration-200 group-hover:shadow-lg"
                      style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02)` }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span
                            className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                            style={{ color: catStyle.color, backgroundColor: catStyle.bg }}
                          >
                            {event.year}
                          </span>
                          <h3 className="text-[11px] font-bold text-white mt-1">{event.title}</h3>
                        </div>
                        <div
                          className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-md"
                          style={{ color: catStyle.color, backgroundColor: catStyle.bg }}
                        >
                          {catStyle.icon}
                          {catStyle.label}
                        </div>
                      </div>
                      <p className="text-[10px] text-white/40 leading-relaxed">{event.description}</p>
                      {event.relatedBody && (
                        <button
                          onClick={() => {
                            setFocusTarget(event.relatedBody!)
                            setSelectedBody(event.relatedBody!)
                            setShowTimeline(false)
                          }}
                          className="mt-2 text-[9px] flex items-center gap-1 transition-colors hover:opacity-80"
                          style={{ color: catStyle.color }}
                        >
                          <Rocket className="w-2.5 h-2.5" />
                          Navigate to related body
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
