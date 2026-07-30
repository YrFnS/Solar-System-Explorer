'use client'

import { useState } from 'react'
import { Camera, Download, Image as ImageIcon, Trash2, X } from 'lucide-react'
import { useSolarSystemStore } from './store'

function captureExtension(url: string) {
  return url.startsWith('data:image/png') ? 'png' : 'webp'
}

export default function ScreenshotGallery() {
  const screenshotGallery = useSolarSystemStore((state) => state.screenshotGallery)
  const clearScreenshots = useSolarSystemStore((state) => state.clearScreenshots)
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const [isOpen, setIsOpen] = useState(false)

  if ((screenshotGallery.length === 0 && !isOpen) || screenshotMode) return null

  return (
    <>
      {screenshotGallery.length > 0 && !isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto absolute bottom-28 right-2 z-[50] rounded-xl border border-white/10 bg-black/68 p-2 text-white/45 shadow-xl backdrop-blur-xl transition hover:border-white/20 hover:bg-black/80 hover:text-white sm:bottom-20 sm:right-4"
          title={`View ${screenshotGallery.length} screenshot${screenshotGallery.length > 1 ? 's' : ''}`}
          aria-label={`Open screenshot gallery with ${screenshotGallery.length} image${screenshotGallery.length === 1 ? '' : 's'}`}
        >
          <span className="relative block">
            <Camera className="h-4 w-4" />
            <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-amber-300 px-1 text-[7px] font-bold text-black">
              {screenshotGallery.length}
            </span>
          </span>
        </button>
      ) : null}

      {isOpen ? (
        <div className="pointer-events-auto fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/68 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
            aria-label="Close screenshot gallery"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="screenshot-gallery-title"
            className="relative flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/12 bg-[#080a10]/98 text-white shadow-[0_35px_120px_rgba(0,0,0,0.8)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.07]">
                  <ImageIcon className="h-4 w-4 text-amber-200/70" />
                </div>
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-amber-200/50">Local captures</p>
                  <h2 id="screenshot-gallery-title" className="mt-1 text-sm font-semibold text-white/90">Screenshot gallery</h2>
                  <p className="mt-0.5 text-[8px] text-white/28">
                    {screenshotGallery.length} of 12 session captures retained as compressed images
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {screenshotGallery.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearScreenshots}
                    className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-[8px] text-rose-300/55 transition hover:bg-rose-300/10 hover:text-rose-200"
                  >
                    <Trash2 className="h-3 w-3" /> Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-1.5 text-white/35 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close screenshot gallery"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="overflow-y-auto overscroll-contain p-3 sm:p-5">
              {screenshotGallery.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <Camera className="mx-auto h-8 w-8 text-white/12" />
                  <p className="mt-3 text-[10px] text-white/35">No captures remain</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {screenshotGallery.map((imageUrl, index) => (
                    <figure
                      key={`${index}-${imageUrl.slice(-12)}`}
                      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] transition hover:border-white/16"
                    >
                      <img
                        src={imageUrl}
                        alt={`Solar System capture ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="aspect-video w-full object-cover"
                      />
                      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/15 to-transparent p-2 pt-7 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                        <span className="font-mono text-[8px] text-white/48">#{index + 1}</span>
                        <a
                          href={imageUrl}
                          download={`solar-system-${index + 1}.${captureExtension(imageUrl)}`}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-black/55 text-white/65 transition hover:bg-black/80 hover:text-white"
                          aria-label={`Download capture ${index + 1}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
