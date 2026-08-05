'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { DwarfPlanetData } from './data'
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
import { useAdaptiveTexture } from './textures/useAdaptiveTexture'

type TexturedSmallBody = DwarfPlanetData & { textureUrl: string }
type SmallBodyShape = 'sphere' | 'rocky' | 'textured'

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

interface TexturedOverviewBodyProps {
  body: TexturedSmallBody
  registerMesh: (bodyId: string, mesh: THREE.Mesh | null) => void
  onSelect: (event: ThreeEvent<MouseEvent>, body: EphemerisSmallBodyData) => void
}

export interface SmallBodyRuntimeDiagnostics {
  quality: EffectiveQuality
  mode: 'explore' | 'scientific' | 'sandbox'
  selectedBody: string | null
  totalBodies: number
  instancedBodies: number
  texturedOverviewBodies: number
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

function hasAuthoredTexture(
  body: EphemerisSmallBodyData
): body is TexturedSmallBody {
  return 'textureUrl' in body && typeof body.textureUrl === 'string'
}

function getShape(body: EphemerisSmallBodyData): SmallBodyShape {
  if (hasAuthoredTexture(body)) return 'textured'

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

function TexturedOverviewBody({
  body,
  registerMesh,
  onSelect,
}: TexturedOverviewBodyProps) {
  const texture = useAdaptiveTexture(body.textureUrl, { anisotropy: 4 })

  return (
    <mesh
      ref={(mesh) => registerMesh(body.id, mesh)}
      matrixAutoUpdate={false}
      frustumCulled={false}
      onClick={(event) => onSelect(event, body)}
    >
      <sphereGeometry args={[1, 24, 18]} />
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0.02} />
    </mesh>
  )
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
  const texturedMeshesRef = useRef(new Map<string, THREE.Mesh>())
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

  const {
    entries,
    sphereCount,
    rockyCount,
    texturedBodies,
    bodyIds,
  } = useMemo(() => {
    let nextSphereIndex = 0
    let nextRockyIndex = 0
    const nextTexturedBodies: TexturedSmallBody[] = []
    const nextEntries = bodies.map((body): SmallBodyInstanceEntry => {
      const shape = getShape(body)
      let shapeIndex = 0

      if (shape === 'sphere') shapeIndex = nextSphereIndex++
      if (shape === 'rocky') shapeIndex = nextRockyIndex++
      if (shape === 'textured') {
        shapeIndex = nextTexturedBodies.length
        nextTexturedBodies.push(body as TexturedSmallBody)
      }

      return { body, shape, shapeIndex }
    })

    return {
      entries: nextEntries,
      sphereCount: nextSphereIndex,
      rockyCount: nextRockyIndex,
      texturedBodies: nextTexturedBodies,
      bodyIds: new Set(bodies.map((body) => body.id)),
    }
  }, [bodies])

  const selectedEntry = selectedBody
    ? entries.find((entry) => entry.body.id === selectedBody) ?? null
    : null
  const detailedBodies = selectedEntry ? 1 : 0
  const selectedInstanced = selectedEntry && selectedEntry.shape !== 'textured' ? 1 : 0
  const selectedTextured = selectedEntry?.shape === 'textured' ? 1 : 0
  const instancedBodies = sphereCount + rockyCount - selectedInstanced
  const texturedOverviewBodies = texturedBodies.length - selectedTextured
  const overviewBodies = instancedBodies + texturedOverviewBodies
  const bodyBatchDraws = (sphereCount > 0 ? 1 : 0)
    + (rockyCount > 0 ? 1 : 0)
    + texturedOverviewBodies
    + (bodies.length > 0 ? 1 : 0)

  const publishDiagnostics = useCallback(() => {
    if (typeof window === 'undefined') return

    window.__SOLAR_SMALL_BODY_RUNTIME__ = {
      quality,
      mode,
      selectedBody,
      totalBodies: bodies.length,
      instancedBodies,
      texturedOverviewBodies,
      detailedBodies,
      sphereInstances: sphereCount - (
        selectedEntry?.shape === 'sphere' ? 1 : 0
      ),
      rockyInstances: rockyCount - (
        selectedEntry?.shape === 'rocky' ? 1 : 0
      ),
      hitInstances: overviewBodies,
      overviewFrameManagers: 1,
      positionEvaluationsPerFrame: overviewBodies,
      matrixWritesPerFrame: overviewBodies * 2,
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
    individualOrbitPaths,
    instancedBodies,
    mode,
    orbitBatchDraws,
    overviewBodies,
    quality,
    rockyCount,
    selectedBody,
    selectedEntry?.shape,
    sphereCount,
    texturedOverviewBodies,
  ])

  const registerTexturedMesh = useCallback((bodyId: string, mesh: THREE.Mesh | null) => {
    if (mesh) {
      mesh.matrixAutoUpdate = false
      texturedMeshesRef.current.set(bodyId, mesh)
      return
    }

    texturedMeshesRef.current.delete(bodyId)
  }, [])

  const selectBody = useCallback((
    event: ThreeEvent<MouseEvent>,
    body: EphemerisSmallBodyData
  ) => {
    event.stopPropagation()
    setSelectedBody(body.id)
    setFocusTarget(body.id)
  }, [setFocusTarget, setSelectedBody])

  useLayoutEffect(() => {
    const configureMesh = (
      mesh: THREE.InstancedMesh | null,
      shape: Exclude<SmallBodyShape, 'textured'>
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
    if (!hitMesh) return

    const startedAt = performance.now()
    const dateMs = getSimulationDateMs()
    const days = (dateMs - J2000_UNIX_MS) / DAY_MS
    const dummy = dummyRef.current
    let positionEvaluations = 0

    entries.forEach((entry, bodyIndex) => {
      const { body, shape, shapeIndex } = entry
      const hidden = body.id === selectedBody
      const texturedMesh = shape === 'textured'
        ? texturedMeshesRef.current.get(body.id) ?? null
        : null
      const instancedMesh = shape === 'sphere'
        ? sphereMesh
        : shape === 'rocky'
          ? rockyMesh
          : null

      if (hidden) {
        if (texturedMesh) texturedMesh.visible = false
        dummy.position.set(0, 0, 0)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        instancedMesh?.setMatrixAt(shapeIndex, dummy.matrix)
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

      if (texturedMesh) {
        texturedMesh.visible = true
        texturedMesh.matrix.copy(dummy.matrix)
        texturedMesh.matrixWorldNeedsUpdate = true
      } else {
        instancedMesh?.setMatrixAt(shapeIndex, dummy.matrix)
      }

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

    if (positionEvaluations !== overviewBodies) {
      console.warn(
        `[small-bodies] expected ${overviewBodies} position evaluations, received ${positionEvaluations}`
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
    selectBody(event, body)
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

      {texturedBodies.map((body) => (
        <TexturedOverviewBody
          key={body.id}
          body={body}
          registerMesh={registerTexturedMesh}
          onSelect={selectBody}
        />
      ))}

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
