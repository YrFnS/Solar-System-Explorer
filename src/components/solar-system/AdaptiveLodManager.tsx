'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { requestPacedFrame } from './FramePacingController'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'

const LOD_DATA_KEY = '__solarExplorerSphereLod'
const MIN_CAMERA_EVALUATION_INTERVAL_MS = 90
const DIAGNOSTIC_PUBLISH_INTERVAL_MS = 500
const POSITION_EPSILON_SQ = 0.000025
const QUATERNION_EPSILON = 0.000002

export const ADAPTIVE_LOD_INVALIDATE_EVENT = 'solar-explorer:adaptive-lod-invalidate'

export type LodInvalidationReason =
  | 'initial'
  | 'camera'
  | 'viewport'
  | 'quality'
  | 'registry'
  | 'external'

interface SphereParameters {
  radius?: number
  widthSegments?: number
  heightSegments?: number
  phiStart?: number
  phiLength?: number
  thetaStart?: number
  thetaLength?: number
}

interface SphereLodEntry {
  mesh: THREE.Mesh<THREE.SphereGeometry>
  original: THREE.SphereGeometry
  radius: number
  originalWidthSegments: number
  originalHeightSegments: number
  phiStart: number
  phiLength: number
  thetaStart: number
  thetaLength: number
  currentWidthSegments: number
  currentPoolKey: string | null
}

interface SpherePoolRecord {
  geometry: THREE.SphereGeometry
  users: number
  acquisitions: number
}

interface LodProfile {
  lowSegments: number
  mediumSegments: number
  mediumPixelRadius: number
  highPixelRadius: number
}

interface CameraSnapshot {
  initialized: boolean
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  fov: number
  zoom: number
}

interface ObjectObserver {
  object: THREE.Object3D
  added: (event: ChildMutationEvent) => void
  removed: (event: ChildMutationEvent) => void
}

interface ChildMutationEvent {
  type: string
  child: THREE.Object3D
}

interface LodStats {
  initialSceneWalks: number
  discoveredObjects: number
  registryAdditions: number
  registryRemovals: number
  registryEvaluations: number
  meshEvaluations: number
  geometrySwaps: number
  poolHits: number
  poolMisses: number
  poolDisposals: number
  cameraInvalidations: number
  viewportInvalidations: number
  qualityInvalidations: number
  registryInvalidations: number
  externalInvalidations: number
  stationaryFrames: number
  throttledFrames: number
  evaluationSamples: number[]
  lastEvaluationMs: number | null
  maxEvaluationMs: number
  lastEvaluationReason: LodInvalidationReason
}

export interface SolarAdaptiveLodDiagnostics {
  quality: EffectiveQuality
  registeredMeshes: number
  observedObjects: number
  initialSceneWalks: number
  periodicSceneWalks: number
  discoveredObjects: number
  registryAdditions: number
  registryRemovals: number
  registryEvaluations: number
  meshEvaluations: number
  stationaryFrames: number
  throttledFrames: number
  geometrySwaps: number
  pooledGeometries: number
  pooledGeometryUsers: number
  poolHits: number
  poolMisses: number
  poolDisposals: number
  lowMeshes: number
  mediumMeshes: number
  highMeshes: number
  averageEvaluationMs: number | null
  lastEvaluationMs: number | null
  maxEvaluationMs: number
  cameraInvalidations: number
  viewportInvalidations: number
  qualityInvalidations: number
  registryInvalidations: number
  externalInvalidations: number
  dirty: boolean
  lastEvaluationReason: LodInvalidationReason
  updatedAt: number
}

declare global {
  interface Window {
    __SOLAR_ADAPTIVE_LOD__?: SolarAdaptiveLodDiagnostics
  }
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

const MINIMUM_ORIGINAL_SEGMENTS = Math.min(
  LOD_PROFILES.eco.lowSegments,
  LOD_PROFILES.balanced.lowSegments,
  LOD_PROFILES.ultra.lowSegments
)

export function requestAdaptiveLodEvaluation(
  reason: LodInvalidationReason = 'external'
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<{ reason: LodInvalidationReason }>(
      ADAPTIVE_LOD_INVALIDATE_EVENT,
      { detail: { reason } }
    )
  )
}

function isSphereMesh(
  object: THREE.Object3D
): object is THREE.Mesh<THREE.SphereGeometry> {
  if (!(object as THREE.Mesh).isMesh) return false
  const geometry = (object as THREE.Mesh).geometry
  return Boolean(geometry && geometry.type === 'SphereGeometry')
}

function getSphereParameters(geometry: THREE.SphereGeometry) {
  geometry.computeBoundingSphere()
  const parameters = geometry.parameters as SphereParameters
  const radius = parameters.radius ?? geometry.boundingSphere?.radius ?? 1
  const widthSegments = Math.max(3, parameters.widthSegments ?? 32)
  const heightSegments = Math.max(
    2,
    parameters.heightSegments ?? Math.ceil(widthSegments / 2)
  )

  return {
    radius,
    widthSegments,
    heightSegments,
    phiStart: parameters.phiStart ?? 0,
    phiLength: parameters.phiLength ?? Math.PI * 2,
    thetaStart: parameters.thetaStart ?? 0,
    thetaLength: parameters.thetaLength ?? Math.PI,
  }
}

function createLodEntry(
  mesh: THREE.Mesh<THREE.SphereGeometry>
): SphereLodEntry | null {
  if (mesh.userData.disableAdaptiveLod === true) return null

  const parameters = getSphereParameters(mesh.geometry)
  if (parameters.widthSegments <= MINIMUM_ORIGINAL_SEGMENTS) return null

  return {
    mesh,
    original: mesh.geometry,
    radius: parameters.radius,
    originalWidthSegments: parameters.widthSegments,
    originalHeightSegments: parameters.heightSegments,
    phiStart: parameters.phiStart,
    phiLength: parameters.phiLength,
    thetaStart: parameters.thetaStart,
    thetaLength: parameters.thetaLength,
    currentWidthSegments: parameters.widthSegments,
    currentPoolKey: null,
  }
}

function geometrySpec(entry: SphereLodEntry, widthSegments: number) {
  const originalRatio =
    entry.originalHeightSegments / entry.originalWidthSegments
  const heightSegments = Math.max(
    6,
    Math.round(widthSegments * Math.min(1, originalRatio))
  )

  const key = [
    entry.radius,
    widthSegments,
    heightSegments,
    entry.phiStart,
    entry.phiLength,
    entry.thetaStart,
    entry.thetaLength,
  ]
    .map((value) => Number(value).toPrecision(12))
    .join(':')

  return { key, heightSegments }
}

function projectedPixelRadius(
  entry: SphereLodEntry,
  camera: THREE.Camera,
  viewportHeight: number,
  worldPosition: THREE.Vector3,
  worldScale: THREE.Vector3
) {
  const mesh = entry.mesh
  mesh.updateWorldMatrix(true, false)
  mesh.getWorldPosition(worldPosition)
  mesh.getWorldScale(worldScale)

  const scale = Math.max(
    Math.abs(worldScale.x),
    Math.abs(worldScale.y),
    Math.abs(worldScale.z)
  )
  const worldRadius = entry.radius * scale

  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const perspectiveCamera = camera as THREE.PerspectiveCamera
    const distance = Math.max(0.001, camera.position.distanceTo(worldPosition))
    const visibleWorldHeight =
      2 *
      Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov) / 2) *
      distance
    return (worldRadius / visibleWorldHeight) * viewportHeight
  }

  if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    const orthographicCamera = camera as THREE.OrthographicCamera
    const visibleWorldHeight = Math.max(
      0.001,
      (orthographicCamera.top - orthographicCamera.bottom) /
        orthographicCamera.zoom
    )
    return (worldRadius / visibleWorldHeight) * viewportHeight
  }

  return Number.POSITIVE_INFINITY
}

function chooseSegments(
  entry: SphereLodEntry,
  pixelRadius: number,
  quality: EffectiveQuality
) {
  const profile = LOD_PROFILES[quality]

  if (pixelRadius >= profile.highPixelRadius) {
    return entry.originalWidthSegments
  }
  if (pixelRadius >= profile.mediumPixelRadius) {
    return Math.min(entry.originalWidthSegments, profile.mediumSegments)
  }
  return Math.min(entry.originalWidthSegments, profile.lowSegments)
}

function createStats(): LodStats {
  return {
    initialSceneWalks: 0,
    discoveredObjects: 0,
    registryAdditions: 0,
    registryRemovals: 0,
    registryEvaluations: 0,
    meshEvaluations: 0,
    geometrySwaps: 0,
    poolHits: 0,
    poolMisses: 0,
    poolDisposals: 0,
    cameraInvalidations: 0,
    viewportInvalidations: 0,
    qualityInvalidations: 0,
    registryInvalidations: 0,
    externalInvalidations: 0,
    stationaryFrames: 0,
    throttledFrames: 0,
    evaluationSamples: [],
    lastEvaluationMs: null,
    maxEvaluationMs: 0,
    lastEvaluationReason: 'initial',
  }
}

function reasonFromEvent(event: Event): LodInvalidationReason {
  const customEvent = event as CustomEvent<{
    reason?: LodInvalidationReason
  }>
  return customEvent.detail?.reason ?? 'external'
}

/**
 * Maintains a registry containing only eligible sphere meshes. The scene is
 * walked once, then child-added and child-removed events keep the registry
 * current. LOD work only iterates registered meshes after camera, viewport,
 * quality, registry, or explicit invalidation changes.
 */
export default function AdaptiveLodManager() {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  const preset = usePerformanceStore((state) => state.preset)
  const autoQuality = usePerformanceStore((state) => state.autoQuality)
  const quality = getEffectiveQuality({ preset, autoQuality })

  const registryRef = useRef(new Map<string, SphereLodEntry>())
  const observerRef = useRef(new Map<string, ObjectObserver>())
  const poolRef = useRef(new Map<string, SpherePoolRecord>())
  const dirtyRef = useRef(true)
  const forceEvaluationRef = useRef(true)
  const pendingReasonsRef = useRef(new Set<LodInvalidationReason>(['initial']))
  const qualityRef = useRef<EffectiveQuality>(quality)
  const viewportHeightRef = useRef(Math.max(1, size.height))
  const lastEvaluationAtRef = useRef(Number.NEGATIVE_INFINITY)
  const lastPublishAtRef = useRef(Number.NEGATIVE_INFINITY)
  const worldPositionRef = useRef(new THREE.Vector3())
  const worldScaleRef = useRef(new THREE.Vector3())
  const cameraPositionRef = useRef(new THREE.Vector3())
  const cameraQuaternionRef = useRef(new THREE.Quaternion())
  const cameraSnapshotRef = useRef<CameraSnapshot>({
    initialized: false,
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    fov: Number.NaN,
    zoom: Number.NaN,
  })
  const statsRef = useRef(createStats())
  const disposingRef = useRef(false)

  const markDirty = useCallback(
    (reason: LodInvalidationReason, force = false) => {
      if (disposingRef.current) return

      const wasDirty = dirtyRef.current
      const reasons = pendingReasonsRef.current
      const reasonAdded = !reasons.has(reason)

      dirtyRef.current = true
      forceEvaluationRef.current ||= force
      if (reasonAdded) {
        reasons.add(reason)
        const stats = statsRef.current
        if (reason === 'camera') stats.cameraInvalidations += 1
        else if (reason === 'viewport') stats.viewportInvalidations += 1
        else if (reason === 'quality') stats.qualityInvalidations += 1
        else if (reason === 'registry') stats.registryInvalidations += 1
        else if (reason === 'external') stats.externalInvalidations += 1
      }

      if (!wasDirty || reasonAdded || force) {
        requestPacedFrame(`adaptive-lod:${reason}`, force ? 900 : 450)
      }
    },
    []
  )

  const releasePoolGeometry = useCallback((entry: SphereLodEntry) => {
    if (!entry.currentPoolKey) return
    const record = poolRef.current.get(entry.currentPoolKey)
    if (record) record.users = Math.max(0, record.users - 1)
    entry.currentPoolKey = null
  }, [])

  const restoreOriginalGeometry = useCallback(
    (entry: SphereLodEntry) => {
      releasePoolGeometry(entry)
      if (entry.mesh.geometry !== entry.original) {
        entry.mesh.geometry = entry.original
      }
      entry.currentWidthSegments = entry.originalWidthSegments
    },
    [releasePoolGeometry]
  )

  const registerMesh = useCallback(
    (mesh: THREE.Mesh<THREE.SphereGeometry>) => {
      const registry = registryRef.current
      if (registry.has(mesh.uuid)) return

      const entry = createLodEntry(mesh)
      if (!entry) return

      registry.set(mesh.uuid, entry)
      mesh.userData[LOD_DATA_KEY] = { registered: true }
      statsRef.current.registryAdditions += 1
      markDirty('registry')
    },
    [markDirty]
  )

  const unregisterMesh = useCallback(
    (mesh: THREE.Mesh<THREE.SphereGeometry>) => {
      const entry = registryRef.current.get(mesh.uuid)
      if (!entry) return

      restoreOriginalGeometry(entry)
      registryRef.current.delete(mesh.uuid)
      delete mesh.userData[LOD_DATA_KEY]
      statsRef.current.registryRemovals += 1
      markDirty('registry')
    },
    [markDirty, restoreOriginalGeometry]
  )

  useEffect(() => {
    const eventTarget = (object: THREE.Object3D) =>
      object as unknown as {
        addEventListener: (
          type: string,
          listener: (event: ChildMutationEvent) => void
        ) => void
        removeEventListener: (
          type: string,
          listener: (event: ChildMutationEvent) => void
        ) => void
      }

    const observeSubtree = (object: THREE.Object3D) => {
      if (observerRef.current.has(object.uuid)) return

      statsRef.current.discoveredObjects += 1
      if (isSphereMesh(object)) registerMesh(object)

      const added = (event: ChildMutationEvent) => {
        observeSubtree(event.child)
      }
      const removed = (event: ChildMutationEvent) => {
        unobserveSubtree(event.child)
      }

      const target = eventTarget(object)
      target.addEventListener('childadded', added)
      target.addEventListener('childremoved', removed)
      observerRef.current.set(object.uuid, { object, added, removed })

      object.children.forEach(observeSubtree)
    }

    const unobserveSubtree = (object: THREE.Object3D) => {
      object.children.forEach(unobserveSubtree)
      if (isSphereMesh(object)) unregisterMesh(object)

      const observer = observerRef.current.get(object.uuid)
      if (!observer) return
      const target = eventTarget(observer.object)
      target.removeEventListener('childadded', observer.added)
      target.removeEventListener('childremoved', observer.removed)
      observerRef.current.delete(object.uuid)
    }

    statsRef.current.initialSceneWalks += 1
    observeSubtree(scene)
    markDirty('initial', true)

    return () => {
      disposingRef.current = true
      unobserveSubtree(scene)

      registryRef.current.forEach(restoreOriginalGeometry)
      registryRef.current.clear()
      observerRef.current.clear()

      poolRef.current.forEach((record) => {
        record.geometry.dispose()
        statsRef.current.poolDisposals += 1
      })
      poolRef.current.clear()
      delete window.__SOLAR_ADAPTIVE_LOD__
    }
  }, [markDirty, registerMesh, restoreOriginalGeometry, scene, unregisterMesh])

  useEffect(() => {
    qualityRef.current = quality
    markDirty('quality', true)
  }, [markDirty, quality])

  useEffect(() => {
    viewportHeightRef.current = Math.max(1, size.height)
    markDirty('viewport', true)
  }, [markDirty, size.height, size.width])

  useEffect(() => {
    const handleInvalidation = (event: Event) => {
      markDirty(reasonFromEvent(event), true)
    }

    window.addEventListener(
      ADAPTIVE_LOD_INVALIDATE_EVENT,
      handleInvalidation
    )
    return () => {
      window.removeEventListener(
        ADAPTIVE_LOD_INVALIDATE_EVENT,
        handleInvalidation
      )
    }
  }, [markDirty])

  const assignGeometry = useCallback(
    (entry: SphereLodEntry, nextWidthSegments: number) => {
      if (nextWidthSegments === entry.currentWidthSegments) return false

      releasePoolGeometry(entry)

      if (nextWidthSegments >= entry.originalWidthSegments) {
        entry.mesh.geometry = entry.original
      } else {
        const spec = geometrySpec(entry, nextWidthSegments)
        let record = poolRef.current.get(spec.key)

        if (record) {
          statsRef.current.poolHits += 1
        } else {
          const geometry = new THREE.SphereGeometry(
            entry.radius,
            nextWidthSegments,
            spec.heightSegments,
            entry.phiStart,
            entry.phiLength,
            entry.thetaStart,
            entry.thetaLength
          )
          geometry.computeBoundingSphere()
          geometry.userData.solarAdaptiveLodPool = spec.key
          record = { geometry, users: 0, acquisitions: 0 }
          poolRef.current.set(spec.key, record)
          statsRef.current.poolMisses += 1
        }

        record.users += 1
        record.acquisitions += 1
        entry.currentPoolKey = spec.key
        entry.mesh.geometry = record.geometry
      }

      entry.currentWidthSegments = nextWidthSegments
      entry.mesh.frustumCulled = true
      statsRef.current.geometrySwaps += 1
      return true
    },
    [releasePoolGeometry]
  )

  const publishDiagnostics = useCallback(() => {
    const stats = statsRef.current
    const registry = registryRef.current
    const pool = poolRef.current
    const profile = LOD_PROFILES[qualityRef.current]
    let lowMeshes = 0
    let mediumMeshes = 0
    let highMeshes = 0

    registry.forEach((entry) => {
      if (entry.currentWidthSegments >= entry.originalWidthSegments) {
        highMeshes += 1
      } else if (entry.currentWidthSegments >= profile.mediumSegments) {
        mediumMeshes += 1
      } else {
        lowMeshes += 1
      }
    })

    const pooledGeometryUsers = [...pool.values()].reduce(
      (total, record) => total + record.users,
      0
    )
    const averageEvaluationMs =
      stats.evaluationSamples.length > 0
        ? stats.evaluationSamples.reduce((total, value) => total + value, 0) /
          stats.evaluationSamples.length
        : null

    window.__SOLAR_ADAPTIVE_LOD__ = {
      quality: qualityRef.current,
      registeredMeshes: registry.size,
      observedObjects: observerRef.current.size,
      initialSceneWalks: stats.initialSceneWalks,
      periodicSceneWalks: 0,
      discoveredObjects: stats.discoveredObjects,
      registryAdditions: stats.registryAdditions,
      registryRemovals: stats.registryRemovals,
      registryEvaluations: stats.registryEvaluations,
      meshEvaluations: stats.meshEvaluations,
      stationaryFrames: stats.stationaryFrames,
      throttledFrames: stats.throttledFrames,
      geometrySwaps: stats.geometrySwaps,
      pooledGeometries: pool.size,
      pooledGeometryUsers,
      poolHits: stats.poolHits,
      poolMisses: stats.poolMisses,
      poolDisposals: stats.poolDisposals,
      lowMeshes,
      mediumMeshes,
      highMeshes,
      averageEvaluationMs,
      lastEvaluationMs: stats.lastEvaluationMs,
      maxEvaluationMs: stats.maxEvaluationMs,
      cameraInvalidations: stats.cameraInvalidations,
      viewportInvalidations: stats.viewportInvalidations,
      qualityInvalidations: stats.qualityInvalidations,
      registryInvalidations: stats.registryInvalidations,
      externalInvalidations: stats.externalInvalidations,
      dirty: dirtyRef.current,
      lastEvaluationReason: stats.lastEvaluationReason,
      updatedAt: Date.now(),
    }
    lastPublishAtRef.current = performance.now()
  }, [])

  const cameraChanged = useCallback(() => {
    const snapshot = cameraSnapshotRef.current
    camera.getWorldPosition(cameraPositionRef.current)
    camera.getWorldQuaternion(cameraQuaternionRef.current)

    const perspectiveFov = (camera as THREE.PerspectiveCamera)
      .isPerspectiveCamera
      ? (camera as THREE.PerspectiveCamera).fov
      : Number.NaN
    const cameraZoom =
      (camera as THREE.PerspectiveCamera | THREE.OrthographicCamera).zoom ??
      Number.NaN

    if (!snapshot.initialized) {
      snapshot.initialized = true
      snapshot.position.copy(cameraPositionRef.current)
      snapshot.quaternion.copy(cameraQuaternionRef.current)
      snapshot.fov = perspectiveFov
      snapshot.zoom = cameraZoom
      return true
    }

    const positionMoved =
      snapshot.position.distanceToSquared(cameraPositionRef.current) >
      POSITION_EPSILON_SQ
    const quaternionMoved =
      1 - Math.abs(snapshot.quaternion.dot(cameraQuaternionRef.current)) >
      QUATERNION_EPSILON
    const projectionChanged =
      snapshot.fov !== perspectiveFov || snapshot.zoom !== cameraZoom

    if (!positionMoved && !quaternionMoved && !projectionChanged) return false

    snapshot.position.copy(cameraPositionRef.current)
    snapshot.quaternion.copy(cameraQuaternionRef.current)
    snapshot.fov = perspectiveFov
    snapshot.zoom = cameraZoom
    return true
  }, [camera])

  useFrame(() => {
    const now = performance.now()
    if (cameraChanged()) markDirty('camera')

    if (!dirtyRef.current) {
      statsRef.current.stationaryFrames += 1
      if (now - lastPublishAtRef.current >= DIAGNOSTIC_PUBLISH_INTERVAL_MS) {
        publishDiagnostics()
      }
      return
    }

    if (
      !forceEvaluationRef.current &&
      now - lastEvaluationAtRef.current <
        MIN_CAMERA_EVALUATION_INTERVAL_MS
    ) {
      statsRef.current.throttledFrames += 1
      return
    }

    const startedAt = performance.now()
    const reasons = pendingReasonsRef.current
    const reason =
      reasons.has('quality')
        ? 'quality'
        : reasons.has('viewport')
          ? 'viewport'
          : reasons.has('registry')
            ? 'registry'
            : reasons.has('camera')
              ? 'camera'
              : reasons.has('external')
                ? 'external'
                : 'initial'

    let changed = false
    const registry = registryRef.current
    const worldPosition = worldPositionRef.current
    const worldScale = worldScaleRef.current
    const currentQuality = qualityRef.current
    const viewportHeight = viewportHeightRef.current

    registry.forEach((entry) => {
      statsRef.current.meshEvaluations += 1
      const pixelRadius = projectedPixelRadius(
        entry,
        camera,
        viewportHeight,
        worldPosition,
        worldScale
      )
      const nextSegments = chooseSegments(
        entry,
        pixelRadius,
        currentQuality
      )
      changed = assignGeometry(entry, nextSegments) || changed
    })

    const evaluationMs = performance.now() - startedAt
    const stats = statsRef.current
    stats.registryEvaluations += 1
    stats.lastEvaluationMs = evaluationMs
    stats.maxEvaluationMs = Math.max(stats.maxEvaluationMs, evaluationMs)
    stats.lastEvaluationReason = reason
    stats.evaluationSamples.push(evaluationMs)
    if (stats.evaluationSamples.length > 120) {
      stats.evaluationSamples.splice(
        0,
        stats.evaluationSamples.length - 120
      )
    }

    dirtyRef.current = false
    forceEvaluationRef.current = false
    pendingReasonsRef.current.clear()
    lastEvaluationAtRef.current = now
    publishDiagnostics()

    if (changed) requestPacedFrame('adaptive-lod:geometry-swap', 250)
  })

  return null
}
