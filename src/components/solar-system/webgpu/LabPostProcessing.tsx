'use client'

import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'

export const LAB_POST_SYSTEM_IDS = [
  'tsl-scene-pass',
  'tsl-threshold-bloom',
  'tsl-render-pipeline',
] as const
export const LAB_POST_PIPELINE_COUNT = 1
export const LAB_POST_SCENE_PASS_COUNT = 1
export const LAB_POST_BLOOM_PASS_COUNT = 1
export const LAB_POST_STRENGTH = 0.18
export const LAB_POST_RADIUS = 0.16
export const LAB_POST_THRESHOLD = 0.78
export const LAB_POST_SMOOTH_WIDTH = 0.08

export interface LabPostProcessingDiagnostics {
  visualSystems: string[]
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

interface LabTslPostProcessingProps {
  enabled: boolean
}

export default function LabTslPostProcessing({
  enabled,
}: LabTslPostProcessingProps) {
  const renderer = useThree((state) => state.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const pipelineState = useMemo(() => {
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
  }, [camera, renderer, scene])

  const diagnostics = useMemo<LabPostProcessingDiagnostics>(() => ({
    visualSystems: [...LAB_POST_SYSTEM_IDS],
    enabled,
    pipelineCount: LAB_POST_PIPELINE_COUNT,
    scenePassCount: LAB_POST_SCENE_PASS_COUNT,
    bloomPassCount: LAB_POST_BLOOM_PASS_COUNT,
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
    pipelineState.bloomPass.dispose()
    pipelineState.scenePass.dispose()
    pipelineState.renderPipeline.dispose()
  }, [pipelineState])

  useFrame(() => {
    if (enabled) {
      pipelineState.renderPipeline.render()
      return
    }

    renderer.render(scene, camera)
  }, 1)

  return null
}
