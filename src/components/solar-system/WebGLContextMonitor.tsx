'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

export const WEBGL_CONTEXT_LOST_EVENT = 'solar-explorer:webgl-context-lost'
export const WEBGL_CONTEXT_RESTORED_EVENT = 'solar-explorer:webgl-context-restored'

/**
 * Three.js handles most restored-context bookkeeping internally. This bridge
 * adds product-level recovery state and explicitly invalidates demand-rendered
 * scenes after the browser recreates the GPU context.
 */
export default function WebGLContextMonitor() {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    const canvas = gl.domElement

    const handleLost = (event: Event) => {
      event.preventDefault()
      window.dispatchEvent(new Event(WEBGL_CONTEXT_LOST_EVENT))
    }

    const handleRestored = () => {
      gl.resetState()
      invalidate()
      window.dispatchEvent(new Event(WEBGL_CONTEXT_RESTORED_EVENT))
    }

    canvas.addEventListener('webglcontextlost', handleLost, false)
    canvas.addEventListener('webglcontextrestored', handleRestored, false)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost, false)
      canvas.removeEventListener('webglcontextrestored', handleRestored, false)
    }
  }, [gl, invalidate])

  return null
}
