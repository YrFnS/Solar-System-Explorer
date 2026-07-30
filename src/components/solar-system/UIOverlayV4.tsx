'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import BodyInspector from './ui/BodyInspector'
import ExplorerHeader from './ui/ExplorerHeader'
import FirstRunGuide from './ui/FirstRunGuide'
import NavigatorBar from './ui/NavigatorBar'
import TourOverlayV4 from './ui/TourOverlayV4'
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
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const screenshotCount = useSolarSystemStore((state) => state.screenshotGallery.length)
  const comparisonMode = useSolarSystemStore((state) => state.comparisonMode)
  const showTimeline = useSolarSystemStore((state) => state.showTimeline)
  const setShowTimeline = useSolarSystemStore((state) => state.setShowTimeline)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        return
      }

      if (typing) return

      if (event.key === '/') {
        event.preventDefault()
        setSearchOpen(true)
      } else if (event.key.toLowerCase() === 'b') {
        setBookmarksOpen(true)
      } else if (event.key.toLowerCase() === 'h') {
        setShowTimeline(true)
      } else if (event.key === ',') {
        setSettingsOpen(true)
      } else if (event.key === 'Escape') {
        setSearchOpen(false)
        setBookmarksOpen(false)
        setSettingsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setShowTimeline])

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

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <ExplorerHeader
        onOpenSearch={() => setSearchOpen(true)}
        onOpenBookmarks={() => setBookmarksOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <NavigatorBar onOpenSearch={() => setSearchOpen(true)} />
      <BodyInspector />
      <TourOverlayV4 />
      <FirstRunGuide onOpenSearch={() => setSearchOpen(true)} />

      {searchOpen ? (
        <OptionalInterface>
          <SearchPalette onClose={() => setSearchOpen(false)} />
        </OptionalInterface>
      ) : null}

      {bookmarksOpen ? (
        <OptionalInterface>
          <BookmarksPanel onClose={() => setBookmarksOpen(false)} />
        </OptionalInterface>
      ) : null}

      {settingsOpen ? (
        <OptionalInterface>
          <DisplaySettingsPanel onClose={() => setSettingsOpen(false)} />
        </OptionalInterface>
      ) : null}

      {comparisonMode ? (
        <OptionalInterface>
          <ComparisonPanel onOpenSearch={() => setSearchOpen(true)} />
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
