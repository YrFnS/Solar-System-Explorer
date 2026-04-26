'use client'

import { create } from 'zustand'
import { planets, dwarfPlanets, comets, interstellarObjects, centaurs, scatteredDiscObjects, blackHoles, wormholes } from './data'

export interface CelestialEvent {
  id: string
  title: string
  description: string
  type: 'conjunction' | 'eclipse' | 'meteor' | 'discovery' | 'anniversary'
  icon: string
  relatedBody: string | null
}

export const CELESTIAL_EVENTS: CelestialEvent[] = [
  { id: 'e1', title: '🌍 Transit of Mercury', description: 'Mercury passes between Earth and the Sun, creating a rare transit visible with solar telescopes.', type: 'eclipse', icon: '🌑', relatedBody: 'mercury' },
  { id: 'e2', title: '☄️ Perseid Meteor Shower', description: 'The annual Perseid meteor shower peaks with up to 100 meteors per hour from Comet Swift-Tuttle debris.', type: 'meteor', icon: '☄️', relatedBody: null },
  { id: 'e3', title: '🪐 Great Conjunction', description: 'Jupiter and Saturn appear closer together in the sky than they have in centuries!', type: 'conjunction', icon: '🪐', relatedBody: 'jupiter' },
  { id: 'e4', title: '🌑 Total Lunar Eclipse', description: "The Moon passes through Earth's shadow, taking on a dramatic reddish hue often called a \"Blood Moon.\"", type: 'eclipse', icon: '🌑', relatedBody: 'earth' },
  { id: 'e5', title: '🔭 Hubble Anniversary', description: "Celebrating the Hubble Space Telescope's incredible contributions to our understanding of the cosmos.", type: 'anniversary', icon: '🔭', relatedBody: null },
  { id: 'e6', title: '💫 Geminid Meteor Shower', description: 'One of the richest meteor showers of the year, producing up to 150 multicolored meteors per hour.', type: 'meteor', icon: '💫', relatedBody: null },
  { id: 'e7', title: '🔴 Mars at Opposition', description: 'Mars reaches opposition — its closest approach to Earth, making it appear at its biggest and brightest!', type: 'discovery', icon: '🔴', relatedBody: 'mars' },
  { id: 'e8', title: '🌊 Voyager 1 Update', description: 'Voyager 1, now over 24 billion km from Earth, continues sending data from interstellar space.', type: 'anniversary', icon: '🛸', relatedBody: null },
  { id: 'e9', title: "✨ Halley's Comet Prediction", description: "Next perihelion passage of Halley's Comet predicted for July 2061. Mark your calendars!", type: 'discovery', icon: '✨', relatedBody: 'halley' },
  { id: 'e10', title: '🔥 Solar Flare Warning', description: 'A powerful X-class solar flare erupts from the Sun, potentially creating spectacular auroras on Earth.', type: 'discovery', icon: '🔥', relatedBody: 'sun' },
]

export interface Bookmark {
  id: string
  name: string
  bodyId: string | null
  timestamp: number
}

export interface SolarSystemState {
  selectedBody: string | null
  timeSpeed: number
  showOrbitLines: boolean
  showLabels: boolean
  showAsteroidBelt: boolean
  showKuiperBelt: boolean
  focusTarget: string | null
  cameraPosition: [number, number, number] | null
  elapsedTime: number
  isPaused: boolean
  comparisonBody: string | null
  showNebula: boolean
  showTrails: boolean
  autoRotate: boolean
  showFPS: boolean
  screenshotMode: boolean
  followMode: boolean
  selectedBodyInfo: string | null
  isTourMode: boolean
  tourStep: number
  showSizeComparison: boolean
  showDistanceScale: boolean
  searchQuery: string
  comparisonMode: boolean
  comparisonBody2: string | null
  showConstellations: boolean
  rulerTarget: string | null
  customDate: Date | null
  customDateAngleBase: number
  celestialEvents: CelestialEvent[]
  activeEvent: CelestialEvent | null
  bookmarks: Bookmark[]
  showTimeline: boolean
  screenshotGallery: string[]
  rotationSpeedMultiplier: number
  showGravityWells: boolean
  showHeliosphere: boolean
  showTrojans: boolean
  showBlackHole: boolean
  showWormhole: boolean

  setSelectedBody: (body: string | null) => void
  dismissEvent: () => void
  setActiveEvent: (event: CelestialEvent | null) => void
  addBookmark: (name: string, bodyId: string | null) => void
  removeBookmark: (id: string) => void
  loadBookmark: (id: string) => void
  setTimeSpeed: (speed: number) => void
  setShowOrbitLines: (show: boolean) => void
  setShowLabels: (show: boolean) => void
  setShowAsteroidBelt: (show: boolean) => void
  setShowKuiperBelt: (show: boolean) => void
  setFocusTarget: (target: string | null) => void
  setCameraPosition: (pos: [number, number, number] | null) => void
  setElapsedTime: (time: number) => void
  resetCamera: () => void
  togglePause: () => void
  setComparisonBody: (body: string | null) => void
  setShowNebula: (show: boolean) => void
  setShowTrails: (show: boolean) => void
  setAutoRotate: (rotate: boolean) => void
  setShowFPS: (show: boolean) => void
  setScreenshotMode: (mode: boolean) => void
  toggleAutoRotate: () => void
  toggleFollowMode: () => void
  setFollowMode: (mode: boolean) => void
  navigateNext: () => void
  navigatePrev: () => void
  startTour: () => void
  stopTour: () => void
  nextTourStep: () => void
  prevTourStep: () => void
  setShowSizeComparison: (show: boolean) => void
  setShowDistanceScale: (show: boolean) => void
  setSearchQuery: (query: string) => void
  setComparisonMode: (mode: boolean) => void
  setComparisonBody2: (body: string | null) => void
  setShowConstellations: (show: boolean) => void
  setRulerTarget: (target: string | null) => void
  setCustomDate: (date: Date | null) => void
  setShowTimeline: (show: boolean) => void
  addScreenshot: (dataUrl: string) => void
  clearScreenshots: () => void
  setRotationSpeedMultiplier: (speed: number) => void
  setShowGravityWells: (show: boolean) => void
  setShowHeliosphere: (show: boolean) => void
  setShowTrojans: (show: boolean) => void
  setShowBlackHole: (show: boolean) => void
  setShowWormhole: (show: boolean) => void
}

const NAVIGABLE_BODIES = [
  'sun',
  ...planets.map((p) => p.id),
  ...dwarfPlanets.map((d) => d.id),
  ...comets.map((c) => c.id),
  ...interstellarObjects.map((o) => o.id),
  ...centaurs.map((c) => c.id),
  ...scatteredDiscObjects.map((s) => s.id),
  ...blackHoles.map((b) => b.id),
  ...wormholes.map((w) => w.id),
]

export const TOUR_STEPS = [
  { body: 'sun', title: 'The Sun', description: 'Our star — a G-type main-sequence star containing 99.86% of the Solar System\'s mass. Surface temperature: 5,500°C.' },
  { body: 'mercury', title: 'Mercury', description: 'The smallest and closest planet to the Sun. Despite its proximity, it\'s not the hottest — that title goes to Venus.' },
  { body: 'venus', title: 'Venus', description: 'Earth\'s "evil twin" with a runaway greenhouse effect. Surface temperature reaches 462°C — hot enough to melt lead.' },
  { body: 'earth', title: 'Earth', description: 'Our home — the only known planet with liquid water on its surface and the only one known to harbor life.' },
  { body: 'mars', title: 'Mars', description: 'The Red Planet, home to Olympus Mons — the largest volcano in the Solar System at 21.9 km tall.' },
  { body: 'jupiter', title: 'Jupiter', description: 'The king of planets — so massive that over 1,300 Earths could fit inside. Its Great Red Spot is a storm raging for 350+ years.' },
  { body: 'saturn', title: 'Saturn', description: 'Famous for its stunning ring system, which spans 282,000 km but is only about 10 meters thick.' },
  { body: 'uranus', title: 'Uranus', description: 'The "sideways planet" — it rotates on its side with a 98° axial tilt, likely from an ancient collision.' },
  { body: 'neptune', title: 'Neptune', description: 'The windiest planet with speeds up to 2,100 km/h. It takes 165 years to orbit the Sun once.' },
  { body: 'pluto', title: 'Pluto', description: 'Once the 9th planet, now a dwarf planet. Its heart-shaped nitrogen ice glacier, Tombaugh Regio, was revealed by New Horizons in 2015.' },
  { body: 'halley', title: "Halley's Comet", description: 'The most famous comet, visible from Earth every 75-79 years. Next perihelion passage: July 2061.' },
]

export const useSolarSystemStore = create<SolarSystemState>((set, get) => ({
  selectedBody: null,
  timeSpeed: 1,
  showOrbitLines: true,
  showLabels: true,
  showAsteroidBelt: true,
  showKuiperBelt: true,
  focusTarget: null,
  cameraPosition: null,
  elapsedTime: 0,
  isPaused: false,
  comparisonBody: null,
  showNebula: true,
  showTrails: false,
  autoRotate: false,
  showFPS: false,
  screenshotMode: false,
  followMode: false,
  selectedBodyInfo: null,
  isTourMode: false,
  tourStep: 0,
  showSizeComparison: false,
  showDistanceScale: false,
  searchQuery: '',
  comparisonMode: false,
  comparisonBody2: null,
  showConstellations: false,
  rulerTarget: null,
  customDate: null,
  customDateAngleBase: 0,
  celestialEvents: CELESTIAL_EVENTS,
  activeEvent: null,
  showTimeline: false,
  screenshotGallery: [],
  rotationSpeedMultiplier: 1,
  showGravityWells: false,
  showHeliosphere: false,
  showTrojans: true,
  showBlackHole: true,
  showWormhole: true,
  bookmarks: typeof window !== 'undefined'
    ? (() => {
        try {
          const stored = localStorage.getItem('solar-explorer-bookmarks')
          return stored ? JSON.parse(stored) : []
        } catch {
          return []
        }
      })()
    : [],

  setSelectedBody: (body) => set({ selectedBody: body }),
  dismissEvent: () => set({ activeEvent: null }),
  setActiveEvent: (event) => set({ activeEvent: event }),
  addBookmark: (name, bodyId) => {
    const state = get()
    const newBookmark: Bookmark = {
      id: `bm-${Date.now()}`,
      name,
      bodyId,
      timestamp: Date.now(),
    }
    const updated = [...state.bookmarks, newBookmark]
    set({ bookmarks: updated })
    try {
      localStorage.setItem('solar-explorer-bookmarks', JSON.stringify(updated))
    } catch {
      // ignore storage errors
    }
  },
  removeBookmark: (id) => {
    const state = get()
    const updated = state.bookmarks.filter((b) => b.id !== id)
    set({ bookmarks: updated })
    try {
      localStorage.setItem('solar-explorer-bookmarks', JSON.stringify(updated))
    } catch {
      // ignore storage errors
    }
  },
  loadBookmark: (id) => {
    const state = get()
    const bookmark = state.bookmarks.find((b) => b.id === id)
    if (bookmark && bookmark.bodyId) {
      set({ focusTarget: bookmark.bodyId, selectedBody: bookmark.bodyId })
    }
  },
  setTimeSpeed: (speed) => set({ timeSpeed: speed, isPaused: speed === 0 }),
  setShowOrbitLines: (show) => set({ showOrbitLines: show }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowAsteroidBelt: (show) => set({ showAsteroidBelt: show }),
  setShowKuiperBelt: (show) => set({ showKuiperBelt: show }),
  setFocusTarget: (target) => set({ focusTarget: target }),
  setCameraPosition: (pos) => set({ cameraPosition: pos }),
  setElapsedTime: (time) => set({ elapsedTime: time }),
  resetCamera: () => set({ focusTarget: null, selectedBody: null, cameraPosition: null, comparisonBody: null, isTourMode: false, comparisonMode: false, comparisonBody2: null, rulerTarget: null, showTimeline: false }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused, timeSpeed: s.isPaused ? 1 : 0 })),
  setComparisonBody: (body) => set({ comparisonBody: body }),
  setShowNebula: (show) => set({ showNebula: show }),
  setShowTrails: (show) => set({ showTrails: show }),
  setAutoRotate: (rotate) => set({ autoRotate: rotate }),
  setShowFPS: (show) => set({ showFPS: show }),
  setScreenshotMode: (mode) => set({ screenshotMode: mode }),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  toggleFollowMode: () => set((s) => ({ followMode: !s.followMode })),
  setFollowMode: (mode) => set({ followMode: mode }),
  navigateNext: () => {
    const state = get()
    const current = state.selectedBody || 'sun'
    const idx = NAVIGABLE_BODIES.indexOf(current)
    const nextIdx = (idx + 1) % NAVIGABLE_BODIES.length
    const next = NAVIGABLE_BODIES[nextIdx]
    set({ focusTarget: next, selectedBody: next })
  },
  navigatePrev: () => {
    const state = get()
    const current = state.selectedBody || 'sun'
    const idx = NAVIGABLE_BODIES.indexOf(current)
    const prevIdx = (idx - 1 + NAVIGABLE_BODIES.length) % NAVIGABLE_BODIES.length
    const prev = NAVIGABLE_BODIES[prevIdx]
    set({ focusTarget: prev, selectedBody: prev })
  },
  startTour: () => set({ isTourMode: true, tourStep: 0, focusTarget: TOUR_STEPS[0].body, selectedBody: TOUR_STEPS[0].body }),
  stopTour: () => set({ isTourMode: false }),
  nextTourStep: () => {
    const state = get()
    const nextStep = Math.min(state.tourStep + 1, TOUR_STEPS.length - 1)
    const tourBody = TOUR_STEPS[nextStep].body
    set({ tourStep: nextStep, focusTarget: tourBody, selectedBody: tourBody })
  },
  prevTourStep: () => {
    const state = get()
    const prevStep = Math.max(state.tourStep - 1, 0)
    const tourBody = TOUR_STEPS[prevStep].body
    set({ tourStep: prevStep, focusTarget: tourBody, selectedBody: tourBody })
  },
  setShowSizeComparison: (show) => set({ showSizeComparison: show }),
  setShowDistanceScale: (show) => set({ showDistanceScale: show }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setComparisonMode: (mode) => set({ comparisonMode: mode }),
  setComparisonBody2: (body) => set({ comparisonBody2: body }),
  setShowConstellations: (show) => set({ showConstellations: show }),
  setRulerTarget: (target) => set({ rulerTarget: target }),
  setShowTimeline: (show) => set({ showTimeline: show }),
  addScreenshot: (dataUrl) => set((s) => ({ screenshotGallery: [...s.screenshotGallery, dataUrl] })),
  clearScreenshots: () => set({ screenshotGallery: [] }),
  setRotationSpeedMultiplier: (speed) => set({ rotationSpeedMultiplier: speed }),
  setShowGravityWells: (show) => set({ showGravityWells: show }),
  setShowHeliosphere: (show) => set({ showHeliosphere: show }),
  setShowTrojans: (show) => set({ showTrojans: show }),
  setShowBlackHole: (show) => set({ showBlackHole: show }),
  setShowWormhole: (show) => set({ showWormhole: show }),
  setCustomDate: (date) => {
    const angleBase = date
      ? ((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365.25)) * 2 * Math.PI
      : 0
    set({ customDate: date, customDateAngleBase: angleBase })
  },
}))
