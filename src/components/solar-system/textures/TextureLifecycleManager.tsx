'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getEffectiveQuality, usePerformanceStore } from '../performance-store'
import { getTextureTierWidth } from './texture-manifest'
import {
  disposeRendererTextureResources,
  setActiveTextureTier,
} from './texture-resource-manager'
import { useTextureRuntimeStore } from './texture-runtime-store'

/**
 * Bridges the React Three Fiber Canvas lifecycle to the texture resource
 * manager. Quality changes start a fresh diagnostic tier, while Canvas teardown
 * terminates the renderer's KTX2 workers and releases every compressed map.
 */
export default function TextureLifecycleManager() {
  const renderer = useThree((state) => state.gl) as THREE.WebGLRenderer
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const beginTier = useTextureRuntimeStore((state) => state.beginTier)
  const tierWidth = getTextureTierWidth(quality)

  useEffect(() => {
    beginTier(quality, tierWidth)
    setActiveTextureTier(quality, tierWidth)
  }, [beginTier, quality, tierWidth])

  useEffect(() => {
    return () => {
      disposeRendererTextureResources(renderer)
    }
  }, [renderer])

  return null
}
