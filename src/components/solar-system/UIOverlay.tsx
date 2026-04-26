'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSolarSystemStore, TOUR_STEPS, CELESTIAL_EVENTS } from './store'
import { getBodyInfo, planets, dwarfPlanets, comets, sunData, interstellarObjects, centaurs, scatteredDiscObjects, humanArtifacts, blackHoles, wormholes } from './data'
import WelcomeSplash from './WelcomeSplash'
import SpaceEventsTimeline from './SpaceEventsTimeline'
import ScreenshotGallery from './ScreenshotGallery'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Rocket,
  Tag,
  Sparkles,
  Gauge,
  X,
  Info,
  Clock,
  Orbit,
  Cloud,
  Keyboard,
  ChevronUp,
  ChevronDown,
  Pause,
  Play,
  Search,
  Camera,
  Ruler,
  Map,
  Eye,
  Footprints,
  SkipForward,
  SkipBack,
  XCircle,
  RefreshCw,
  Image,
  Zap,
  Activity,
  Star,
  Bookmark,
  Navigation,
  Bell,
  GitCompare,
  Calendar,
  Milestone,
  Menu,
  ChevronRightIcon,
  ArrowRight,
  History,
  GalleryHorizontal,
  RotateCw,
  Shield,
  Circle,
  GitMerge,
} from 'lucide-react'

/* ──────────────────────── helpers ──────────────────────── */

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

/* ──────────────────────── TopBar ──────────────────────── */

function TopBar() {
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const isPaused = useSolarSystemStore((s) => s.isPaused)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)
  const showFPS = useSolarSystemStore((s) => s.showFPS)
  const customDate = useSolarSystemStore((s) => s.customDate)
  const [mounted, setMounted] = useState(false)
  const [simTime, setSimTime] = useState<Date | null>(null)
  const [elapsedYears, setElapsedYears] = useState(0)
  const [fps, setFps] = useState(60)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(0)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    // Initialize time on client side only to avoid hydration mismatch
    const now = new Date()
    // Use a micro-task to avoid synchronous setState in effect
    queueMicrotask(() => {
      setSimTime(now)
      setMounted(true)
      lastTimeRef.current = performance.now()
    })
  }, [])

  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      setSimTime((prev) => {
        if (!prev) return new Date()
        const next = new Date(prev.getTime() + 60000 * timeSpeed)
        return next
      })
      setElapsedYears((prev) => prev + (timeSpeed / 365.25) * (1 / 60))
    }, 1000)
    return () => clearInterval(interval)
  }, [timeSpeed, mounted])

  useEffect(() => {
    if (!showFPS) return
    let animId: number
    const measureFps = () => {
      frameCountRef.current++
      const now = performance.now()
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current)
        frameCountRef.current = 0
        lastTimeRef.current = now
      }
      animId = requestAnimationFrame(measureFps)
    }
    animId = requestAnimationFrame(measureFps)
    return () => cancelAnimationFrame(animId)
  }, [showFPS])

  if (screenshotMode) return null

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
      <div className="flex items-center justify-between px-2 sm:px-6 py-2 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-yellow-500/30 sun-logo-glow overflow-hidden">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-yellow-400 scale-75" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 opacity-80" />
            <Rocket className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-xs sm:text-lg font-bold text-white tracking-wide drop-shadow-lg">
              Solar System Explorer
            </h1>
            <p className="text-[6px] sm:text-[9px] text-white/30 -mt-0.5 tracking-wider uppercase">
              Interactive 3D Visualization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* View Mode Buttons */}
          <div className="hidden sm:flex items-center gap-1 bg-black/60 backdrop-blur-xl rounded-xl px-2 py-1.5 border border-white/10 pointer-events-auto shadow-xl">
            <button
              onClick={() => {
                useSolarSystemStore.getState().setCameraPosition([0, 80, 0])
              }}
              className="text-[9px] text-white/40 hover:text-white px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-all flex items-center gap-1"
              title="Top-down view"
            >
              <Eye className="w-2.5 h-2.5" />
              Top
            </button>
            <div className="w-[1px] h-3 bg-white/10" />
            <button
              onClick={() => {
                useSolarSystemStore.getState().setCameraPosition([80, 5, 0])
              }}
              className="text-[9px] text-white/40 hover:text-white px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-all flex items-center gap-1"
              title="Side view"
            >
              <Eye className="w-2.5 h-2.5" />
              Side
            </button>
            <div className="w-[1px] h-3 bg-white/10" />
            <button
              onClick={() => useSolarSystemStore.getState().resetCamera()}
              className="text-[9px] text-white/40 hover:text-white px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-all flex items-center gap-1"
              title="Reset view"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Reset
            </button>
          </div>
          {/* FPS Counter — smaller on mobile */}
          {showFPS && (
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xl rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 sm:py-1.5 border border-white/10 pointer-events-auto shadow-xl">
              <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
              <span className={`text-[9px] sm:text-[11px] font-mono font-bold ${fps >= 50 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                {fps}
              </span>
            </div>
          )}
          {/* Time/speed — hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-2 bg-black/60 backdrop-blur-xl rounded-xl px-4 py-2 border border-white/10 pointer-events-auto shadow-xl">
            {!isPaused && (
              <div className="relative">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-pulse" />
              </div>
            )}
            <Clock className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-[11px] gradient-text-time font-mono tracking-wide">
              {mounted && simTime ? (
                <>
                  {simTime.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  {simTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              ) : (
                '--'
              )}
            </span>
            <Separator orientation="vertical" className="h-3.5 bg-white/20" />
            <span className="text-[11px] text-amber-300 font-mono font-bold">
              {isPaused ? 'PAUSED' : `${timeSpeed.toFixed(1)}x`}
            </span>
          </div>
          {/* Mobile: minimal speed indicator */}
          <div className="sm:hidden flex items-center gap-1 bg-black/60 backdrop-blur-xl rounded-lg px-2 py-1 border border-white/10 pointer-events-auto shadow-xl">
            <span className={`text-[9px] font-mono font-bold ${isPaused ? 'text-red-400' : 'text-amber-300'}`}>
              {isPaused ? '⏸' : `${timeSpeed.toFixed(0)}x`}
            </span>
          </div>
          {elapsedYears > 0.01 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-black/60 backdrop-blur-xl rounded-xl px-3 py-2 border border-white/10 pointer-events-auto shadow-xl">
              <Orbit className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-300 font-mono">
                {elapsedYears < 1 ? `${(elapsedYears * 365.25).toFixed(0)} days` : `${elapsedYears.toFixed(1)} yrs`}
              </span>
            </div>
          )}
          {mounted && customDate && (
            <div className="hidden sm:flex items-center gap-1.5 bg-black/60 backdrop-blur-xl rounded-xl px-3 py-2 border border-amber-400/20 pointer-events-auto shadow-xl">
              <Calendar className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-300 font-mono">
                {customDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
          <button
            onClick={() => useSolarSystemStore.getState().setScreenshotMode(true)}
            className="pointer-events-auto bg-black/60 backdrop-blur-xl rounded-lg sm:rounded-xl p-1.5 sm:p-2 border border-white/10 shadow-xl text-white/40 hover:text-white hover:bg-black/70 hover:border-white/20 transition-all"
            title="Screenshot mode"
          >
            <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── ControlsPanel ──────────────────────── */

function ControlsPanel() {
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(true) // start collapsed on all screens
  const [isClosing, setIsClosing] = useState(false)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const setTimeSpeed = useSolarSystemStore((s) => s.setTimeSpeed)
  const showOrbitLines = useSolarSystemStore((s) => s.showOrbitLines)
  const setShowOrbitLines = useSolarSystemStore((s) => s.setShowOrbitLines)
  const showLabels = useSolarSystemStore((s) => s.showLabels)
  const setShowLabels = useSolarSystemStore((s) => s.setShowLabels)
  const showAsteroidBelt = useSolarSystemStore((s) => s.showAsteroidBelt)
  const setShowAsteroidBelt = useSolarSystemStore((s) => s.setShowAsteroidBelt)
  const showKuiperBelt = useSolarSystemStore((s) => s.showKuiperBelt)
  const setShowKuiperBelt = useSolarSystemStore((s) => s.setShowKuiperBelt)
  const showNebula = useSolarSystemStore((s) => s.showNebula)
  const setShowNebula = useSolarSystemStore((s) => s.setShowNebula)
  const showTrails = useSolarSystemStore((s) => s.showTrails)
  const setShowTrails = useSolarSystemStore((s) => s.setShowTrails)
  const showDistanceScale = useSolarSystemStore((s) => s.showDistanceScale)
  const setShowDistanceScale = useSolarSystemStore((s) => s.setShowDistanceScale)
  const showConstellations = useSolarSystemStore((s) => s.showConstellations)
  const setShowConstellations = useSolarSystemStore((s) => s.setShowConstellations)
  const showGravityWells = useSolarSystemStore((s) => s.showGravityWells)
  const setShowGravityWells = useSolarSystemStore((s) => s.setShowGravityWells)
  const showHeliosphere = useSolarSystemStore((s) => s.showHeliosphere)
  const setShowHeliosphere = useSolarSystemStore((s) => s.setShowHeliosphere)
  const showTrojans = useSolarSystemStore((s) => s.showTrojans)
  const setShowTrojans = useSolarSystemStore((s) => s.setShowTrojans)
  const showBlackHole = useSolarSystemStore((s) => s.showBlackHole)
  const setShowBlackHole = useSolarSystemStore((s) => s.setShowBlackHole)
  const showWormhole = useSolarSystemStore((s) => s.showWormhole)
  const setShowWormhole = useSolarSystemStore((s) => s.setShowWormhole)
  const customDate = useSolarSystemStore((s) => s.customDate)
  const setCustomDate = useSolarSystemStore((s) => s.setCustomDate)
  const autoRotate = useSolarSystemStore((s) => s.autoRotate)
  const toggleAutoRotate = useSolarSystemStore((s) => s.toggleAutoRotate)
  const followMode = useSolarSystemStore((s) => s.followMode)
  const toggleFollowMode = useSolarSystemStore((s) => s.toggleFollowMode)
  const showFPS = useSolarSystemStore((s) => s.showFPS)
  const setShowFPS = useSolarSystemStore((s) => s.setShowFPS)
  const isPaused = useSolarSystemStore((s) => s.isPaused)
  const togglePause = useSolarSystemStore((s) => s.togglePause)
  const setFocusTarget = useSolarSystemStore((s) => s.setFocusTarget)
  const resetCamera = useSolarSystemStore((s) => s.resetCamera)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const bookmarks = useSolarSystemStore((s) => s.bookmarks)
  const addBookmarkAction = useSolarSystemStore((s) => s.addBookmark)
  const removeBookmarkAction = useSolarSystemStore((s) => s.removeBookmark)
  const loadBookmarkAction = useSolarSystemStore((s) => s.loadBookmark)
  const rotationSpeedMultiplier = useSolarSystemStore((s) => s.rotationSpeedMultiplier)
  const setRotationSpeedMultiplier = useSolarSystemStore((s) => s.setRotationSpeedMultiplier)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(-1)
  const searchRef = useRef<HTMLInputElement>(null)

  const allBodies = [
    { id: 'sun', name: 'Sun', color: '#FDB813' },
    ...planets.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    ...dwarfPlanets.map((d) => ({ id: d.id, name: d.name, color: d.color })),
    ...comets.map((c) => ({ id: c.id, name: c.name, color: c.tailColor })),
    ...interstellarObjects.map((o) => ({ id: o.id, name: o.name, color: o.color })),
    ...centaurs.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    ...scatteredDiscObjects.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    ...humanArtifacts.map((a) => ({ id: a.id, name: a.name, color: a.color })),
    ...blackHoles.map((b) => ({ id: b.id, name: b.name, color: '#FF6600' })),
    ...wormholes.map((w) => ({ id: w.id, name: w.name, color: '#6080ff' })),
  ]

  const filteredBodies = searchQuery.trim()
    ? allBodies.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  const handleSearchSelect = useCallback((id: string) => {
    useSolarSystemStore.getState().setFocusTarget(id)
    useSolarSystemStore.getState().setSelectedBody(id)
    setSearchQuery('')
    setSearchFocused(-1)
  }, [])

  // Keyboard navigation for search results
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filteredBodies.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSearchFocused((prev) => (prev + 1) % filteredBodies.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSearchFocused((prev) => (prev - 1 + filteredBodies.length) % filteredBodies.length)
    } else if (e.key === 'Enter' && searchFocused >= 0) {
      e.preventDefault()
      handleSearchSelect(filteredBodies[searchFocused].id)
    }
  }, [filteredBodies, searchFocused, handleSearchSelect])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setCollapsed(true)
      setIsClosing(false)
    }, 250)
  }, [])

  const handleOpen = useCallback(() => {
    setCollapsed(false)
    setIsClosing(false)
  }, [])

  if (screenshotMode) {
    return (
      <div className="absolute right-4 bottom-4 z-30 flex gap-2">
        <button
          onClick={() => {
            // Capture the canvas as a screenshot
            const canvas = document.querySelector('canvas')
            if (canvas) {
              const dataUrl = canvas.toDataURL('image/png')
              useSolarSystemStore.getState().addScreenshot(dataUrl)
              addToast('Screenshot captured!', <Camera className="w-3 h-3 text-amber-400" />)
            }
          }}
          className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 text-amber-400/80 hover:text-amber-400 hover:bg-black/70 hover:border-amber-400/20 transition-all shadow-xl"
          title="Capture screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          onClick={() => useSolarSystemStore.getState().setScreenshotMode(false)}
          className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 text-white/60 hover:text-white hover:bg-black/70 hover:border-white/20 transition-all shadow-xl"
          title="Exit screenshot mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  if (collapsed) {
    return (
      <button
        onClick={handleOpen}
        aria-label="Expand controls"
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-2 sm:p-2.5 text-white/60 hover:text-white hover:bg-black/80 hover:border-white/20 transition-all shadow-xl group"
      >
        {isMobile ? (
          <Menu className="w-5 h-5 group-hover:scale-110 transition-transform" />
        ) : (
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>
    )
  }

  return (
    <>
      {/* Semi-transparent overlay on mobile */}
      {isMobile && (
        <div
          className="fixed inset-0 z-19 bg-black/50 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
          onClick={handleClose}
        />
      )}
      <div
        className={`absolute top-0 left-0 z-20 pointer-events-auto h-full ${
          isMobile ? 'w-[85vw]' : 'left-2 sm:left-4 top-1/2 -translate-y-1/2 w-52 sm:w-60 max-h-[85vh]'
        } ${isMobile ? '' : ''}`}
      >
        <div
          className={`glass-panel-strong rounded-xl overflow-hidden h-full sm:h-auto sm:max-h-[85vh] ${
            isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'
          } ${isMobile ? 'rounded-l-none border-l-0' : ''}`}
        >
          {/* Header with animated gradient */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent animate-header-gradient">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center animate-gentle-pulse">
                <Gauge className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-medium text-white">Controls</span>
            </div>
            <button
              onClick={handleClose}
              aria-label="Collapse controls"
              className="text-white/30 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ScrollArea className="max-h-[75vh] sm:max-h-[75vh]">
            <div className="p-3 sm:p-4 space-y-3.5">
              {/* Search with dropdown */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search celestial bodies..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchFocused(-1) }}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-amber-400/30 focus:bg-white/8 focus:shadow-[0_0_12px_rgba(251,191,36,0.1)] transition-all"
                />
                {filteredBodies.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-xl border border-white/15 rounded-lg overflow-hidden shadow-xl z-50 animate-dropdown-slide-down">
                    {filteredBodies.slice(0, 8).map((b, idx) => (
                      <button
                        key={b.id}
                        onClick={() => handleSearchSelect(b.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] transition-colors ${
                          idx === searchFocused
                            ? 'text-white bg-white/15'
                            : 'text-white/70 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: b.color, boxShadow: `0 0 4px ${b.color}40` }}
                        />
                        {b.name}
                        {idx === searchFocused && (
                          <ArrowRight className="w-2.5 h-2.5 ml-auto text-white/40" style={{ animation: 'arrow-bounce 0.6s ease-in-out infinite' }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-white/50 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Time Speed
                  </label>
                  <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${isPaused ? 'text-red-400 bg-red-400/10' : 'text-amber-300 bg-amber-400/10'}`}>
                    {isPaused ? 'PAUSED' : `${timeSpeed.toFixed(1)}x`}
                  </span>
                </div>
                <Slider
                  value={[timeSpeed]}
                  onValueChange={([v]) => setTimeSpeed(v)}
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full slider-planet"
                />
                <div className="flex justify-between text-[9px] text-white/20 font-mono">
                  <span>0x</span>
                  <span>50x</span>
                  <span>100x</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 border-white/15 text-white/60 hover:text-white hover:bg-white/10 text-[10px] h-7 ${isPaused ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : ''}`}
                    onClick={togglePause}
                  >
                    {isPaused ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                    {isPaused ? 'Play' : 'Pause'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`border-white/15 text-white/60 hover:text-white hover:bg-white/10 text-[10px] h-7 px-2 ${timeSpeed === 1 ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : ''}`}
                    onClick={() => setTimeSpeed(1)}
                    title="Reset to 1x"
                  >
                    1x
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`border-white/15 text-white/60 hover:text-white hover:bg-white/10 text-[10px] h-7 px-2 ${timeSpeed === 10 ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : ''}`}
                    onClick={() => setTimeSpeed(10)}
                    title="10x speed"
                  >
                    10x
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`border-white/15 text-white/60 hover:text-white hover:bg-white/10 text-[10px] h-7 px-2 ${timeSpeed === 50 ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : ''}`}
                    onClick={() => setTimeSpeed(50)}
                    title="50x speed"
                  >
                    50x
                  </Button>
                </div>
              </div>

              <div className="section-divider" />

              {/* Toggles */}
              <div className="space-y-2.5">
                <ToggleRow icon={<Orbit className="w-3 h-3" />} label="Orbit Lines" checked={showOrbitLines} onChange={setShowOrbitLines} />
                <ToggleRow icon={<Tag className="w-3 h-3" />} label="Labels" checked={showLabels} onChange={setShowLabels} />
                <ToggleRow icon={<Sparkles className="w-3 h-3" />} label="Asteroid Belt" checked={showAsteroidBelt} onChange={setShowAsteroidBelt} />
                <ToggleRow icon={<Sparkles className="w-3 h-3" />} label="Kuiper Belt" checked={showKuiperBelt} onChange={setShowKuiperBelt} />
                <ToggleRow icon={<Cloud className="w-3 h-3" />} label="Nebula" checked={showNebula} onChange={setShowNebula} />
                <ToggleRow icon={<Footprints className="w-3 h-3" />} label="Orbital Trails" checked={showTrails} onChange={setShowTrails} />
                <ToggleRow icon={<RefreshCw className="w-3 h-3" />} label="Auto Rotate" checked={autoRotate} onChange={() => toggleAutoRotate()} />
                <ToggleRow icon={<Eye className="w-3 h-3" />} label="Follow Mode" checked={followMode} onChange={() => toggleFollowMode()} />
                <ToggleRow icon={<Activity className="w-3 h-3" />} label="FPS Counter" checked={showFPS} onChange={setShowFPS} />
                <ToggleRow icon={<Ruler className="w-3 h-3" />} label="Distance Scale" checked={showDistanceScale} onChange={setShowDistanceScale} />
                <ToggleRow icon={<Star className="w-3 h-3" />} label="Constellations" checked={showConstellations} onChange={setShowConstellations} />
                <ToggleRow icon={<Zap className="w-3 h-3" />} label="Gravity Wells" checked={showGravityWells} onChange={setShowGravityWells} />
                <ToggleRow icon={<Shield className="w-3 h-3" />} label="Heliosphere" checked={showHeliosphere} onChange={setShowHeliosphere} />
                <ToggleRow icon={<Sparkles className="w-3 h-3" />} label="Jupiter Trojans" checked={showTrojans} onChange={setShowTrojans} />
                <ToggleRow icon={<Circle className="w-3 h-3 text-amber-600/70" />} label="Black Hole" checked={showBlackHole} onChange={setShowBlackHole} />
                <ToggleRow icon={<GitMerge className="w-3 h-3 text-purple-400/70" />} label="Wormhole" checked={showWormhole} onChange={setShowWormhole} />
              </div>

              <div className="section-divider" />

              {/* Date / Time Travel */}
              <div className="space-y-2">
                <label className="text-[11px] text-white/50 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Time Travel
                </label>
                <input
                  type="date"
                  value={customDate ? customDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val) {
                      setCustomDate(new Date(val + 'T12:00:00'))
                    } else {
                      setCustomDate(null)
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white/80 focus:outline-none focus:border-amber-400/30 transition-all [color-scheme:dark]"
                />
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setCustomDate(null)}
                    className={`text-[9px] px-1 py-1.5 rounded-lg transition-all border ${
                      !customDate
                        ? 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                        : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/15'
                    }`}
                  >
                    Current
                  </button>
                  <button
                    onClick={() => setCustomDate(new Date(-2000, 0, 1))}
                    className={`text-[9px] px-1 py-1.5 rounded-lg transition-all border ${
                      customDate && customDate.getFullYear() === -2000
                        ? 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                        : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/15'
                    }`}
                  >
                    2000 BC
                  </button>
                  <button
                    onClick={() => setCustomDate(new Date(1000, 0, 1))}
                    className={`text-[9px] px-1 py-1.5 rounded-lg transition-all border ${
                      customDate && customDate.getFullYear() === 1000
                        ? 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                        : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/15'
                    }`}
                  >
                    1000 AD
                  </button>
                  <button
                    onClick={() => setCustomDate(new Date(2050, 0, 1))}
                    className={`text-[9px] px-1 py-1.5 rounded-lg transition-all border ${
                      customDate && customDate.getFullYear() === 2050
                        ? 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                        : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/15'
                    }`}
                  >
                    2050 AD
                  </button>
                  <button
                    onClick={() => setCustomDate(new Date(3000, 0, 1))}
                    className={`text-[9px] px-1 py-1.5 rounded-lg transition-all border ${
                      customDate && customDate.getFullYear() === 3000
                        ? 'bg-amber-500/15 text-amber-400 border-amber-400/30'
                        : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/15'
                    }`}
                  >
                    3000 AD
                  </button>
                </div>
              </div>

              <div className="section-divider" />

              {/* Navigate */}
              <div className="space-y-2">
                <label className="text-[11px] text-white/50 flex items-center gap-1.5">
                  <Rocket className="w-3 h-3" />
                  Navigate To
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <FocusButton label="Sun" target="sun" color="#FDB813" emoji="☀️" />
                  {planets.map((p) => (
                    <FocusButton key={p.id} label={p.name} target={p.id} color={p.color} />
                  ))}
                </div>
                <label className="text-[10px] text-white/30 flex items-center gap-1 pt-1 sm:block hidden">
                  Dwarf Planets
                </label>
                <div className="grid grid-cols-3 gap-1 sm:block hidden">
                  {dwarfPlanets.map((dp) => (
                    <FocusButton key={dp.id} label={dp.name} target={dp.id} color={dp.color} />
                  ))}
                </div>
                <label className="text-[10px] text-white/30 flex items-center gap-1 pt-1">
                  Comets
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {comets.map((c) => (
                    <FocusButton key={c.id} label={c.name} target={c.id} color={c.tailColor} />
                  ))}
                </div>
                <label className="text-[10px] text-white/30 flex items-center gap-1 pt-1 sm:block hidden">
                  Interstellar
                </label>
                <div className="grid grid-cols-2 gap-1 sm:block hidden">
                  {interstellarObjects.map((o) => (
                    <FocusButton key={o.id} label={o.name} target={o.id} color={o.color} />
                  ))}
                </div>
                <label className="text-[10px] text-white/30 flex items-center gap-1 pt-1 sm:block hidden">
                  Centaurs
                </label>
                <div className="grid grid-cols-2 gap-1 sm:block hidden">
                  {centaurs.map((c) => (
                    <FocusButton key={c.id} label={c.name} target={c.id} color={c.color} />
                  ))}
                </div>
                <label className="text-[10px] text-white/30 flex items-center gap-1 pt-1 sm:block hidden">
                  Scattered Disc
                </label>
                <div className="grid grid-cols-2 gap-1 sm:block hidden">
                  {scatteredDiscObjects.map((s) => (
                    <FocusButton key={s.id} label={s.name} target={s.id} color={s.color} />
                  ))}
                </div>
                <label className="text-[10px] text-white/30 flex items-center gap-1 pt-1 sm:block hidden">
                  Spacecraft
                </label>
                <div className="grid grid-cols-2 gap-1 sm:block hidden">
                  {humanArtifacts.map((a) => (
                    <FocusButton key={a.id} label={a.name} target={a.id} color={a.color} />
                  ))}
                </div>
                <label className="text-[10px] text-white/30 flex items-center gap-1 pt-1">
                  Exotic Objects
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {blackHoles.map((b) => (
                    <FocusButton key={b.id} label={b.name} target={b.id} color="#FF6600" emoji="🕳️" exotic="blackhole" />
                  ))}
                  {wormholes.map((w) => (
                    <FocusButton key={w.id} label={w.name} target={w.id} color="#8060ff" emoji="🌀" exotic="wormhole" />
                  ))}
                </div>
              </div>

              <div className="section-divider" />

              {/* Quick Actions */}
              <div className="space-y-2">
                <label className="text-[11px] text-white/50 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  Quick Actions
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <ActionButton
                    icon={<Footprints className="w-3 h-3" />}
                    label="Guided Tour"
                    onClick={() => {
                      useSolarSystemStore.getState().startTour()
                      addToast('Starting guided tour...', <Footprints className="w-3 h-3 text-amber-400" />)
                    }}
                    accent
                  />
                  <ActionButton
                    icon={<Ruler className="w-3 h-3" />}
                    label="Size Compare"
                    onClick={() => {
                      useSolarSystemStore.getState().setShowSizeComparison(true)
                      addToast('Opening size comparison...', <Ruler className="w-3 h-3 text-white/60" />)
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-1">
                  <ActionButton
                    icon={<GitCompare className="w-3 h-3" />}
                    label="Compare Planets"
                    onClick={() => {
                      const state = useSolarSystemStore.getState()
                      if (state.selectedBody) {
                        state.setComparisonMode(true)
                        state.setComparisonBody2(null)
                        addToast('Entering comparison mode...', <GitCompare className="w-3 h-3 text-emerald-400" />)
                      } else {
                        addToast('Select a body first to compare', <Info className="w-3 h-3 text-white/40" />)
                      }
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <ActionButton
                    icon={<History className="w-3 h-3" />}
                    label="Space Timeline"
                    onClick={() => {
                      useSolarSystemStore.getState().setShowTimeline(true)
                      addToast('Opening space timeline...', <History className="w-3 h-3 text-amber-400" />)
                    }}
                  />
                  <ActionButton
                    icon={<GalleryHorizontal className="w-3 h-3" />}
                    label="Screenshots"
                    onClick={() => {
                      const state = useSolarSystemStore.getState()
                      if (state.screenshotGallery.length > 0) {
                        addToast(`${state.screenshotGallery.length} screenshots saved`, <Camera className="w-3 h-3 text-white/60" />)
                      } else {
                        addToast('Take screenshots with S key in screenshot mode', <Camera className="w-3 h-3 text-white/40" />)
                      }
                    }}
                  />
                </div>
              </div>

              <div className="section-divider" />

              {/* Rotation Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-white/50 flex items-center gap-1.5">
                    <RotateCw className="w-3 h-3" />
                    Rotation Speed
                  </label>
                  <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    {rotationSpeedMultiplier.toFixed(1)}x
                  </span>
                </div>
                <Slider
                  value={[rotationSpeedMultiplier]}
                  onValueChange={([v]) => setRotationSpeedMultiplier(v)}
                  min={0}
                  max={5}
                  step={0.1}
                  className="w-full slider-planet"
                />
                <div className="flex justify-between text-[9px] text-white/20 font-mono">
                  <span>0x</span>
                  <span>2.5x</span>
                  <span>5x</span>
                </div>
              </div>

              <div className="section-divider" />

              {/* Bookmarks */}
              <div className="space-y-2">
                <label className="text-[11px] text-white/50 flex items-center gap-1.5">
                  <Bookmark className="w-3 h-3" />
                  Bookmarks
                </label>
                {selectedBody && (
                  <button
                    onClick={() => {
                      const bodyName = allBodies.find((b) => b.id === selectedBody)?.name || selectedBody
                      addBookmarkAction(bodyName, selectedBody)
                      addToast(`Bookmarked ${bodyName}`, <Star className="w-3 h-3 text-amber-400" />)
                    }}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] px-2 py-2 rounded-lg transition-all border bg-gradient-to-br from-amber-500/10 to-orange-500/5 text-amber-400/80 border-amber-400/15 hover:from-amber-500/20 hover:to-orange-500/10 hover:border-amber-400/30 hover:text-amber-400"
                  >
                    <Star className="w-3 h-3" />
                    ⭐ Bookmark Current
                  </button>
                )}
                {bookmarks.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    {bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 rounded-lg px-2 py-1.5 transition-all group"
                      >
                        <button
                          onClick={() => loadBookmarkAction(bm.id)}
                          className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                        >
                          <Star className="w-2.5 h-2.5 text-amber-400/60 flex-shrink-0" />
                          <span className="text-[10px] text-white/60 group-hover:text-white/90 truncate">{bm.name}</span>
                        </button>
                        <button
                          onClick={() => removeBookmarkAction(bm.id)}
                          className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 p-0.5 hover:bg-white/10 rounded"
                          aria-label={`Remove bookmark ${bm.name}`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {bookmarks.length === 0 && !selectedBody && (
                  <p className="text-[9px] text-white/20 text-center py-1">
                    Select a body to bookmark it
                  </p>
                )}
              </div>

              <div className="section-divider" />

              {/* Keyboard Shortcuts — accordion style */}
              <div className="space-y-1.5">
                <button
                  className="flex items-center justify-between w-full"
                  onClick={() => setShowShortcuts(!showShortcuts)}
                >
                  <label className="text-[11px] text-white/50 flex items-center gap-1.5">
                    <Keyboard className="w-3 h-3" />
                    Shortcuts
                  </label>
                  <ChevronDown className={`w-3 h-3 text-white/30 transition-transform duration-200 ${showShortcuts ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: showShortcuts ? '200px' : '0px', opacity: showShortcuts ? 1 : 0 }}
                >
                  <div className="space-y-1 pt-1">
                    <ShortcutRow keys="← →" desc="Navigate bodies" />
                    <ShortcutRow keys="+ / -" desc="Speed up/down" />
                    <ShortcutRow keys="Space" desc="Pause/Play" />
                    <ShortcutRow keys="Esc" desc="Reset view" />
                    <ShortcutRow keys="T" desc="Guided Tour" />
                    <ShortcutRow keys="R" desc="Auto Rotate" />
                    <ShortcutRow keys="S" desc="Screenshot mode" />
                    <ShortcutRow keys="F" desc="Follow Mode" />
                  </div>
                </div>
              </div>

              <div className="section-divider" />

              {/* Reset */}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-white/15 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/25 text-[11px]"
                onClick={resetCamera}
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Reset View
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  )
}

function ToggleRow({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between group toggle-row-hover">
      <label className="text-[11px] text-white/50 flex items-center gap-1.5 group-hover:text-white/70 transition-colors">
        {icon}
        {label}
      </label>
      <div className={checked ? 'animate-toggle-glow rounded-full' : ''}>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  )
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-white/25">{desc}</span>
      <div className="flex gap-0.5">
        {keys.split(' ').map((key, i) => (
          <kbd key={i} className="text-[8px] bg-white/8 text-white/40 px-1 py-0.5 rounded border border-white/10 font-mono">
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )
}

function FocusButton({ label, target, color, emoji, exotic }: { label: string; target: string; color: string; emoji?: string; exotic?: 'blackhole' | 'wormhole' }) {
  const setFocusTarget = useSolarSystemStore((s) => s.setFocusTarget)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const isSelected = selectedBody === target
  const [hovered, setHovered] = useState(false)

  // Special styling for exotic objects
  const isBlackhole = exotic === 'blackhole'
  const isWormhole = exotic === 'wormhole'
  const isExotic = isBlackhole || isWormhole

  const getExoticStyle = (): React.CSSProperties => {
    if (isBlackhole) {
      return {
        background: isSelected
          ? 'linear-gradient(135deg, #1a0a00, #331500)'
          : hovered
            ? 'linear-gradient(135deg, #1a0a00, #331500)'
            : 'linear-gradient(135deg, #0a0500, #1a0a00)',
        borderColor: isSelected ? '#FF660060' : hovered ? '#FF660030' : '#FF660015',
        boxShadow: isSelected
          ? '0 0 12px #FF660040, 0 0 24px #FF660020, inset 0 0 8px #FF660010'
          : hovered
            ? '0 0 10px #FF660030, 0 0 20px #FF660015'
            : undefined,
        color: isSelected ? '#FFB060' : hovered ? '#FF9040' : undefined,
      }
    }
    if (isWormhole) {
      return {
        background: isSelected
          ? 'linear-gradient(135deg, #0a0520, #150a30)'
          : hovered
            ? 'linear-gradient(135deg, #0a0520, #150a30)'
            : 'linear-gradient(135deg, #050215, #0a0520)',
        borderColor: isSelected ? '#8060ff60' : hovered ? '#8060ff30' : '#8060ff15',
        boxShadow: isSelected
          ? '0 0 12px #8060ff40, 0 0 24px #8060ff20, inset 0 0 8px #8060ff10'
          : hovered
            ? '0 0 10px #8060ff30, 0 0 20px #8060ff15'
            : undefined,
        color: isSelected ? '#B090FF' : hovered ? '#9070FF' : undefined,
      }
    }
    return {
      borderColor: isSelected ? `${color}60` : undefined,
      color: isSelected ? 'white' : undefined,
      boxShadow: isSelected ? `0 0 8px ${color}40, 0 0 16px ${color}20` : undefined,
    }
  }

  return (
    <button
      onClick={() => { setFocusTarget(target); setSelectedBody(target) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`text-[9px] px-1 rounded-lg transition-all duration-200 truncate relative overflow-hidden group border ${
        isExotic ? 'py-2.5' : 'py-1.5'
      } ${
        isExotic
          ? isSelected
            ? 'animate-border-glow-pulse'
            : 'hover:scale-[1.06]'
          : isSelected
            ? 'bg-white/15 text-white animate-border-glow-pulse'
            : 'bg-white/5 text-white/40 hover:bg-white/15 hover:text-white border-white/5 hover:border-white/15 hover:scale-[1.04]'
      }`}
      style={getExoticStyle()}
      title={label}
    >
      <div className="flex items-center gap-1 justify-center">
        {emoji ? (
          <span className="text-[10px]">{emoji}</span>
        ) : (
          <div
            className={`rounded-full flex-shrink-0 transition-all duration-200 ${isSelected ? 'w-2 h-2' : 'w-1.5 h-1.5'}`}
            style={{
              backgroundColor: color,
              boxShadow: isSelected ? `0 0 8px ${color}, 0 0 16px ${color}40` : hovered ? `0 0 6px ${color}60` : undefined,
            }}
          />
        )}
        <span className="truncate">{label}</span>
      </div>
      {/* Hover arrow indicator */}
      {hovered && !isSelected && (
        <ChevronRightIcon className="absolute right-0.5 top-1/2 -translate-y-1/2 w-2 h-2 text-white/30" style={{ animation: 'arrow-bounce 0.5s ease-in-out infinite' }} />
      )}
    </button>
  )
}

function ActionButton({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean }) {
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Create ripple effect
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setRipple({ x, y, id: Date.now() })
      setTimeout(() => setRipple(null), 600)
    }
    onClick()
  }

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      className={`relative flex items-center gap-1.5 justify-center text-[10px] px-2 py-2 rounded-lg transition-all duration-200 border overflow-hidden hover:scale-[1.03] active:scale-[0.97] ${
        accent
          ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 text-amber-400/80 border-amber-400/15 hover:from-amber-500/20 hover:to-orange-500/10 hover:border-amber-400/30 hover:text-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.1)] hover:shadow-[0_0_16px_rgba(251,191,36,0.2)]'
          : 'bg-gradient-to-br from-white/8 to-white/3 text-white/60 border-white/8 hover:from-white/15 hover:to-white/8 hover:border-white/20 hover:text-white'
      }`}
    >
      {ripple && (
        <span
          className="absolute rounded-full bg-white/20 animate-ripple pointer-events-none"
          style={{
            left: ripple.x - 4,
            top: ripple.y - 4,
            width: 8,
            height: 8,
          }}
        />
      )}
      {icon}
      <span className="relative z-10">{label}</span>
    </button>
  )
}

/* ──────────────────────── Physics Tooltip ──────────────────────── */

const PHYSICS_DEFINITIONS: Record<string, string> = {
  'Schwarzschild Radius': 'The radius of the event horizon for a non-rotating black hole: Rs = 2GM/c². Nothing, not even light, can escape from within this radius.',
  'Event Horizon Radius': 'The boundary beyond which events cannot affect an outside observer. For a Schwarzschild black hole, this equals the Schwarzschild radius.',
  'Photon Sphere': 'A spherical region at 1.5×Rs where photons can orbit the black hole. Light here is trapped in unstable circular orbits.',
  'ISCO': 'Innermost Stable Circular Orbit — the smallest radius where stable circular orbits exist. At 3×Rs for Schwarzschild, 0.5×Rs for maximally spinning Kerr.',
  'Hawking Temperature': 'The blackbody temperature of Hawking radiation: T = ℏc³/(8πGMk_B). Smaller black holes are hotter; supermassive ones are near absolute zero.',
  'Accretion Disk Temp': 'Temperature of the orbiting matter disk. Follows T ∝ r^(-3/4) profile: ~10⁷ K at the inner edge, ~10⁴ K at the outer edge.',
  'Jet Speed': 'Relativistic jets are collimated outflows of plasma moving at near-light speeds along the rotation axis, powered by magnetic fields.',
  'Throat Radius': 'The narrowest part of the wormhole — the "bridge" connecting two spacetime regions. Must be kept open by exotic matter.',
  'Mouth Radius': 'The radius of the wormhole opening (mouth). Each mouth is an entrance/exit to the throat connecting two spacetime regions.',
  'Throat Circumference': 'The circumference at the narrowest point: 2πr_throat. Determines the size of objects that could theoretically pass through.',
  'Exotic Matter Density': 'Negative energy density matter required to keep the wormhole throat open. Violates the null energy condition.',
  'Traversability': 'Whether the wormhole can be traversed. Morris-Thorne wormholes are theoretically traversable, unlike Einstein-Rosen bridges.',
  'Frame Dragging': 'The effect where a rotating massive object drags spacetime around it. In wormholes, it creates the spiral pattern at each mouth.',
  'Mass': 'For black holes: total mass in solar masses. Sgr A* ≈ 4 million solar masses.',
}

function PhysicsTooltip({ term }: { term: string }) {
  const definition = PHYSICS_DEFINITIONS[term]
  if (!definition) return <span>{term}</span>

  return (
    <span className="relative group/tooltip inline-flex items-center gap-0.5 cursor-help">
      <span>{term}</span>
      <Info className="w-2.5 h-2.5 text-white/20 group-hover/tooltip:text-amber-400/60 transition-colors" />
      <span className="absolute left-0 top-full mt-1 z-50 hidden group-hover/tooltip:block pointer-events-none">
        <span className="block w-48 px-2 py-1.5 text-[8px] leading-snug text-amber-200/90 bg-black/95 border border-amber-500/20 rounded-md shadow-lg backdrop-blur-sm">
          {definition}
        </span>
      </span>
    </span>
  )
}

/* ──────────────────────── Black Hole Structure Diagram ──────────────────────── */

function BlackHoleDiagram() {
  return (
    <div className="px-3 sm:px-4 py-2 border-b border-white/5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] text-amber-400/60 font-bold uppercase tracking-widest">
          Structure
        </span>
      </div>
      <svg viewBox="0 0 200 120" className="w-full h-auto" style={{ maxHeight: '100px' }}>
        {/* Accretion Disk — outer gradient ring */}
        <defs>
          <radialGradient id="bh-disk-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="30%" stopColor="#FF6600" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#FF9933" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFCC66" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        {/* Accretion disk ellipse (tilted view) */}
        <ellipse cx="100" cy="60" rx="85" ry="18" fill="none" stroke="#FF9933" strokeWidth="10" opacity="0.3" />
        <ellipse cx="100" cy="60" rx="70" ry="14" fill="none" stroke="#FF6600" strokeWidth="6" opacity="0.5" />
        {/* ISCO — dashed ring */}
        <ellipse cx="100" cy="60" rx="50" ry="10" fill="none" stroke="#CC8800" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" />
        <text x="155" y="54" fill="#CC8800" fontSize="6" opacity="0.7">ISCO</text>
        {/* Photon Sphere — ring */}
        <ellipse cx="100" cy="60" rx="28" ry="6" fill="none" stroke="#FFE8B0" strokeWidth="1.5" opacity="0.8" />
        <text x="128" y="58" fill="#FFE8B0" fontSize="6" opacity="0.7">Photon Sphere</text>
        {/* Event Horizon — black circle */}
        <circle cx="100" cy="60" r="16" fill="#000000" stroke="#FF4400" strokeWidth="0.5" opacity="0.9" />
        <text x="118" y="64" fill="#FF4400" fontSize="6" opacity="0.8">Event Horizon</text>
        {/* Centre label */}
        <text x="100" y="63" fill="#333" fontSize="5" textAnchor="middle">Rs</text>
        {/* Accretion disk label */}
        <text x="55" y="44" fill="#FF9933" fontSize="6" opacity="0.7">Accretion Disk</text>
      </svg>
    </div>
  )
}

/* ──────────────────────── Wormhole Structure Diagram ──────────────────────── */

function WormholeDiagram() {
  return (
    <div className="px-3 sm:px-4 py-2 border-b border-white/5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] text-purple-400/60 font-bold uppercase tracking-widest">
          Structure
        </span>
      </div>
      <svg viewBox="0 0 200 140" className="w-full h-auto" style={{ maxHeight: '110px' }}>
        {/* Upper funnel (entry mouth) */}
        <path d="M 30 10 Q 100 50 170 10" fill="none" stroke="#6080ff" strokeWidth="1.5" opacity="0.5" />
        <path d="M 30 10 Q 100 55 170 10" fill="none" stroke="#4060dd" strokeWidth="0.5" opacity="0.3" strokeDasharray="2,2" />
        {/* Throat connection */}
        <path d="M 85 50 Q 100 70 115 50" fill="none" stroke="#8040cc" strokeWidth="2" opacity="0.6" />
        <path d="M 85 50 L 85 90" fill="none" stroke="#6080ff" strokeWidth="1" opacity="0.3" strokeDasharray="3,2" />
        <path d="M 115 50 L 115 90" fill="none" stroke="#6080ff" strokeWidth="1" opacity="0.3" strokeDasharray="3,2" />
        {/* Lower funnel (exit mouth) */}
        <path d="M 30 130 Q 100 90 170 130" fill="none" stroke="#6080ff" strokeWidth="1.5" opacity="0.5" />
        <path d="M 30 130 Q 100 85 170 130" fill="none" stroke="#4060dd" strokeWidth="0.5" opacity="0.3" strokeDasharray="2,2" />
        {/* Spacetime curvature grid lines — upper */}
        <line x1="50" y1="18" x2="50" y2="30" stroke="#40e0d0" strokeWidth="0.5" opacity="0.3" />
        <line x1="80" y1="30" x2="80" y2="42" stroke="#40e0d0" strokeWidth="0.5" opacity="0.3" />
        <line x1="120" y1="30" x2="120" y2="42" stroke="#40e0d0" strokeWidth="0.5" opacity="0.3" />
        <line x1="150" y1="18" x2="150" y2="30" stroke="#40e0d0" strokeWidth="0.5" opacity="0.3" />
        {/* Spacetime curvature grid lines — lower */}
        <line x1="50" y1="122" x2="50" y2="110" stroke="#40e0d0" strokeWidth="0.5" opacity="0.3" />
        <line x1="80" y1="110" x2="80" y2="98" stroke="#40e0d0" strokeWidth="0.5" opacity="0.3" />
        <line x1="120" y1="110" x2="120" y2="98" stroke="#40e0d0" strokeWidth="0.5" opacity="0.3" />
        <line x1="150" y1="122" x2="150" y2="110" stroke="#40e0d0" strokeWidth="0.5" opacity="0.3" />
        {/* Throat label */}
        <text x="125" y="72" fill="#8040cc" fontSize="6" opacity="0.7">Throat</text>
        {/* Entry/Exit arrows */}
        <text x="100" y="7" fill="#6080ff" fontSize="6" textAnchor="middle" opacity="0.8">Entry Mouth</text>
        <text x="100" y="140" fill="#6080ff" fontSize="6" textAnchor="middle" opacity="0.8">Exit Mouth</text>
        {/* Curvature grid label */}
        <text x="158" y="26" fill="#40e0d0" fontSize="5" opacity="0.5">Curvature</text>
        {/* Direction arrow through throat */}
        <line x1="100" y1="40" x2="100" y2="100" stroke="#80d0ff" strokeWidth="1" opacity="0.4" />
        <polygon points="97,96 100,102 103,96" fill="#80d0ff" opacity="0.5" />
      </svg>
    </div>
  )
}

/* ──────────────────────── InfoPanel ──────────────────────── */

function InfoPanel() {
  const isMobile = useIsMobile()
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((s) => s.setFocusTarget)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)
  const rulerTarget = useSolarSystemStore((s) => s.rulerTarget)
  const setRulerTarget = useSolarSystemStore((s) => s.setRulerTarget)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [mountedBody, setMountedBody] = useState<string | null>(null)
  const [funFactIndex, setFunFactIndex] = useState(0)
  const [funFactKey, setFunFactKey] = useState(0)

  // Handle visibility with animations
  useEffect(() => {
    if (selectedBody) {
      setIsClosing(false)
      setIsVisible(true)
      setMountedBody(selectedBody)
      setFunFactIndex(0)
      setFunFactKey((k) => k + 1)
    } else if (isVisible) {
      setIsClosing(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setIsClosing(false)
        setMountedBody(null)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [selectedBody, isVisible])

  // Fun fact rotation — cycle every 5 seconds
  useEffect(() => {
    if (!mountedBody) return
    const interval = setInterval(() => {
      setFunFactKey((k) => k + 1)
      setFunFactIndex((prev) => {
        const info = getBodyInfo(mountedBody)
        if (!info || info.funFacts.length <= 1) return 0
        return (prev + 1) % info.funFacts.length
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [mountedBody])

  if (screenshotMode) return null

  // Empty state — no body selected
  if (!isVisible && !selectedBody) {
    return (
      <div className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-56 sm:w-72 pointer-events-auto ${isMobile ? 'hidden' : ''}`}>
        <div className="glass-panel rounded-xl p-5 sm:p-6 text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-2 border border-white/10 rounded-full" />
            <div className="absolute inset-5 border border-white/5 rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 shadow-lg shadow-yellow-400/40" />
            </div>
            <div className="absolute inset-2 animate-spin" style={{ animationDuration: '4s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
            </div>
            <div className="absolute inset-5 animate-spin" style={{ animationDuration: '2.5s', animationDirection: 'reverse' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400 shadow-sm shadow-red-400/50" />
            </div>
          </div>
          <p className="text-xs text-white/40 leading-relaxed font-medium">
            Click on any celestial body<br />to view its details
          </p>
          <div className="mt-4 space-y-1.5">
            <p className="text-[9px] text-white/20 leading-relaxed">
              <kbd className="bg-white/8 text-white/30 px-1 py-0.5 rounded border border-white/10 font-mono text-[8px]">← →</kbd> Navigate between bodies
            </p>
            <p className="text-[9px] text-white/20 leading-relaxed">
              <kbd className="bg-white/8 text-white/30 px-1 py-0.5 rounded border border-white/10 font-mono text-[8px]">T</kbd> Start guided tour
            </p>
            <p className="text-[9px] text-white/20 leading-relaxed">
              <kbd className="bg-white/8 text-white/30 px-1 py-0.5 rounded border border-white/10 font-mono text-[8px]">Space</kbd> Pause/Resume
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4 border-amber-400/20 text-amber-400/70 hover:text-amber-400 hover:bg-amber-400/10 text-[10px]"
            onClick={() => {
              useSolarSystemStore.getState().startTour()
              addToast('Starting guided tour...', <Footprints className="w-3 h-3 text-amber-400" />)
            }}
          >
            <Footprints className="w-3 h-3 mr-1" />
            Start Guided Tour
          </Button>
        </div>
      </div>
    )
  }

  // On mobile, show empty state hint differently
  if (!isVisible && isMobile) return null

  const bodyToShow = mountedBody || selectedBody
  if (!bodyToShow) return null

  const info = getBodyInfo(bodyToShow)
  if (!info) return null

  const planet = planets.find((p) => p.id === bodyToShow)
  const dwarfPlanet = dwarfPlanets.find((d) => d.id === bodyToShow)
  const comet = comets.find((c) => c.id === bodyToShow)
  const color = bodyToShow === 'sun'
    ? '#FDB813'
    : (planet?.color || dwarfPlanet?.color || comet?.tailColor || '#888888')

  const diameter = bodyToShow === 'sun'
    ? sunData.diameter
    : (planet?.diameter || dwarfPlanet?.diameter || 0)

  const typeColor = bodyToShow === 'sun' ? '#FDB813'
    : planet?.type === 'Gas Giant' ? '#C88B3A'
    : planet?.type === 'Ice Giant' ? '#9FC4C7'
    : planet?.type === 'Terrestrial Planet' ? '#C1440E'
    : dwarfPlanet ? '#C4A882'
    : comet ? '#87CEEB'
    : '#888888'

  const handleClosePanel = () => {
    setSelectedBody(null)
  }

  // Animation class based on state
  const animationClass = isClosing
    ? (isMobile ? 'animate-slide-down-bottom' : 'animate-slide-out-right')
    : (isMobile ? 'animate-slide-up-bottom' : 'animate-slide-in-right')

  // Mobile: bottom sheet; Desktop: right panel
  if (isMobile) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-20 pointer-events-auto ${animationClass}`}>
        <div className="glass-panel-strong rounded-t-2xl overflow-hidden max-h-[60vh] flex flex-col">
          {/* Drag handle bar */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-8 h-1 bg-white/20 rounded-full" />
          </div>
          {/* Gradient border matching planet color */}
          <div className="h-[2px] mx-4 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
          {/* Physics Note Badge for exotic objects */}
          {info.physicsNote && (
            <div className="mx-4 mt-2">
              <div
                className={`text-[8px] px-2 py-1 rounded-md font-medium tracking-wide ${
                  blackHoles.some((b) => b.id === bodyToShow)
                    ? 'bg-amber-900/30 text-amber-300/80 border border-amber-500/20'
                    : 'bg-purple-900/30 text-purple-300/80 border border-purple-500/20'
                }`}
              >
                {info.physicsNote}
              </div>
            </div>
          )}
          {/* Structure Diagram for exotic objects */}
          {blackHoles.some((b) => b.id === bodyToShow) && <BlackHoleDiagram />}
          {wormholes.some((w) => w.id === bodyToShow) && <WormholeDiagram />}
          {/* Close button */}
          <button
            onClick={handleClosePanel}
            className="absolute top-2 right-3 text-white/40 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md z-10"
            aria-label="Close info panel"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Header */}
          <div className="relative px-4 py-3 overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `radial-gradient(ellipse at 20% 50%, ${color}, transparent 70%)`,
              }}
            />
            {/* Pulsing glow ring behind the orb */}
            <div
              className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full animate-planet-orb-glow"
              style={{ backgroundColor: color, left: '16px', transform: 'translateY(-50%)' }}
            />
            <div className="flex items-center gap-3 relative">
              <div
                className="w-12 h-12 rounded-full shadow-lg flex-shrink-0 border border-white/10 animate-planet-orb-rotate"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${color}, ${color}88, ${color}44)`,
                  boxShadow: `0 0 30px ${color}40, inset 0 -2px 8px ${color}50`,
                }}
              />
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">{info.name}</h3>
                <Badge
                  variant="outline"
                  className="text-[8px] px-1.5 py-0 border-white/20 font-normal mt-0.5"
                  style={{ borderColor: `${typeColor}40`, color: `${typeColor}CC` }}
                >
                  {info.type}
                </Badge>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-3">
              {diameter > 0 && (
                <div className="pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/30 flex-shrink-0">Size vs Earth</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full animate-orbit-progress-fill transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (diameter / 12756) * 3)}%`,
                          background: `linear-gradient(90deg, ${color}60, ${color})`,
                          boxShadow: `0 0 8px ${color}50`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-white/40 font-mono">
                      {(diameter / 12756).toFixed(1)}x
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {Object.entries(info.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                    <span className="text-[10px] text-white/35"><PhysicsTooltip term={key} /></span>
                    <span className="text-[10px] text-white/75 font-medium text-right max-w-[55%]">
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </span>
                  </div>
                ))}
              </div>
              {info.funFacts.length > 0 && (
                <>
                  <div className="section-divider" />
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] text-amber-400/70 font-bold uppercase tracking-widest">
                      Fun Facts
                    </h4>
                    {info.funFacts.map((fact, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="w-1 h-1 rounded-full bg-amber-400/40 mt-1.5 flex-shrink-0" />
                        <p className="text-[10px] text-white/45 leading-relaxed">{fact}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-1.5 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-white/15 text-white/50 hover:text-white hover:bg-white/10 text-[10px]"
                  style={{ borderColor: `${color}25` }}
                  onClick={() => setFocusTarget(bodyToShow)}
                >
                  <Rocket className="w-3 h-3 mr-1" />
                  Focus Camera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-emerald-400/20 text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-400/10 text-[10px]"
                  onClick={() => {
                    useSolarSystemStore.getState().setComparisonMode(true)
                    useSolarSystemStore.getState().setComparisonBody2(null)
                    addToast('Entering comparison mode...', <GitCompare className="w-3 h-3 text-emerald-400" />)
                  }}
                >
                  <GitCompare className="w-3 h-3 mr-1" />
                  Compare
                </Button>
              </div>
              <div className="mt-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full text-[10px] ${rulerTarget ? 'border-amber-400/30 text-amber-400 bg-amber-400/10' : 'border-amber-400/20 text-amber-400/60 hover:text-amber-400 hover:bg-amber-400/10'}`}
                  onClick={() => {
                    if (rulerTarget) {
                      setRulerTarget(null)
                      addToast('Distance ruler cleared', <Milestone className="w-3 h-3 text-white/40" />)
                    } else {
                      setRulerTarget(bodyToShow)
                      addToast('Click another body to measure distance', <Milestone className="w-3 h-3 text-amber-400" />)
                    }
                  }}
                >
                  <Milestone className="w-3 h-3 mr-1" />
                  {rulerTarget ? 'Clear Ruler' : 'Measure Distance'}
                </Button>
              </div>
              {planet && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] text-white/30 flex items-center gap-1">
                      <Orbit className="w-2.5 h-2.5" />
                      Orbit Progress
                    </span>
                    <span className="text-[9px] text-white/40 font-mono">
                      {planet.orbitalPeriod.toLocaleString()} days
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full animate-orbit-progress-fill"
                      style={{
                        width: `${((Date.now() / 1000 % planet.orbitalPeriod) / planet.orbitalPeriod * 100)}%`,
                        background: `linear-gradient(90deg, ${color}40, ${color})`,
                        transition: 'width 1s ease-out',
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[8px] text-white/15">Perihelion</span>
                    <span className="text-[8px] text-white/15">Aphelion</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-56 sm:w-72 pointer-events-auto ${animationClass}`}>
      <div className="relative bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        {/* Animated gradient border overlay */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none animate-info-gradient-border opacity-40"
          style={{
            backgroundImage: `linear-gradient(135deg, ${color}40, transparent 30%, transparent 70%, ${color}30)`,
            backgroundSize: '300% 100%',
          }}
        />
        {/* Header with gradient border and animated gradient */}
        <div className="relative px-3 sm:px-4 py-3 overflow-hidden">
          <div
            className="absolute inset-0 opacity-15"
            style={{
              background: `radial-gradient(ellipse at 20% 50%, ${color}, transparent 70%)`,
            }}
          />
          {/* Pulsing glow ring behind the orb */}
          <div
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full animate-planet-orb-glow"
            style={{ backgroundColor: color }}
          />
          <button
            onClick={handleClosePanel}
            className="absolute top-2 right-2 text-white/40 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md z-10"
            aria-label="Close info panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-3 relative">
            {/* Planet orb with orbit diagram */}
            <div className="relative flex-shrink-0">
              {/* Orbit diagram ring — tiny circle representing the body's orbit around the sun */}
              <div className="absolute -inset-2 border border-white/10 rounded-full animate-orbit-diagram-spin">
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
                />
              </div>
              {/* Sun dot at center of orbit diagram */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-yellow-400/60 z-10" />
              {/* Larger planet orb with rotation */}
              <div
                className="w-12 h-12 rounded-full shadow-lg border border-white/10 animate-planet-orb-rotate"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${color}, ${color}88, ${color}44)`,
                  boxShadow: `0 0 30px ${color}40, inset 0 -2px 8px ${color}50`,
                }}
              />
              {/* Sparkle particles around orb */}
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 rounded-full animate-sparkle-float"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 4px ${color}`,
                    left: '50%',
                    top: '50%',
                    '--sx': `${(i % 2 === 0 ? -1 : 1) * (8 + i * 4)}px`,
                    '--sy': `${(i < 2 ? -1 : 1) * (6 + i * 3)}px`,
                    '--duration': `${1.5 + i * 0.4}s`,
                    '--delay': `${i * 0.3}s`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">{info.name}</h3>
              <Badge
                variant="outline"
                className="text-[8px] px-1.5 py-0 border-white/20 font-normal mt-0.5"
                style={{ borderColor: `${typeColor}40`, color: `${typeColor}CC` }}
              >
                {info.type}
              </Badge>
            </div>
          </div>
        </div>
        {/* Gradient border bottom matching planet color */}
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

        {/* Physics Note Badge for exotic objects */}
        {info.physicsNote && (
          <div className="px-3 sm:px-4 py-2">
            <div
              className={`text-[8px] px-2.5 py-1 rounded-md font-medium tracking-wide ${
                blackHoles.some((b) => b.id === bodyToShow)
                  ? 'bg-amber-900/30 text-amber-300/80 border border-amber-500/20'
                  : 'bg-purple-900/30 text-purple-300/80 border border-purple-500/20'
              }`}
            >
              {info.physicsNote}
            </div>
          </div>
        )}

        {/* Structure Diagram for exotic objects */}
        {blackHoles.some((b) => b.id === bodyToShow) && <BlackHoleDiagram />}
        {wormholes.some((w) => w.id === bodyToShow) && <WormholeDiagram />}

        {/* Size comparison bar */}
        {diameter > 0 && (
          <div className="px-3 sm:px-4 py-2 border-b border-white/5 bg-white/3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30 flex-shrink-0">Size vs Earth</span>
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full animate-orbit-progress-fill transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (diameter / 12756) * 3)}%`,
                    background: `linear-gradient(90deg, ${color}60, ${color})`,
                    boxShadow: `0 0 8px ${color}50`,
                  }}
                />
              </div>
              <span className="text-[9px] text-white/40 font-mono">
                {(diameter / 12756).toFixed(1)}x
              </span>
            </div>
          </div>
        )}

        {/* Temperature bar visualization */}
        {planet && (
          <div className="px-3 sm:px-4 py-2 border-b border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-white/30 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" />
                Temperature
              </span>
              <span className="text-[9px] text-white/50 font-mono">{planet.surfaceTemperature}</span>
            </div>
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden animate-temperature-pulse">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(() => {
                    // Parse temperature - map to a percentage
                    const tempStr = planet.surfaceTemperature
                    const matches = tempStr.match(/-?\d+/g)
                    if (!matches || matches.length === 0) return 50
                    const maxTemp = Math.max(...matches.map(Number))
                    // Map: -270°C → 0%, 5500°C → 100%
                    return Math.max(2, Math.min(100, ((maxTemp + 270) / 5770) * 100))
                  })()}%`,
                  background: 'linear-gradient(90deg, #3B82F6, #06B6D4, #22C55E, #EAB308, #F97316, #EF4444)',
                }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[7px] text-blue-400/30">Cold</span>
              <span className="text-[7px] text-red-400/30">Hot</span>
            </div>
          </div>
        )}

        {/* Distance from Earth indicator */}
        {bodyToShow !== 'earth' && bodyToShow !== 'sun' && (
          <div className="px-3 sm:px-4 py-2 border-b border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-white/30 flex items-center gap-1">
                <Navigation className="w-2.5 h-2.5" />
                Distance from Earth
              </span>
              <span className="text-[9px] text-emerald-400/70 font-mono">
                {(() => {
                  const earthDist = 149.6
                  const thisDist = planet?.distanceFromSun || dwarfPlanet?.distanceFromSun || 0
                  if (thisDist === 0) return '—'
                  const dist = Math.abs(thisDist - earthDist)
                  return dist > 1000 ? `${(dist / 1000).toFixed(1)}B km` : `${dist.toFixed(1)}M km`
                })()}
              </span>
            </div>
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full distance-indicator-bar"
                style={{
                  width: `${(() => {
                    const earthDist = 149.6
                    const thisDist = planet?.distanceFromSun || dwarfPlanet?.distanceFromSun || 0
                    if (thisDist === 0) return 10
                    return Math.min(100, (Math.abs(thisDist - earthDist) / 4500) * 100 + 5)
                  })()}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[7px] text-emerald-400/25">Nearby</span>
              <span className="text-[7px] text-red-400/25">Far</span>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-80">
          <div className="p-3 sm:p-4 space-y-3">
            {/* Details */}
            <div className="space-y-1">
              {Object.entries(info.details).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                  <span className="text-[10px] text-white/35"><PhysicsTooltip term={key} /></span>
                  <span className="text-[10px] text-white/75 font-medium text-right max-w-[55%]">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </span>
                </div>
              ))}
            </div>

            {/* Fun Facts — rotating single fact with fade */}
            {info.funFacts.length > 0 && (
              <>
                <div className="section-divider" />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-[9px] text-amber-400/70 font-bold uppercase tracking-widest">
                      Fun Fact
                    </h4>
                    {info.funFacts.length > 1 && (
                      <span className="text-[7px] text-white/20 font-mono">{funFactIndex + 1}/{info.funFacts.length}</span>
                    )}
                  </div>
                  <div className="min-h-[36px] relative animate-fun-fact-glow rounded-lg p-2 -m-2">
                    <div key={funFactKey} className="animate-fun-fact-fade">
                      <div className="flex gap-2">
                        <div className="w-1 h-1 rounded-full bg-amber-400/40 mt-1.5 flex-shrink-0" />
                        <p className="text-[10px] text-white/45 leading-relaxed">{info.funFacts[funFactIndex]}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Action buttons — more visually distinct */}
            <div className="space-y-1.5 mt-2">
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-gradient-to-br from-amber-500/8 to-orange-500/5 border-amber-400/20 text-amber-300/80 hover:text-amber-300 hover:bg-amber-500/15 hover:border-amber-400/40 text-[10px] shadow-[0_0_6px_rgba(251,191,36,0.05)] hover:shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                  onClick={() => setFocusTarget(bodyToShow)}
                >
                  <Rocket className="w-3 h-3 mr-1" />
                  Focus Camera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-gradient-to-br from-emerald-500/8 to-teal-500/5 border-emerald-400/20 text-emerald-300/80 hover:text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-400/40 text-[10px] shadow-[0_0_6px_rgba(52,211,153,0.05)] hover:shadow-[0_0_12px_rgba(52,211,153,0.15)]"
                  onClick={() => {
                    useSolarSystemStore.getState().setComparisonMode(true)
                    useSolarSystemStore.getState().setComparisonBody2(null)
                    addToast('Entering comparison mode...', <GitCompare className="w-3 h-3 text-emerald-400" />)
                  }}
                >
                  <GitCompare className="w-3 h-3 mr-1" />
                  Compare
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={`w-full text-[10px] ${rulerTarget ? 'bg-gradient-to-br from-rose-500/10 to-orange-500/5 border-rose-400/30 text-rose-300 shadow-[0_0_8px_rgba(251,113,133,0.1)]' : 'bg-gradient-to-br from-rose-500/5 to-orange-500/3 border-rose-400/15 text-rose-300/60 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-400/30'}`}
                onClick={() => {
                  if (rulerTarget) {
                    setRulerTarget(null)
                    addToast('Distance ruler cleared', <Milestone className="w-3 h-3 text-white/40" />)
                  } else {
                    setRulerTarget(bodyToShow)
                    addToast('Click another body to measure distance', <Milestone className="w-3 h-3 text-amber-400" />)
                  }
                }}
              >
                <Milestone className="w-3 h-3 mr-1" />
                {rulerTarget ? 'Clear Ruler' : 'Measure Distance'}
              </Button>
            </div>

            {/* Orbit progress indicator for planets */}
            {planet && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] text-white/30 flex items-center gap-1">
                    <Orbit className="w-2.5 h-2.5" />
                    Orbit Progress
                  </span>
                  <span className="text-[9px] text-white/40 font-mono">
                    {planet.orbitalPeriod.toLocaleString()} days
                  </span>
                </div>
                <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full animate-orbit-progress-fill"
                    style={{
                      width: `${((Date.now() / 1000 % planet.orbitalPeriod) / planet.orbitalPeriod * 100)}%`,
                      background: `linear-gradient(90deg, ${color}40, ${color})`,
                      transition: 'width 1s ease-out',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[8px] text-white/15">Perihelion</span>
                  <span className="text-[8px] text-white/15">Aphelion</span>
                </div>
              </div>
            )}

            {/* Moon list for planets with moons */}
            {planet && planet.moons.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-white/30 flex items-center gap-1">
                    <Orbit className="w-2.5 h-2.5" />
                    Known Moons ({planet.numberOfMoons})
                  </span>
                  {planet.numberOfMoons > planet.moons.length && (
                    <span className="text-[7px] text-white/15 font-mono">showing {planet.moons.length} major</span>
                  )}
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {planet.moons.map((moon) => (
                    <div
                      key={moon.name}
                      className="moon-item flex items-center gap-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-white/10"
                        style={{
                          backgroundColor: moon.color,
                          boxShadow: `0 0 4px ${moon.color}40`,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/60 font-medium truncate">{moon.name}</span>
                          <span className="text-[7px] text-white/20 font-mono ml-1 flex-shrink-0">{moon.diameter.toLocaleString()} km</span>
                        </div>
                        <p className="text-[7px] text-white/20 truncate">{moon.funFact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

/* ──────────────────────── Minimap ──────────────────────── */

function Minimap() {
  const isMobile = useIsMobile()
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const setFocusTarget = useSolarSystemStore((s) => s.setFocusTarget)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)

  const handleSelect = (id: string) => {
    setFocusTarget(id)
    setSelectedBody(id)
  }

  if (screenshotMode) return null

  // On mobile, show only Sun + 4 inner planets
  const mobilePlanets = planets.slice(0, 4) // Mercury, Venus, Earth, Mars
  const visiblePlanets = isMobile ? mobilePlanets : planets

  // Starfield dots for minimap background
  const minimapStars = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (i * 31 + 5) % 100,
    y: (i * 47 + 3) % 100,
    size: (i % 4 === 0) ? 1 : 0.5,
    delay: (i % 6) * 0.8,
  }))

  // Orbit distance indicator lines
  const orbitLines = visiblePlanets.map((p, i) => ({
    id: p.id,
    position: ((i + 1) / (visiblePlanets.length + 1)) * 100,
  }))

  return (
    <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      {/* Aurora/glow effect above the minimap */}
      <div className="relative">
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full animate-aurora-shimmer pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 100%, rgba(52,211,153,0.15) 0%, rgba(34,211,238,0.08) 40%, transparent 70%)',
            filter: 'blur(6px)',
          }}
        />

        <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl px-2 sm:px-5 py-1.5 sm:py-3 shadow-xl shadow-black/30 relative overflow-hidden">
          {/* Subtle starfield pattern in background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {minimapStars.map((s) => (
              <div
                key={s.id}
                className="absolute rounded-full bg-white/20"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  animation: `starfield-twinkle ${2 + (s.id % 3)}s ease-in-out infinite`,
                  animationDelay: `${s.delay}s`,
                }}
              />
            ))}
            {/* Scanning line animation */}
            <div className="absolute top-0 bottom-0 w-8 pointer-events-none animate-scan-line">
              <div className="w-full h-full bg-gradient-to-r from-transparent via-amber-400/10 to-transparent" />
            </div>
          </div>

          <div className="h-[1px] bg-gradient-to-r from-transparent via-amber-400/20 to-transparent mb-1.5 sm:mb-2" />
          <div className={`relative ${isMobile ? 'w-40 h-4' : 'w-56 sm:w-96 h-5 sm:h-6'} flex items-center gap-0.5`}>
            {/* SOL label - hidden on mobile */}
            <span className="text-[7px] text-white/15 font-medium tracking-wider uppercase mr-1 hidden sm:block flex-shrink-0">SOL</span>
            {/* Sun indicator with glow ring */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 rounded-full bg-yellow-400/15 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute -inset-1 rounded-full bg-yellow-400/20 blur-sm animate-pulse" />
              <button
                onClick={() => handleSelect('sun')}
                className={`relative ${isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'} rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 hover:scale-150 transition-transform shadow-md shadow-yellow-400/30 ${selectedBody === 'sun' ? 'ring-2 ring-yellow-300/60 scale-125' : ''}`}
                title="Sun"
              />
            </div>
            {/* Planets */}
            <div className="flex-1 relative flex items-center justify-around">
              {/* Orbit distance indicator lines (ruler lines) */}
              {orbitLines.map((ol) => (
                <div
                  key={`ruler-${ol.id}`}
                  className="absolute top-1/2 -translate-y-1/2 w-[1px] bg-white/[0.04] pointer-events-none"
                  style={{
                    left: `${ol.position}%`,
                    height: '60%',
                  }}
                />
              ))}
              {visiblePlanets.map((p) => {
                const scale = isMobile ? Math.max(0.15, p.radius / 2) : Math.max(0.2, p.radius / 1.5)
                const isSelected = selectedBody === p.id
                return (
                  <div key={p.id} className="relative flex-shrink-0 group z-10">
                    {/* More prominent pulse for selected planet */}
                    {isSelected && (
                      <div
                        className="absolute inset-0 rounded-full animate-prominent-pulse"
                        style={{
                          width: `${scale * 14 + 12}px`,
                          height: `${scale * 14 + 12}px`,
                          minWidth: '13px',
                          minHeight: '13px',
                          left: '-6px',
                          top: '-6px',
                          backgroundColor: p.color,
                        }}
                      />
                    )}
                    <button
                      onClick={() => handleSelect(p.id)}
                      className="rounded-full hover:scale-150 transition-all flex-shrink-0 relative"
                      style={{
                        width: `${scale * 14}px`,
                        height: `${scale * 14}px`,
                        minWidth: isMobile ? '4px' : '5px',
                        minHeight: isMobile ? '4px' : '5px',
                        backgroundColor: p.color,
                        boxShadow: isSelected
                          ? `0 0 10px ${p.color}, 0 0 20px ${p.color}50`
                          : `0 0 4px ${p.color}30`,
                        transform: isSelected ? 'scale(1.3)' : undefined,
                      }}
                      title={p.name}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white/70 text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {p.name}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
            {/* Dwarf planets — hidden on mobile */}
            {!isMobile && (
              <div className="flex items-center gap-0.5 ml-1 border-l border-white/10 pl-1 relative z-10">
                {dwarfPlanets.slice(0, 4).map((dp) => {
                  const isSelected = selectedBody === dp.id
                  return (
                    <div key={dp.id} className="relative group">
                      {isSelected && (
                        <div
                          className="absolute rounded-full animate-prominent-pulse"
                          style={{
                            width: '15px',
                            height: '15px',
                            left: '-5px',
                            top: '-5px',
                            backgroundColor: dp.color,
                          }}
                        />
                      )}
                      <button
                        onClick={() => handleSelect(dp.id)}
                        className="rounded-full hover:scale-150 transition-all flex-shrink-0 relative"
                        style={{
                          width: '5px',
                          height: '5px',
                          minWidth: '4px',
                          minHeight: '4px',
                          backgroundColor: dp.color,
                          boxShadow: isSelected
                            ? `0 0 6px ${dp.color}`
                            : `0 0 2px ${dp.color}20`,
                          transform: isSelected ? 'scale(1.5)' : undefined,
                          opacity: isSelected ? 1 : 0.6,
                        }}
                        title={dp.name}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white/70 text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {dp.name}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Interstellar objects & Centaurs — hidden on mobile */}
            {!isMobile && (
              <div className="flex items-center gap-0.5 ml-1 border-l border-white/10 pl-1 relative z-10">
                {interstellarObjects.map((o) => {
                  const isSelected = selectedBody === o.id
                  return (
                    <div key={o.id} className="relative group">
                      {isSelected && (
                        <div
                          className="absolute rounded-full animate-prominent-pulse"
                          style={{
                            width: '13px',
                            height: '13px',
                            left: '-4px',
                            top: '-4px',
                            backgroundColor: o.color,
                          }}
                        />
                      )}
                      <button
                        onClick={() => handleSelect(o.id)}
                        className="rounded-full hover:scale-150 transition-all flex-shrink-0 relative"
                        style={{
                          width: '4px',
                          height: '4px',
                          minWidth: '3px',
                          minHeight: '3px',
                          backgroundColor: o.color,
                          boxShadow: isSelected
                            ? `0 0 6px ${o.color}`
                            : `0 0 2px ${o.color}20`,
                          transform: isSelected ? 'scale(1.5)' : undefined,
                          opacity: isSelected ? 1 : 0.5,
                        }}
                        title={o.name}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white/70 text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {o.name}
                        </span>
                      </button>
                    </div>
                  )
                })}
                {centaurs.map((c) => {
                  const isSelected = selectedBody === c.id
                  return (
                    <div key={c.id} className="relative group">
                      {isSelected && (
                        <div
                          className="absolute rounded-full animate-prominent-pulse"
                          style={{
                            width: '13px',
                            height: '13px',
                            left: '-4px',
                            top: '-4px',
                            backgroundColor: c.color,
                          }}
                        />
                      )}
                      <button
                        onClick={() => handleSelect(c.id)}
                        className="rounded-full hover:scale-150 transition-all flex-shrink-0 relative"
                        style={{
                          width: '4px',
                          height: '4px',
                          minWidth: '3px',
                          minHeight: '3px',
                          backgroundColor: c.color,
                          boxShadow: isSelected
                            ? `0 0 6px ${c.color}`
                            : `0 0 2px ${c.color}20`,
                          transform: isSelected ? 'scale(1.5)' : undefined,
                          opacity: isSelected ? 1 : 0.5,
                        }}
                        title={c.name}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white/70 text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {c.name}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── TourOverlay ──────────────────────── */

function TourOverlay() {
  const isTourMode = useSolarSystemStore((s) => s.isTourMode)
  const tourStep = useSolarSystemStore((s) => s.tourStep)
  const stopTour = useSolarSystemStore((s) => s.stopTour)
  const nextTourStep = useSolarSystemStore((s) => s.nextTourStep)
  const prevTourStep = useSolarSystemStore((s) => s.prevTourStep)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)

  if (!isTourMode || screenshotMode) return null

  const step = TOUR_STEPS[tourStep]
  if (!step) return null

  return (
    <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-30 w-[90vw] max-w-lg">
      <div className="bg-black/80 backdrop-blur-xl border border-amber-400/20 rounded-xl overflow-hidden shadow-2xl">
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
            style={{ width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Footprints className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-amber-400/70 font-bold uppercase tracking-widest">
                  Guided Tour — {tourStep + 1} / {TOUR_STEPS.length}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">{step.title}</h3>
            </div>
            <button
              onClick={stopTour}
              className="text-white/30 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors"
              aria-label="Exit tour"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-white/60 leading-relaxed mb-3">
            {step.description}
          </p>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white/50 hover:text-white hover:bg-white/10 text-[11px]"
              onClick={prevTourStep}
              disabled={tourStep === 0}
            >
              <SkipBack className="w-3 h-3 mr-1" />
              Previous
            </Button>
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === tourStep ? 'bg-amber-400 scale-125' : i < tourStep ? 'bg-amber-400/40' : 'bg-white/15'
                  }`}
                />
              ))}
            </div>
            {tourStep < TOUR_STEPS.length - 1 ? (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400/25 text-amber-400/80 hover:text-amber-400 hover:bg-amber-400/10 text-[11px]"
                onClick={nextTourStep}
              >
                Next
                <SkipForward className="w-3 h-3 ml-1" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-400/25 text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-400/10 text-[11px]"
                onClick={stopTour}
              >
                Finish Tour
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── SizeComparisonOverlay ──────────────────────── */

function SizeComparisonOverlay() {
  const showSizeComparison = useSolarSystemStore((s) => s.showSizeComparison)
  const setShowSizeComparison = useSolarSystemStore((s) => s.setShowSizeComparison)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)

  if (!showSizeComparison) return null

  const allBodies = [
    { name: 'Sun', diameter: 1392700, color: '#FDB813' },
    ...planets.map((p) => ({ name: p.name, diameter: p.diameter, color: p.color })),
    ...dwarfPlanets.map((d) => ({ name: d.name, diameter: d.diameter, color: d.color })),
    ...scatteredDiscObjects.map((s) => ({ name: s.name, diameter: s.diameter, color: s.color })),
    ...centaurs.map((c) => ({ name: c.name, diameter: c.diameter, color: c.color })),
  ].sort((a, b) => b.diameter - a.diameter)

  const maxDiameter = allBodies[0].diameter

  return (
    <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl w-[90vw] max-w-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
              <Ruler className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-white">Size Comparison</span>
          </div>
          <button
            onClick={() => setShowSizeComparison(false)}
            className="text-white/40 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors"
            aria-label="Close size comparison"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 space-y-2.5">
            {allBodies.map((body) => {
              const barWidth = Math.max(2, (body.diameter / maxDiameter) * 100)
              const isSelected = selectedBody && (
                (body.name === 'Sun' && selectedBody === 'sun') ||
                planets.some((p) => p.id === selectedBody && p.name === body.name)
              )
              return (
                <div key={body.name} className="flex items-center gap-3">
                  <span className={`text-[11px] w-16 text-right flex-shrink-0 ${isSelected ? 'text-white font-bold' : 'text-white/50'}`}>
                    {body.name}
                  </span>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${body.color}60, ${body.color})`,
                        boxShadow: isSelected ? `0 0 10px ${body.color}60` : undefined,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono w-24 text-right flex-shrink-0">
                    {body.diameter.toLocaleString()} km
                  </span>
                </div>
              )
            })}
          </div>
        </ScrollArea>
        <div className="px-4 py-2 border-t border-white/5 text-center">
          <p className="text-[9px] text-white/25">
            Diameters shown at relative scale. The Sun is {Math.round(1392700 / 12756)}x larger than Earth.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── CelestialEventBanner ──────────────────────── */

function CelestialEventBanner() {
  const activeEvent = useSolarSystemStore((s) => s.activeEvent)
  const dismissEvent = useSolarSystemStore((s) => s.dismissEvent)
  const setFocusTarget = useSolarSystemStore((s) => s.setFocusTarget)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)

  useEffect(() => {
    if (!activeEvent) return
    const timer = setTimeout(() => {
      dismissEvent()
    }, 8000)
    return () => clearTimeout(timer)
  }, [activeEvent, dismissEvent])

  if (!activeEvent || screenshotMode) return null

  // Color based on event type
  const eventTypeColors: Record<string, { gradient: string; glow: string; border: string }> = {
    conjunction: { gradient: 'from-purple-400 to-pink-500', glow: 'rgba(168,85,247,0.25)', border: 'rgba(168,85,247,0.3)' },
    eclipse: { gradient: 'from-red-400 to-orange-500', glow: 'rgba(239,68,68,0.25)', border: 'rgba(239,68,68,0.3)' },
    meteor: { gradient: 'from-emerald-400 to-teal-500', glow: 'rgba(52,211,153,0.25)', border: 'rgba(52,211,153,0.3)' },
    discovery: { gradient: 'from-amber-400 to-orange-500', glow: 'rgba(251,191,36,0.25)', border: 'rgba(251,191,36,0.3)' },
    anniversary: { gradient: 'from-cyan-400 to-emerald-500', glow: 'rgba(34,211,238,0.25)', border: 'rgba(34,211,238,0.3)' },
  }
  const eventStyle = eventTypeColors[activeEvent.type] || eventTypeColors.discovery

  // Sparkle particles behind the banner
  const sparkles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: 10 + (i * 12) % 80,
    top: 20 + (i * 17) % 60,
    delay: i * 0.2,
    size: 2 + (i % 3),
  }))

  return (
    <div className="absolute top-12 sm:top-14 right-2 sm:right-4 z-15 pointer-events-auto w-64 sm:w-72 animate-slide-in-right">
      <div
        className="bg-black/75 backdrop-blur-xl border rounded-xl overflow-hidden shadow-2xl animate-subtle-glow-pulse relative"
        style={{ borderColor: eventStyle.border, boxShadow: `0 0 16px ${eventStyle.glow}` }}
      >
        {/* Sparkle particles behind text */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {sparkles.map((sp) => (
            <div
              key={sp.id}
              className="absolute rounded-full bg-white/60 animate-sparkle-twinkle"
              style={{
                left: `${sp.left}%`,
                top: `${sp.top}%`,
                width: `${sp.size}px`,
                height: `${sp.size}px`,
                animationDelay: `${sp.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Progress bar for auto-dismiss — gradient matching event type */}
        <div className="h-[2px] bg-white/5">
          <div
            className={`h-full bg-gradient-to-r ${eventStyle.gradient}`}
            style={{
              animation: 'shrink 8s linear forwards',
            }}
          />
        </div>
        <div className="p-2.5 sm:p-3 relative">
          <div className="flex items-start gap-2.5">
            {/* Larger event icon */}
            <div className="text-2xl flex-shrink-0 leading-none">{activeEvent.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Bell className="w-2.5 h-2.5 text-amber-400/70" />
                <span className="text-[8px] text-amber-400/70 font-bold uppercase tracking-widest">
                  Celestial Event
                </span>
              </div>
              <h3 className="text-[11px] font-bold text-white mb-0.5">{activeEvent.title}</h3>
              <p className="text-[9px] text-white/45 leading-relaxed line-clamp-2">{activeEvent.description}</p>
            </div>
            <button
              onClick={dismissEvent}
              className="text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-1 rounded-md transition-colors flex-shrink-0 border border-white/10"
              aria-label="Dismiss event"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {activeEvent.relatedBody && (
            <button
              onClick={() => {
                setFocusTarget(activeEvent.relatedBody)
                setSelectedBody(activeEvent.relatedBody)
                dismissEvent()
              }}
              className="mt-2 flex items-center gap-1.5 text-[9px] text-amber-400/70 hover:text-amber-400 transition-colors group"
            >
              <Navigation className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
              <span>Navigate to related body</span>
              <ChevronRightIcon className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ animation: 'arrow-bounce 0.5s ease-in-out infinite' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── DistanceScaleOverlay ──────────────────────── */

function DistanceScaleOverlay() {
  const showDistanceScale = useSolarSystemStore((s) => s.showDistanceScale)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)

  if (!showDistanceScale || !selectedBody) return null

  const planet = planets.find((p) => p.id === selectedBody)
  if (!planet) return null

  return (
    <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg px-3 py-1.5 shadow-xl">
        <div className="flex items-center gap-2">
          <Map className="w-3 h-3 text-white/40" />
          <span className="text-[10px] text-white/50 font-mono">
            {planet.name} — {planet.distanceFromSun} M km from Sun
          </span>
          <Separator orientation="vertical" className="h-3 bg-white/15" />
          <span className="text-[10px] text-white/40 font-mono">
            Light: {(planet.distanceFromSun * 1000000 / 299792.458 / 60).toFixed(1)} min
          </span>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── Toast system ──────────────────────── */

interface Toast {
  id: number
  message: string
  icon: React.ReactNode
}

let toastId = 0
const toastListeners: ((toasts: Toast[]) => void)[] = []
let currentToasts: Toast[] = []

function PlanetComparisonOverlay() {
  const comparisonMode = useSolarSystemStore((s) => s.comparisonMode)
  const setComparisonMode = useSolarSystemStore((s) => s.setComparisonMode)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const comparisonBody2 = useSolarSystemStore((s) => s.comparisonBody2)
  const setComparisonBody2 = useSolarSystemStore((s) => s.setComparisonBody2)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)

  const [body2Select, setBody2Select] = useState<string>('')

  if (screenshotMode || !comparisonMode) return null

  const body1Id = selectedBody
  if (!body1Id) {
    setComparisonMode(false)
    return null
  }

  const body1Info = getBodyInfo(body1Id)
  const body2Id = comparisonBody2 || body2Select || null
  const body2Info = body2Id ? getBodyInfo(body2Id) : null

  const body1Planet = planets.find((p) => p.id === body1Id)
  const body1Dwarf = dwarfPlanets.find((d) => d.id === body1Id)
  const body1Comet = comets.find((c) => c.id === body1Id)
  const body1Color = body1Id === 'sun' ? '#FDB813' : (body1Planet?.color || body1Dwarf?.color || body1Comet?.tailColor || '#888888')

  const body2Planet = body2Id ? planets.find((p) => p.id === body2Id) : null
  const body2Dwarf = body2Id ? dwarfPlanets.find((d) => d.id === body2Id) : null
  const body2Comet = body2Id ? comets.find((c) => c.id === body2Id) : null
  const body2Color = body2Id === 'sun' ? '#FDB813' : (body2Planet?.color || body2Dwarf?.color || body2Comet?.tailColor || '#888888')

  const getBodyStats = (id: string) => {
    const planet = planets.find((p) => p.id === id)
    const dwarf = dwarfPlanets.find((d) => d.id === id)
    const comet = comets.find((c) => c.id === id)

    if (id === 'sun') {
      return {
        diameter: sunData.diameter,
        distanceFromSun: 0,
        orbitalPeriod: 0,
        numberOfMoons: 0,
        gravity: 274,
        temperature: 5500,
      }
    }
    if (planet) {
      return {
        diameter: planet.diameter,
        distanceFromSun: planet.distanceFromSun,
        orbitalPeriod: planet.orbitalPeriod,
        numberOfMoons: planet.numberOfMoons,
        gravity: parseFloat(planet.surfaceGravity) || 0,
        temperature: parseInt(planet.surfaceTemperature.replace(/[^\d-]/g, '')) || 0,
      }
    }
    if (dwarf) {
      return {
        diameter: dwarf.diameter,
        distanceFromSun: dwarf.distanceFromSun,
        orbitalPeriod: dwarf.orbitalPeriod,
        numberOfMoons: 0,
        gravity: 0,
        temperature: -230,
      }
    }
    if (comet) {
      return {
        diameter: comet.diameter,
        distanceFromSun: 0,
        orbitalPeriod: comet.orbitalPeriod,
        numberOfMoons: 0,
        gravity: 0,
        temperature: -270,
      }
    }
    return null
  }

  const stats1 = getBodyStats(body1Id)
  const stats2 = body2Id ? getBodyStats(body2Id) : null

  const comparableMetrics = [
    { key: 'diameter', label: 'Diameter', unit: 'km' },
    { key: 'distanceFromSun', label: 'Distance from Sun', unit: 'M km' },
    { key: 'orbitalPeriod', label: 'Orbital Period', unit: 'days' },
    { key: 'numberOfMoons', label: 'Known Moons', unit: '' },
    { key: 'gravity', label: 'Gravity', unit: 'm/s²' },
    { key: 'temperature', label: 'Temperature', unit: '°C' },
  ]

  const handleSelectBody2 = (id: string) => {
    setBody2Select(id)
    setComparisonBody2(id)
  }

  const allBodies = [
    { id: 'sun', name: 'Sun', color: '#FDB813' },
    ...planets.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    ...dwarfPlanets.map((d) => ({ id: d.id, name: d.name, color: d.color })),
    ...interstellarObjects.map((o) => ({ id: o.id, name: o.name, color: o.color })),
    ...centaurs.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    ...scatteredDiscObjects.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    ...comets.map((c) => ({ id: c.id, name: c.name, color: c.tailColor })),
  ]

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <GitCompare className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-white">Planet Comparison</span>
          </div>
          <button
            onClick={() => {
              setComparisonMode(false)
              setComparisonBody2(null)
              setBody2Select('')
            }}
            className="text-white/40 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md"
            aria-label="Close comparison"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-0 border-b border-white/5">
          <div className="px-4 py-3 border-r border-white/5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full shadow-lg flex-shrink-0 border border-white/10"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${body1Color}, ${body1Color}88, ${body1Color}44)`,
                  boxShadow: `0 0 16px ${body1Color}40`,
                }}
              />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">{body1Info?.name || body1Id}</h4>
                <span className="text-[9px] text-white/40">{body1Info?.type || ''}</span>
              </div>
            </div>
          </div>
          <div className="px-4 py-3">
            {body2Info ? (
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full shadow-lg flex-shrink-0 border border-white/10"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${body2Color}, ${body2Color}88, ${body2Color}44)`,
                    boxShadow: `0 0 16px ${body2Color}40`,
                  }}
                />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">{body2Info.name}</h4>
                  <span className="text-[9px] text-white/40">{body2Info.type}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/30">Select a body to compare:</span>
                <select
                  value={body2Select}
                  onChange={(e) => handleSelectBody2(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/70 focus:outline-none focus:border-emerald-400/30"
                >
                  <option value="">Choose...</option>
                  {allBodies
                    .filter((b) => b.id !== body1Id)
                    .map((b) => (
                      <option key={b.id} value={b.id} className="bg-black text-white">
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {body2Info && (
              <button
                onClick={() => {
                  setComparisonBody2(null)
                  setBody2Select('')
                }}
                className="text-[8px] text-white/30 hover:text-white/60 transition-colors mt-1"
              >
                Change selection
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[55vh]">
          <div className="p-4 space-y-3">
            {stats1 && stats2 && comparableMetrics.map((metric) => {
              const val1 = stats1[metric.key as keyof typeof stats1] as number
              const val2 = stats2[metric.key as keyof typeof stats2] as number
              const maxVal = Math.max(Math.abs(val1), Math.abs(val2), 1)
              const pct1 = Math.min(100, (Math.abs(val1) / maxVal) * 100)
              const pct2 = Math.min(100, (Math.abs(val2) / maxVal) * 100)

              return (
                <div key={metric.key} className="space-y-1">
                  <span className="text-[10px] text-white/40 font-medium">{metric.label}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct1}%`,
                              background: `linear-gradient(90deg, ${body1Color}80, ${body1Color})`,
                              boxShadow: `0 0 6px ${body1Color}40`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-white/50 font-mono min-w-[50px] text-right">
                          {val1.toLocaleString()}{metric.unit ? ` ${metric.unit}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct2}%`,
                              background: `linear-gradient(90deg, ${body2Color}80, ${body2Color})`,
                              boxShadow: `0 0 6px ${body2Color}40`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-white/50 font-mono min-w-[50px] text-right">
                          {val2.toLocaleString()}{metric.unit ? ` ${metric.unit}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {!stats2 && (
              <div className="text-center py-8">
                <GitCompare className="w-8 h-8 text-white/15 mx-auto mb-3" />
                <p className="text-xs text-white/30">Select a second body to see the comparison</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function addToast(message: string, icon: React.ReactNode) {
  const id = ++toastId
  currentToasts = [...currentToasts, { id, message, icon }]
  toastListeners.forEach((l) => l(currentToasts))
  setTimeout(() => {
    currentToasts = currentToasts.filter((t) => t.id !== id)
    toastListeners.forEach((l) => l(currentToasts))
  }, 2500)
}

function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)

  useEffect(() => {
    toastListeners.push(setToasts)
    return () => {
      const idx = toastListeners.indexOf(setToasts)
      if (idx >= 0) toastListeners.splice(idx, 1)
    }
  }, [])

  if (screenshotMode) return null

  return (
    <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast, i) => (
        <div
          key={toast.id}
          className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg px-4 py-2 shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-300"
          style={{ opacity: 1 - i * 0.15, transform: `translateY(${i * 4}px)` }}
        >
          {toast.icon}
          <span className="text-[11px] text-white/80 font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  )
}

/* ──────────────────────── Speed Presets Bar ──────────────────────── */

function SpeedPresetsBar() {
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const setTimeSpeed = useSolarSystemStore((s) => s.setTimeSpeed)
  const isPaused = useSolarSystemStore((s) => s.isPaused)
  const screenshotMode = useSolarSystemStore((s) => s.screenshotMode)

  if (screenshotMode) return null

  const presets = [
    { label: '1x', value: 1 },
    { label: '10x', value: 10 },
    { label: '50x', value: 50 },
    { label: '100x', value: 100 },
  ]

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div className="flex items-center gap-1 bg-black/50 backdrop-blur-xl rounded-full px-2 py-1 border border-white/8 shadow-xl">
        <button
          onClick={() => useSolarSystemStore.getState().togglePause()}
          className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
            isPaused
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-white/5 text-white/40 border border-white/10 hover:text-white hover:bg-white/10'
          }`}
          title={isPaused ? 'Play' : 'Pause'}
        >
          {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        </button>
        <div className="w-[1px] h-4 bg-white/10" />
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setTimeSpeed(preset.value)}
            className={`flex items-center justify-center h-7 px-2.5 rounded-full text-[10px] font-mono font-bold transition-all duration-300 ${
              Math.abs(timeSpeed - preset.value) < 0.1
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(251,191,36,0.15)] animate-preset-glow'
                : 'bg-white/5 text-white/35 border border-white/5 hover:text-white hover:bg-white/10 hover:border-white/15'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <div className="w-[1px] h-4 bg-white/10" />
        {/* Speed waveform visualization */}
        <div className="speed-waveform px-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="speed-waveform-bar"
              style={{
                animation: `waveform-bar ${0.8 + i * 0.15}s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
                transform: isPaused ? 'scaleY(0.15)' : `scaleY(${0.3 + (timeSpeed / 100) * 0.7})`,
                opacity: isPaused ? 0.2 : 0.6 + (timeSpeed / 100) * 0.4,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 px-2">
          <Gauge className="w-2.5 h-2.5 text-white/25" />
          <span className={`text-[9px] font-mono font-bold ${isPaused ? 'text-red-400' : 'text-amber-300/60'}`}>
            {isPaused ? 'PAUSED' : `${timeSpeed.toFixed(1)}x`}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── Exports ──────────────────────── */

export { addToast }

export default function UIOverlay() {
  const setActiveEvent = useSolarSystemStore((s) => s.setActiveEvent)

  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * CELESTIAL_EVENTS.length)
      const event = CELESTIAL_EVENTS[randomIndex]
      setActiveEvent(event)
      addToast(`${event.icon} ${event.title}`, <Bell className="w-3 h-3 text-amber-400" />)
    }, 45000)
    return () => clearInterval(interval)
  }, [setActiveEvent])

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <WelcomeSplash />
      <CelestialEventBanner />
      <ToastContainer />
      <TopBar />
      <ControlsPanel />
      <InfoPanel />
      <Minimap />
      <TourOverlay />
      <SizeComparisonOverlay />
      <DistanceScaleOverlay />
      <PlanetComparisonOverlay />
      <SpaceEventsTimeline />
      <ScreenshotGallery />
      <SpeedPresetsBar />
    </div>
  )
}
