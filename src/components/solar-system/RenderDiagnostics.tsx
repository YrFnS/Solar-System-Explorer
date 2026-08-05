'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  SCENE_LOAD_STAGES,
  useSceneLoadStage,
} from './SceneLoadScheduler'

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
 * explicit `?diagnostics=1` session. Snapshots are withheld while a fresh
 * renderer is still admitting scene stages so comparisons never mix a core
 * frame from one profile with a settled frame from another.
 */
export default function RenderDiagnostics() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const sceneLoadStage = useSceneLoadStage()
  const elapsedRef = useRef(Number.POSITIVE_INFINITY)
  const enabled = useMemo(() => {
    if (typeof window === 'undefined') return false
    return navigator.webdriver
      || new URLSearchParams(window.location.search).get('diagnostics') === '1'
  }, [])
  const sceneSettled = sceneLoadStage >= SCENE_LOAD_STAGES.artifacts

  useEffect(() => {
    if (!sceneSettled) {
      delete window.__SOLAR_EXPLORER_DIAGNOSTICS__
      elapsedRef.current = Number.POSITIVE_INFINITY
    }
  }, [sceneSettled])

  useFrame((_, delta) => {
    if (!enabled || !sceneSettled) return

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
