'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Camera, Check, Images, X } from 'lucide-react'
import {
  SCREENSHOT_CAPTURE_EVENT,
  SCREENSHOT_COMPLETE_EVENT,
} from '../ScreenshotCaptureBridge'
import { useSolarSystemStore } from '../store'

type CaptureState = 'ready' | 'capturing' | 'success' | 'error'

interface ScreenshotResultDetail {
  ok: boolean
  message?: string
}

export default function ScreenshotModeOverlay() {
  const screenshotMode = useSolarSystemStore((state) => state.screenshotMode)
  const screenshotCount = useSolarSystemStore((state) => state.screenshotGallery.length)
  const setScreenshotMode = useSolarSystemStore((state) => state.setScreenshotMode)
  const [captureState, setCaptureState] = useState<CaptureState>('ready')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!screenshotMode) {
      setCaptureState('ready')
      setErrorMessage('')
      return
    }

    const handleComplete = (event: Event) => {
      const result = (event as CustomEvent<ScreenshotResultDetail>).detail
      if (result.ok) {
        setCaptureState('success')
        window.setTimeout(() => setCaptureState('ready'), 1400)
      } else {
        setCaptureState('error')
        setErrorMessage(result.message ?? 'Screenshot capture failed.')
      }
    }

    window.addEventListener(SCREENSHOT_COMPLETE_EVENT, handleComplete)
    return () => window.removeEventListener(SCREENSHOT_COMPLETE_EVENT, handleComplete)
  }, [screenshotMode])

  if (!screenshotMode) return null

  const capture = () => {
    setCaptureState('capturing')
    setErrorMessage('')
    window.dispatchEvent(new Event(SCREENSHOT_CAPTURE_EVENT))
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <div className="absolute inset-0 border-[2px] border-amber-300/25 shadow-[inset_0_0_80px_rgba(251,191,36,0.06)]" />
      <div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(28rem,calc(100vw-1rem))] -translate-x-1/2 rounded-3xl border border-white/12 bg-black/82 p-2 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <div className="hidden min-w-0 flex-1 px-2 sm:block">
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-amber-200/55">Clean capture mode</p>
            <p className="mt-0.5 truncate text-[8px] text-white/28">Only the WebGL scene is saved; interface panels stay out of the image.</p>
          </div>

          <div className="flex flex-1 items-center gap-1.5 sm:flex-none">
            <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] px-2 py-2 text-[8px] text-white/35" title="Saved captures">
              <Images className="h-3.5 w-3.5" /> {screenshotCount}
            </div>
            <button
              type="button"
              onClick={capture}
              disabled={captureState === 'capturing'}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-300 px-4 py-2 text-[9px] font-semibold text-black transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
            >
              {captureState === 'success' ? <Check className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
              {captureState === 'capturing' ? 'Capturing…' : captureState === 'success' ? 'Saved' : 'Capture'}
            </button>
            <button
              type="button"
              onClick={() => setScreenshotMode(false)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05] text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label="Exit screenshot mode"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {captureState === 'error' ? (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.07] px-3 py-2 text-[8px] leading-relaxed text-rose-100/60">
            <AlertCircle className="mt-0.5 h-3 w-3 flex-none" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
