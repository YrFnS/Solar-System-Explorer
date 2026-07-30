'use client'

import { useEffect, useState } from 'react'
import BookmarksPanel from './ui/BookmarksPanel'
import BodyInspector from './ui/BodyInspector'
import ComparisonPanel from './ui/ComparisonPanel'
import DisplaySettingsPanel from './ui/DisplaySettingsPanel'
import ExplorerHeader from './ui/ExplorerHeader'
import FirstRunGuide from './ui/FirstRunGuide'
import NavigatorBar from './ui/NavigatorBar'
import ScreenshotModeOverlay from './ui/ScreenshotModeOverlay'
import SearchPalette from './ui/SearchPalette'
import TourOverlayV4 from './ui/TourOverlayV4'
import ScreenshotGallery from './ScreenshotGallery'
import SpaceEventsTimeline from './SpaceEventsTimeline'
import { useSolarSystemStore } from './store'

export default function UIOverlayV4() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const setShowTimeline = useSolarSystemStore((state) => state.setShowTimeline)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

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
    if (!screenshotMode) return
    setSearchOpen(false)
    setBookmarksOpen(false)
    setSettingsOpen(false)
  }, [screenshotMode])

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

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <BookmarksPanel open={bookmarksOpen} onClose={() => setBookmarksOpen(false)} />
      <DisplaySettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ComparisonPanel onOpenSearch={() => setSearchOpen(true)} />

      <SpaceEventsTimeline />
      <ScreenshotGallery />
      <ScreenshotModeOverlay />
    </div>
  )
}
