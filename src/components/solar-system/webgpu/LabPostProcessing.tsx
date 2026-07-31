'use client'

import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { useLabPostStore } from './lab-post-store'

export const LAB_POST_SYSTEM_IDS = [
  'tsl-scene-pass',
  'tsl-threshold-bloom',
  'tsl-render-pipeline',
] as const
export const LAB_POST_CONFIGURED_PIPELINES = 1
export const LAB_POST_CONFIGURED_SCENE_PASSES = 1
export const LAB_POST_CONFIGURED_BLOOM_PASSES = 1
export const LAB_POST_STRENGTH = 0.18
export const LAB_POST_RADIUS = 0.16
export const LAB_POST_THRESHOLD = 0.78
export const LAB_POST_SMOOTH_WIDTH = 0.08

export interface LabPostProcessingDiagnostics {
  visualSystems: string[]
  available: true
  enabled: boolean
  pipelineCount: number
  scenePassCount: number
  bloomPassCount: number
  strength: number
  radius: number
  threshold: number
  smoothWidth: number
  renderMode: 'render-pipeline-tsl' | 'direct-render'
  cpuPixelUpdates: false
  screenSpaceDistortion: false
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_LAB_POST__?: LabPostProcessingDiagnostics
  }
}

export default function LabTslPostProcessing() {
  const enabled = useLabPostStore((state) => state.enabled)
  const renderer = useThree((state) => state.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const pipelineState = useMemo(() => {
    if (!enabled) return null

    const scenePass = pass(scene, camera)
    const sceneColor = scenePass.getTextureNode('output')
    const bloomPass = bloom(
      sceneColor,
      LAB_POST_STRENGTH,
      LAB_POST_RADIUS,
      LAB_POST_THRESHOLD
    )
    bloomPass.smoothWidth.value = LAB_POST_SMOOTH_WIDTH

    const renderPipeline = new THREE.RenderPipeline(renderer)
    renderPipeline.outputNode = sceneColor.add(bloomPass)

    return {
      bloomPass,
      renderPipeline,
      scenePass,
    }
  }, [camera, enabled, renderer, scene])

  const diagnostics = useMemo<LabPostProcessingDiagnostics>(() => ({
    visualSystems: [...LAB_POST_SYSTEM_IDS],
    available: true,
    enabled,
    pipelineCount: enabled ? LAB_POST_CONFIGURED_PIPELINES : 0,
    scenePassCount: enabled ? LAB_POST_CONFIGURED_SCENE_PASSES : 0,
    bloomPassCount: enabled ? LAB_POST_CONFIGURED_BLOOM_PASSES : 0,
    strength: LAB_POST_STRENGTH,
    radius: LAB_POST_RADIUS,
    threshold: LAB_POST_THRESHOLD,
    smoothWidth: LAB_POST_SMOOTH_WIDTH,
    renderMode: enabled ? 'render-pipeline-tsl' : 'direct-render',
    cpuPixelUpdates: false,
    screenSpaceDistortion: false,
  }), [enabled])

  useEffect(() => {
    window.__SOLAR_WEBGPU_LAB_POST__ = diagnostics

    return () => {
      if (window.__SOLAR_WEBGPU_LAB_POST__ === diagnostics) {
        delete window.__SOLAR_WEBGPU_LAB_POST__
      }
    }
  }, [diagnostics])

  useEffect(() => () => {
    pipelineState?.bloomPass.dispose()
    pipelineState?.scenePass.dispose()
    pipelineState?.renderPipeline.dispose()
  }, [pipelineState])

  useFrame(() => {
    if (enabled && pipelineState) {
      pipelineState.renderPipeline.render()
      return
    }

    renderer.render(scene, camera)
  }, 1)

  return null
}
