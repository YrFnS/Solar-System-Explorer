'use client'

import { Bookmark, BookmarkPlus, Focus, Trash2, X } from 'lucide-react'
import { useSolarSystemStore } from '../store'
import { getBodyCatalogEntry } from './body-catalog'

interface BookmarksPanelProps {
  open: boolean
  onClose: () => void
}

export default function BookmarksPanel({ open, onClose }: BookmarksPanelProps) {
  const bookmarks = useSolarSystemStore((state) => state.bookmarks)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const addBookmark = useSolarSystemStore((state) => state.addBookmark)
  const removeBookmark = useSolarSystemStore((state) => state.removeBookmark)
  const loadBookmark = useSolarSystemStore((state) => state.loadBookmark)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)

  if (!open) return null

  const selectedEntry = getBodyCatalogEntry(selectedBody)
  const selectedSaved = bookmarks.some((bookmark) => bookmark.bodyId === selectedBody)

  const openBookmark = (id: string, bodyId: string | null) => {
    loadBookmark(id)
    if (bodyId) {
      setSelectedBody(bodyId)
      setFocusTarget(bodyId)
    }
    onClose()
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:justify-start sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/48 backdrop-blur-sm" onClick={onClose} aria-label="Close bookmarks" />
      <aside className="relative flex max-h-[78vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#080a10]/97 text-white shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:w-[22rem] sm:rounded-3xl">
        <header className="flex items-start justify-between border-b border-white/10 px-4 py-3.5">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-violet-300/65">Local library</p>
            <h2 className="mt-1 text-sm font-semibold">Saved destinations</h2>
            <p className="mt-1 text-[9px] text-white/32">Bookmarks stay in this browser and return the camera to a body.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-white/35 hover:bg-white/10 hover:text-white" aria-label="Close bookmarks">
            <X className="h-4 w-4" />
          </button>
        </header>

        {selectedBody && !selectedSaved ? (
          <div className="border-b border-white/8 p-3">
            <button
              type="button"
              onClick={() => addBookmark(selectedEntry?.name ?? selectedBody, selectedBody)}
              className="flex w-full items-center justify-between rounded-2xl border border-violet-300/12 bg-violet-300/[0.05] px-3 py-2.5 text-left transition hover:bg-violet-300/[0.09]"
            >
              <span>
                <span className="block text-[9px] font-medium text-white/72">Save {selectedEntry?.name ?? selectedBody}</span>
                <span className="mt-0.5 block text-[8px] text-white/28">Add the current destination to this library</span>
              </span>
              <BookmarkPlus className="h-4 w-4 text-violet-200/60" />
            </button>
          </div>
        ) : null}

        <div className="overflow-y-auto overscroll-contain p-3">
          {bookmarks.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bookmark className="mx-auto h-7 w-7 text-white/12" />
              <p className="mt-3 text-[10px] text-white/36">No saved destinations yet</p>
              <p className="mt-1 text-[8px] leading-relaxed text-white/20">Select a body and use Save in the inspector.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...bookmarks].reverse().map((bookmark) => {
                const body = getBodyCatalogEntry(bookmark.bodyId)
                return (
                  <div key={bookmark.id} className="group flex items-center gap-2 rounded-2xl border border-white/6 bg-white/[0.025] p-2 transition hover:border-white/12 hover:bg-white/[0.05]">
                    <button
                      type="button"
                      onClick={() => openBookmark(bookmark.id, bookmark.bodyId)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left"
                    >
                      <span
                        className="h-3 w-3 flex-none rounded-full border border-white/15"
                        style={{ backgroundColor: body?.color ?? '#94a3b8', boxShadow: `0 0 10px ${body?.color ?? '#94a3b8'}55` }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] font-medium text-white/70">{bookmark.name}</span>
                        <span className="mt-0.5 block truncate text-[7px] uppercase tracking-[0.14em] text-white/24">{body?.type ?? 'Saved camera destination'}</span>
                      </span>
                      <Focus className="h-3.5 w-3.5 flex-none text-white/22 transition group-hover:text-violet-200/55" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBookmark(bookmark.id)}
                      className="rounded-xl p-2 text-white/20 transition hover:bg-rose-300/10 hover:text-rose-300/70"
                      aria-label={`Remove ${bookmark.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
