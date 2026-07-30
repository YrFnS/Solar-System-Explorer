'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useSolarSystemStore } from './store'

export const SCREENSHOT_CAPTURE_EVENT = 'solar-explorer:capture'
export const SCREENSHOT_COMPLETE_EVENT = 'solar-explorer:screenshot-complete'

interface ScreenshotResultDetail {
  ok: boolean
  message?: string
}

/**
 * Captures immediately after an explicit renderer pass. This avoids depending
 * on a WebGL drawing buffer that may already have been cleared by the browser.
 */
export default function ScreenshotCaptureBridge() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const addScreenshot = useSolarSystemStore((state) => state.addScreenshot)

  useEffect(() => {
    const complete = (detail: ScreenshotResultDetail) => {
      window.dispatchEvent(new CustomEvent<ScreenshotResultDetail>(SCREENSHOT_COMPLETE_EVENT, { detail }))
    }

    const capture = () => {
      try {
        gl.render(scene, camera)
        const dataUrl = gl.domElement.toDataURL('image/png')
        if (!dataUrl || dataUrl === 'data:,') {
          complete({ ok: false, message: 'The renderer returned an empty image.' })
          return
        }
        addScreenshot(dataUrl)
        complete({ ok: true })
      } catch (error) {
        complete({
          ok: false,
          message: error instanceof Error
            ? error.message
            : 'The WebGL canvas could not be captured.',
        })
      }
    }

    window.addEventListener(SCREENSHOT_CAPTURE_EVENT, capture)
    return () => window.removeEventListener(SCREENSHOT_CAPTURE_EVENT, capture)
  }, [addScreenshot, camera, gl, scene])

  return null
}
