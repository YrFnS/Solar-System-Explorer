'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'

const LOD_DATA_KEY = '__solarExplorerSphereLod'
const UPDATE_INTERVAL_SECONDS = 0.24

interface SphereParameters {
  radius?: number
  widthSegments?: number
  heightSegments?: number
  phiStart?: number
  phiLength?: number
  thetaStart?: number
  thetaLength?: number
}

interface SphereLodData {
  original: THREE.SphereGeometry
  generated: Map<number, THREE.SphereGeometry>
  radius: number
  originalWidthSegments: number
  originalHeightSegments: number
  phiStart: number
  phiLength: number
  thetaStart: number
  thetaLength: number
  currentWidthSegments: number
}

interface LodProfile {
  lowSegments: number
  mediumSegments: number
  mediumPixelRadius: number
  highPixelRadius: number
}

const LOD_PROFILES: Record<EffectiveQuality, LodProfile> = {
  eco: {
    lowSegments: 10,
    mediumSegments: 16,
    mediumPixelRadius: 15,
    highPixelRadius: 62,
  },
  balanced: {
    lowSegments: 12,
    mediumSegments: 24,
    mediumPixelRadius: 20,
    highPixelRadius: 82,
  },
  ultra: {
    lowSegments: 16,
    mediumSegments: 32,
    mediumPixelRadius: 24,
    highPixelRadius: 104,
  },
}

function isSphereMesh(object: THREE.Object3D): object is THREE.Mesh<THREE.SphereGeometry> {
  if (!(object as THREE.Mesh).isMesh) return false
  const geometry = (object as THREE.Mesh).geometry
  return Boolean(geometry && geometry.type === 'SphereGeometry')
}

function createLodData(geometry: THREE.SphereGeometry): SphereLodData {
  const parameters = geometry.parameters as SphereParameters
  const radius = parameters.radius ?? geometry.boundingSphere?.radius ?? 1
  const widthSegments = Math.max(3, parameters.widthSegments ?? 32)
  const heightSegments = Math.max(2, parameters.heightSegments ?? Math.ceil(widthSegments / 2))

  geometry.computeBoundingSphere()

  return {
    original: geometry,
    generated: new Map(),
    radius,
    originalWidthSegments: widthSegments,
    originalHeightSegments: heightSegments,
    phiStart: parameters.phiStart ?? 0,
    phiLength: parameters.phiLength ?? Math.PI * 2,
    thetaStart: parameters.thetaStart ?? 0,
    thetaLength: parameters.thetaLength ?? Math.PI,
    currentWidthSegments: widthSegments,
  }
}

function getOrCreateGeometry(data: SphereLodData, widthSegments: number) {
  if (widthSegments >= data.originalWidthSegments) return data.original

  const existing = data.generated.get(widthSegments)
  if (existing) return existing

  const originalRatio = data.originalHeightSegments / data.originalWidthSegments
  const heightSegments = Math.max(6, Math.round(widthSegments * Math.min(1, originalRatio)))
  const geometry = new THREE.SphereGeometry(
    data.radius,
    widthSegments,
    heightSegments,
    data.phiStart,
    data.phiLength,
    data.thetaStart,
    data.thetaLength
  )
  geometry.computeBoundingSphere()
  data.generated.set(widthSegments, geometry)
  return geometry
}

function projectedPixelRadius(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  viewportHeight: number,
  worldPosition: THREE.Vector3,
  worldScale: THREE.Vector3
) {
  mesh.getWorldPosition(worldPosition)
  mesh.getWorldScale(worldScale)

  const geometry = mesh.geometry as THREE.SphereGeometry
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()

  const localRadius = geometry.boundingSphere?.radius ?? 1
  const scale = Math.max(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z))
  const worldRadius = localRadius * scale

  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const perspectiveCamera = camera as THREE.PerspectiveCamera
    const distance = Math.max(0.001, camera.position.distanceTo(worldPosition))
    const visibleWorldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov) / 2) * distance
    return (worldRadius / visibleWorldHeight) * viewportHeight
  }

  if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    const orthographicCamera = camera as THREE.OrthographicCamera
    const visibleWorldHeight = Math.max(
      0.001,
      (orthographicCamera.top - orthographicCamera.bottom) / orthographicCamera.zoom
    )
    return (worldRadius / visibleWorldHeight) * viewportHeight
  }

  return Number.POSITIVE_INFINITY
}

function chooseSegments(data: SphereLodData, pixelRadius: number, quality: EffectiveQuality) {
  const profile = LOD_PROFILES[quality]

  if (pixelRadius >= profile.highPixelRadius) return data.originalWidthSegments
  if (pixelRadius >= profile.mediumPixelRadius) {
    return Math.min(data.originalWidthSegments, profile.mediumSegments)
  }
  return Math.min(data.originalWidthSegments, profile.lowSegments)
}

/**
 * Applies screen-space LOD to every sphere in the scene, including planets,
 * moons, atmosphere shells, selection helpers, and the Sun. Existing geometry
 * is retained for close-up views while distant bodies share much lighter
 * segment counts. The manager intentionally runs a few times per second rather
 * than on every frame.
 */
export default function AdaptiveLodManager() {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)

  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const quality = getEffectiveQuality({ preset, autoQuality })

  const elapsedRef = useRef(Number.POSITIVE_INFINITY)
  const worldPositionRef = useRef(new THREE.Vector3())
  const worldScaleRef = useRef(new THREE.Vector3())

  useEffect(() => {
    elapsedRef.current = Number.POSITIVE_INFINITY
    invalidate()
  }, [invalidate, quality, size.height])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    if (elapsedRef.current < UPDATE_INTERVAL_SECONDS) return
    elapsedRef.current = 0

    let changed = false
    const worldPosition = worldPositionRef.current
    const worldScale = worldScaleRef.current

    scene.traverse((object) => {
      if (!isSphereMesh(object) || object.userData.disableAdaptiveLod === true) return

      let data = object.userData[LOD_DATA_KEY] as SphereLodData | undefined
      if (!data) {
        data = createLodData(object.geometry)
        object.userData[LOD_DATA_KEY] = data
      }

      if (data.originalWidthSegments <= LOD_PROFILES[quality].lowSegments) return

      const pixelRadius = projectedPixelRadius(
        object,
        camera,
        Math.max(1, size.height),
        worldPosition,
        worldScale
      )
      const nextSegments = chooseSegments(data, pixelRadius, quality)

      if (nextSegments === data.currentWidthSegments) return

      object.geometry = getOrCreateGeometry(data, nextSegments)
      data.currentWidthSegments = nextSegments
      object.frustumCulled = true
      changed = true
    })

    if (changed) invalidate()
  })

  useEffect(() => {
    return () => {
      scene.traverse((object) => {
        if (!isSphereMesh(object)) return
        const data = object.userData[LOD_DATA_KEY] as SphereLodData | undefined
        if (!data) return

        object.geometry = data.original
        data.generated.forEach((geometry) => geometry.dispose())
        delete object.userData[LOD_DATA_KEY]
      })
    }
  }, [scene])

  return null
}
