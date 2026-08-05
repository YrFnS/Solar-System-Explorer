'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { EphemerisSmallBodyData } from './EphemerisSmallBody'
import { getBodyVisualPosition } from './ephemeris'
import { useExperienceStore } from './experience-store'
import {
  getEffectiveQuality,
  type EffectiveQuality,
  usePerformanceStore,
} from './performance-store'
import { DAY_MS, getSimulationDateMs, J2000_UNIX_MS } from './simulation-clock'
import { useSolarSystemStore } from './store'

type SmallBodyShape = 'sphere' | 'rocky'

interface SmallBodyInstanceEntry {
  body: EphemerisSmallBodyData
  shape: SmallBodyShape
  shapeIndex: number
}

interface InstancedSmallBodiesProps {
  bodies: EphemerisSmallBodyData[]
  batchedOrbitPaths: number
  individualOrbitPaths: number
  orbitBatchDraws: number
}

export interface SmallBodyRuntimeDiagnostics {
  quality: EffectiveQuality
  mode: 'explore' | 'scientific' | 'sandbox'
  selectedBody: string | null
  totalBodies: number
  instancedBodies: number
  detailedBodies: number
  sphereInstances: number
  rockyInstances: number
  hitInstances: number
  overviewFrameManagers: number
  positionEvaluationsPerFrame: number
  matrixWritesPerFrame: number
  bodyBatchDraws: number
  orbitBatchDraws: number
  batchedOrbitPaths: number
  individualOrbitPaths: number
  frameSamples: number
  lastUpdateMs: number
  averageUpdateMs: number
  maxUpdateMs: number
  updatedAt: number
}

declare global {
  interface Window {
    __SOLAR_SMALL_BODY_RUNTIME__?: SmallBodyRuntimeDiagnostics
  }
}

function getShape(body: EphemerisSmallBodyData): SmallBodyShape {
  return body.type.includes('Asteroid')
    || body.type === 'Centaur'
    || body.type === 'Interstellar Object'
    ? 'rocky'
    : 'sphere'
}

function getBodyScale(body: EphemerisSmallBodyData, target: THREE.Vector3) {
  if (body.id === 'oumuamua') {
    return target.set(body.radius * 2.5, body.radius * 0.65, body.radius * 0.65)
  }

  return target.setScalar(body.radius)
}

export default function InstancedSmallBodies({
  bodies,
  batchedOrbitPaths,
  individualOrbitPaths,
  orbitBatchDraws,
}: InstancedSmallBodiesProps) {
  const sphereRef = useRef<THREE.InstancedMesh>(null)
  const rockyRef = useRef<THREE.InstancedMesh>(null)
  const hitRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const positionRef = useRef(new THREE.Vector3())
  const scaleRef = useRef(new THREE.Vector3())
  const colorRef = useRef(new THREE.Color())
  const frameSamplesRef = useRef(0)
  const averageUpdateMsRef = useRef(0)
  const maxUpdateMsRef = useRef(0)
  const lastUpdateMsRef = useRef(0)
  const lastPublishAtRef = useRef(0)

  const mode = useExperienceStore((state) => state.mode)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const setFocusTarget = useSolarSystemStore((state) => state.setFocusTarget)
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))

  const { entries, sphereCount, rockyCount, bodyIds } = useMemo(() => {
    let nextSphereIndex = 0
    let nextRockyIndex = 0
    const nextEntries = bodies.map((body): SmallBodyInstanceEntry => {
      const shape = getShape(body)
      const shapeIndex = shape === 'sphere' ? nextSphereIndex++ : nextRockyIndex++
      return { body, shape, shapeIndex }
    })

    return {
      entries: nextEntries,
      sphereCount: nextSphereIndex,
      rockyCount: nextRockyIndex,
      bodyIds: new Set(bodies.map((body) => body.id)),
    }
  }, [bodies])

  const detailedBodies = selectedBody && bodyIds.has(selectedBody) ? 1 : 0
  const instancedBodies = bodies.length - detailedBodies
  const bodyBatchDraws = (sphereCount > 0 ? 1 : 0)
    + (rockyCount > 0 ? 1 : 0)
    + (bodies.length > 0 ? 1 : 0)

  const publishDiagnostics = useCallback(() => {
    if (typeof window === 'undefined') return

    window.__SOLAR_SMALL_BODY_RUNTIME__ = {
      quality,
      mode,
      selectedBody,
      totalBodies: bodies.length,
      instancedBodies,
      detailedBodies,
      sphereInstances: sphereCount - (
        selectedBody && entries.some((entry) => (
          entry.body.id === selectedBody && entry.shape === 'sphere'
        )) ? 1 : 0
      ),
      rockyInstances: rockyCount - (
        selectedBody && entries.some((entry) => (
          entry.body.id === selectedBody && entry.shape === 'rocky'
        )) ? 1 : 0
      ),
      hitInstances: instancedBodies,
      overviewFrameManagers: 1,
      positionEvaluationsPerFrame: instancedBodies,
      matrixWritesPerFrame: instancedBodies * 2,
      bodyBatchDraws,
      orbitBatchDraws,
      batchedOrbitPaths,
      individualOrbitPaths,
      frameSamples: frameSamplesRef.current,
      lastUpdateMs: lastUpdateMsRef.current,
      averageUpdateMs: averageUpdateMsRef.current,
      maxUpdateMs: maxUpdateMsRef.current,
      updatedAt: Date.now(),
    }
  }, [
    batchedOrbitPaths,
    bodies.length,
    bodyBatchDraws,
    detailedBodies,
    entries,
    individualOrbitPaths,
    instancedBodies,
    mode,
    orbitBatchDraws,
    quality,
    rockyCount,
    selectedBody,
    sphereCount,
  ])

  useLayoutEffect(() => {
    const configureMesh = (
      mesh: THREE.InstancedMesh | null,
      shape: SmallBodyShape
    ) => {
      if (!mesh) return
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      for (const entry of entries) {
        if (entry.shape !== shape) continue
        mesh.setColorAt(entry.shapeIndex, colorRef.current.set(entry.body.color))
      }

      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    configureMesh(sphereRef.current, 'sphere')
    configureMesh(rockyRef.current, 'rocky')
    if (hitRef.current) hitRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [entries])

  useEffect(() => {
    publishDiagnostics()
    return () => {
      delete window.__SOLAR_SMALL_BODY_RUNTIME__
    }
  }, [publishDiagnostics])

  useFrame(() => {
    const sphereMesh = sphereRef.current
    const rockyMesh = rockyRef.current
    const hitMesh = hitRef.current
    if (!hitMesh || (!sphereMesh && !rockyMesh)) return

    const startedAt = performance.now()
    const dateMs = getSimulationDateMs()
    const days = (dateMs - J2000_UNIX_MS) / DAY_MS
    const dummy = dummyRef.current
    let positionEvaluations = 0

    entries.forEach((entry, bodyIndex) => {
      const { body, shape, shapeIndex } = entry
      const visibleMesh = shape === 'sphere' ? sphereMesh : rockyMesh
      const hidden = body.id === selectedBody

      if (hidden) {
        dummy.position.set(0, 0, 0)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        visibleMesh?.setMatrixAt(shapeIndex, dummy.matrix)
        hitMesh.setMatrixAt(bodyIndex, dummy.matrix)
        return
      }

      getBodyVisualPosition(body.id, dateMs, mode, positionRef.current)
      positionEvaluations += 1

      dummy.position.copy(positionRef.current)
      dummy.rotation.set(
        days * 0.018,
        days * ('rotationSpeed' in body ? body.rotationSpeed : 0.08) * 0.35,
        0
      )
      dummy.scale.copy(getBodyScale(body, scaleRef.current))
      dummy.updateMatrix()
      visibleMesh?.setMatrixAt(shapeIndex, dummy.matrix)

      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(Math.max(body.radius * 2.2, 0.14))
      dummy.updateMatrix()
      hitMesh.setMatrixAt(bodyIndex, dummy.matrix)
    })

    if (sphereMesh) sphereMesh.instanceMatrix.needsUpdate = true
    if (rockyMesh) rockyMesh.instanceMatrix.needsUpdate = true
    hitMesh.instanceMatrix.needsUpdate = true

    const updateMs = performance.now() - startedAt
    frameSamplesRef.current += 1
    lastUpdateMsRef.current = updateMs
    averageUpdateMsRef.current += (
      updateMs - averageUpdateMsRef.current
    ) / frameSamplesRef.current
    maxUpdateMsRef.current = Math.max(maxUpdateMsRef.current, updateMs)

    if (positionEvaluations !== instancedBodies) {
      console.warn(
        `[small-bodies] expected ${instancedBodies} position evaluations, received ${positionEvaluations}`
      )
    }

    if (
      frameSamplesRef.current <= 2
      || performance.now() - lastPublishAtRef.current >= 500
    ) {
      lastPublishAtRef.current = performance.now()
      publishDiagnostics()
    }
  })

  const selectInstance = (
    event: ThreeEvent<MouseEvent>,
    bodyList: EphemerisSmallBodyData[]
  ) => {
    const instanceId = event.instanceId
    if (instanceId === undefined) return
    const body = bodyList[instanceId]
    if (!body) return

    event.stopPropagation()
    setSelectedBody(body.id)
    setFocusTarget(body.id)
  }

  const sphereBodies = useMemo(
    () => entries.filter((entry) => entry.shape === 'sphere').map((entry) => entry.body),
    [entries]
  )
  const rockyBodies = useMemo(
    () => entries.filter((entry) => entry.shape === 'rocky').map((entry) => entry.body),
    [entries]
  )

  return (
    <group name="instanced-small-body-overview">
      {sphereCount > 0 ? (
        <instancedMesh
          ref={sphereRef}
          args={[undefined, undefined, sphereCount]}
          frustumCulled={false}
          onClick={(event) => selectInstance(event, sphereBodies)}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial vertexColors roughness={0.9} metalness={0.02} />
        </instancedMesh>
      ) : null}

      {rockyCount > 0 ? (
        <instancedMesh
          ref={rockyRef}
          args={[undefined, undefined, rockyCount]}
          frustumCulled={false}
          onClick={(event) => selectInstance(event, rockyBodies)}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial vertexColors roughness={0.92} metalness={0.04} />
        </instancedMesh>
      ) : null}

      {bodies.length > 0 ? (
        <instancedMesh
          ref={hitRef}
          args={[undefined, undefined, bodies.length]}
          frustumCulled={false}
          onClick={(event) => selectInstance(event, bodies)}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />
        </instancedMesh>
      ) : null}
    </group>
  )
}
