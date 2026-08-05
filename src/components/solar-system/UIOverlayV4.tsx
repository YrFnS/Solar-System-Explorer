'use client'

import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import ExplorerHeader from './ui/ExplorerHeader'
import FirstRunGuide from './ui/FirstRunGuide'
import MobileSurfaceCoordinator from './ui/MobileSurfaceCoordinator'
import { useSolarSystemStore } from './store'

const SearchPalette = lazy(() => import('./ui/SearchPalette'))
const BookmarksPanel = lazy(() => import('./ui/BookmarksPanel'))
const DisplaySettingsPanel = lazy(() => import('./ui/DisplaySettingsPanel'))
const ComparisonPanel = lazy(() => import('./ui/ComparisonPanel'))
const SpaceEventsTimeline = lazy(() => import('./SpaceEventsTimeline'))
const ScreenshotGallery = lazy(() => import('./ScreenshotGallery'))
const ScreenshotModeOverlay = lazy(() => import('./ui/ScreenshotModeOverlay'))

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

function OptionalInterface({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}

export default function UIOverlayV4() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [missionControlOpen, setMissionControlOpen] = useState(false)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const screenshotCount = useSolarSystemStore((state) => state.screenshotGallery.length)
  const comparisonMode = useSolarSystemStore((state) => state.comparisonMode)
  const showTimeline = useSolarSystemStore((state) => state.showTimeline)
  const setShowTimeline = useSolarSystemStore((state) => state.setShowTimeline)

  const openSearch = useCallback(() => {
    setMissionControlOpen(false)
    setSearchOpen(true)
  }, [])

  const openBookmarks = useCallback(() => {
    setMissionControlOpen(false)
    setBookmarksOpen(true)
  }, [])

  const openSettings = useCallback(() => {
    setMissionControlOpen(false)
    setSettingsOpen(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openSearch()
        return
      }

      if (typing) return

      if (event.key === '/') {
        event.preventDefault()
        openSearch()
      } else if (event.key.toLowerCase() === 'b') {
        openBookmarks()
      } else if (event.key.toLowerCase() === 'h') {
        setMissionControlOpen(false)
        setShowTimeline(true)
      } else if (event.key === ',') {
        openSettings()
      } else if (event.key === 'Escape') {
        setSearchOpen(false)
        setBookmarksOpen(false)
        setSettingsOpen(false)
        setMissionControlOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openBookmarks, openSearch, openSettings, setShowTimeline])

  useEffect(() => {
    if (comparisonMode || showTimeline || screenshotMode) {
      setMissionControlOpen(false)
    }
  }, [comparisonMode, screenshotMode, showTimeline])

  useEffect(() => {
    const idleWindow = window as IdleWindow
    let idleHandle: number | undefined
    let timeoutHandle: number | undefined

    const prefetchSearch = () => {
      void import('./ui/SearchPalette')
    }

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(prefetchSearch, { timeout: 1800 })
    } else {
      timeoutHandle = window.setTimeout(prefetchSearch, 1200)
    }

    return () => {
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle)
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle)
    }
  }, [])

  if (screenshotMode) {
    return (
      <div className="pointer-events-none absolute inset-0 z-10">
        <OptionalInterface>
          <ScreenshotModeOverlay />
        </OptionalInterface>
      </div>
    )
  }

  const modalOpen = searchOpen
    || bookmarksOpen
    || settingsOpen
    || comparisonMode
    || showTimeline

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <ExplorerHeader
        onOpenSearch={openSearch}
        onOpenBookmarks={openBookmarks}
        onOpenSettings={openSettings}
      />

      <MobileSurfaceCoordinator
        blockedByModal={modalOpen}
        missionControlOpen={missionControlOpen}
        onMissionControlOpenChange={setMissionControlOpen}
        onOpenSearch={openSearch}
      />

      <FirstRunGuide onOpenSearch={openSearch} />

      {searchOpen ? (
        <OptionalInterface>
          <SearchPalette onClose={() => setSearchOpen(false)} />
        </OptionalInterface>
      ) : null}

      {bookmarksOpen ? (
        <OptionalInterface>
          <BookmarksPanel open onClose={() => setBookmarksOpen(false)} />
        </OptionalInterface>
      ) : null}

      {settingsOpen ? (
        <OptionalInterface>
          <DisplaySettingsPanel open onClose={() => setSettingsOpen(false)} />
        </OptionalInterface>
      ) : null}

      {comparisonMode ? (
        <OptionalInterface>
          <ComparisonPanel onOpenSearch={openSearch} />
        </OptionalInterface>
      ) : null}

      {showTimeline ? (
        <OptionalInterface>
          <SpaceEventsTimeline />
        </OptionalInterface>
      ) : null}

      {screenshotCount > 0 ? (
        <OptionalInterface>
          <ScreenshotGallery />
        </OptionalInterface>
      ) : null}
    </div>
  )
}
