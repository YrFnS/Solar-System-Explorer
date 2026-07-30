'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

export interface SolarExplorerDiagnostics {
  drawCalls: number
  triangles: number
  points: number
  lines: number
  geometries: number
  textures: number
  programs: number
  sceneObjects: number
  visibleObjects: number
  timestamp: number
}

declare global {
  interface Window {
    __SOLAR_EXPLORER_DIAGNOSTICS__?: SolarExplorerDiagnostics
  }
}

/**
 * Exposes low-frequency renderer counters only for automated browsers or an
 * explicit `?diagnostics=1` session. Normal production visitors pay no
 * traversal cost and receive no global debug surface.
 */
export default function RenderDiagnostics() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const elapsedRef = useRef(Number.POSITIVE_INFINITY)
  const enabled = useMemo(() => {
    if (typeof window === 'undefined') return false
    return navigator.webdriver
      || new URLSearchParams(window.location.search).get('diagnostics') === '1'
  }, [])

  useFrame((_, delta) => {
    if (!enabled) return

    elapsedRef.current += delta
    if (elapsedRef.current < 1) return
    elapsedRef.current = 0

    let sceneObjects = 0
    let visibleObjects = 0
    scene.traverse((object) => {
      sceneObjects += 1
      if (object.visible) visibleObjects += 1
    })

    window.__SOLAR_EXPLORER_DIAGNOSTICS__ = {
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      lines: gl.info.render.lines,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
      sceneObjects,
      visibleObjects,
      timestamp: Date.now(),
    }
  })

  useEffect(() => () => {
    delete window.__SOLAR_EXPLORER_DIAGNOSTICS__
  }, [])

  return null
}
