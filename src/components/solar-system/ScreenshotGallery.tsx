'use client'

import { useState } from 'react'
import { useSolarSystemStore } from './store'
import { X, Camera, Trash2, Download, Image as ImageIcon } from 'lucide-react'

export default function ScreenshotGallery() {
  const screenshotGallery = useSolarSystemStore((s) => s.screenshotGallery)
  const clearScreenshots = useSolarSystemStore((s) => s.clearScreenshots)
  const [isOpen, setIsOpen] = useState(false)

  if (screenshotGallery.length === 0 && !isOpen) return null

  return (
    <>
      {/* Gallery toggle button — only shows when there are screenshots */}
      {screenshotGallery.length > 0 && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute right-2 sm:right-4 bottom-16 sm:bottom-20 z-20 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-2 text-white/50 hover:text-white hover:bg-black/70 hover:border-white/20 transition-all shadow-xl pointer-events-auto group"
          title={`View ${screenshotGallery.length} screenshot${screenshotGallery.length > 1 ? 's' : ''}`}
        >
          <div className="relative">
            <Camera className="w-4 h-4" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center">
              {screenshotGallery.length}
            </span>
          </div>
        </button>
      )}

      {/* Gallery modal */}
      {isOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Gallery panel */}
          <div className="relative w-[90vw] max-w-2xl max-h-[80vh] bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up-bottom">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                    <ImageIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">Screenshot Gallery</h2>
                    <p className="text-[8px] text-white/30 uppercase tracking-wider">
                      {screenshotGallery.length} screenshot{screenshotGallery.length !== 1 ? 's' : ''} captured
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {screenshotGallery.length > 0 && (
                    <button
                      onClick={clearScreenshots}
                      className="text-[9px] text-red-400/60 hover:text-red-400 flex items-center gap-1 px-2 py-1 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-white/40 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Gallery grid */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[60vh]">
              {screenshotGallery.length === 0 ? (
                <div className="text-center py-12">
                  <Camera className="w-8 h-8 text-white/15 mx-auto mb-3" />
                  <p className="text-[11px] text-white/30">No screenshots yet</p>
                  <p className="text-[9px] text-white/15 mt-1">Press S to capture a screenshot in screenshot mode</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {screenshotGallery.map((dataUrl, i) => (
                    <div
                      key={i}
                      className="relative group rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all hover:shadow-lg hover:shadow-amber-400/5"
                    >
                      <img
                        src={dataUrl}
                        alt={`Screenshot ${i + 1}`}
                        className="w-full aspect-video object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                        <span className="text-[8px] text-white/60 font-mono">#{i + 1}</span>
                        <a
                          href={dataUrl}
                          download={`solar-system-${i + 1}.png`}
                          className="text-white/70 hover:text-white p-1 bg-black/40 rounded-md hover:bg-black/60 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
