'use client'

import { useEffect, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, type RootState } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { color, mix, positionLocal, time } from 'three/tsl'
import { planets, type PlanetData } from '../data'
import { getMajorPlanetVisualPosition, getOrbitPoints } from '../ephemeris'

export interface LabFrameMetrics {
  fps: number
  averageFrameMs: number
  p95FrameMs: number
  longestFrameMs: number
  samples: number
  drawCalls: number | null
  triangles: number | null
}

interface WebGPULabSceneProps {
  onMetrics: (metrics: LabFrameMetrics) => void
}

const LAB_START_DATE_MS = Date.UTC(2026, 0, 1, 0, 0, 0)
const LAB_DAYS_PER_SECOND = 12

function createPlanetMaterial(body: PlanetData) {
  const base = new THREE.Color(body.color)
  const shadow = base.clone().multiplyScalar(0.38)
  const highlight = base.clone().lerp(new THREE.Color('#ffffff'), 0.34)
  const material = new THREE.MeshStandardNodeMaterial({
    roughness: body.type.includes('Giant') ? 0.58 : 0.82,
    metalness: 0.02,
  })
  const latitude = positionLocal.y
    .div(Math.max(0.01, body.radius))
    .mul(0.5)
    .add(0.5)
  const pulse = time
    .mul(0.16 + body.orbitSpeed * 0.025)
    .add(body.initialAngle)
    .sin()
    .mul(0.025)
    .add(0.975)

  material.colorNode = mix(color(shadow), color(highlight), latitude).mul(pulse)
  return material
}

function createSunMaterial() {
  const material = new THREE.MeshBasicNodeMaterial()
  const latitude = positionLocal.y.div(2.5).mul(0.5).add(0.5)
  const pulse = time.mul(1.15).sin().mul(0.08).add(0.92)
  material.colorNode = mix(
    color(new THREE.Color('#ff5a18')),
    color(new THREE.Color('#ffe29a')),
    latitude
  ).mul(pulse)
  return material
}

function LabSun() {
  const meshRef = useRef<THREE.Mesh>(null)
  const material = useMemo(() => createSunMaterial(), [])

  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.08
  })

  return (
    <group>
      <mesh ref={meshRef} material={material}>
        <sphereGeometry args={[2.5, 48, 32]} />
      </mesh>
      <pointLight
        color="#fff2c7"
        intensity={105}
        distance={120}
        decay={1.35}
      />
    </group>
  )
}

function LabPlanet({ body }: { body: PlanetData }) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const targetRef = useRef(new THREE.Vector3())
  const material = useMemo(() => createPlanetMaterial(body), [body])
  const ringMaterial = useMemo(() => {
    if (!body.hasRings) return null
    return new THREE.MeshBasicNodeMaterial({
      color: body.ringColor ?? body.color,
      transparent: true,
      opacity: body.ringOpacity ?? 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [body])

  useEffect(() => () => {
    material.dispose()
    ringMaterial?.dispose()
  }, [material, ringMaterial])

  useFrame((state, delta) => {
    const dateMs = LAB_START_DATE_MS
      + state.clock.elapsedTime * LAB_DAYS_PER_SECOND * 86_400_000

    if (groupRef.current) {
      groupRef.current.position.copy(
        getMajorPlanetVisualPosition(body, dateMs, 'explore', targetRef.current)
      )
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * Math.max(0.06, Math.abs(body.rotationSpeed) * 0.18)
    }
  })

  return (
    <group ref={groupRef}>
      <group rotation={[0, 0, THREE.MathUtils.degToRad(body.axialTilt)]}>
        <mesh ref={meshRef} material={material}>
          <sphereGeometry args={[body.radius, 32, 24]} />
        </mesh>

        {body.hasRings && ringMaterial ? (
          <mesh
            rotation={[Math.PI * 0.5, 0, 0]}
            material={ringMaterial}
          >
            <ringGeometry
              args={[
                body.ringInnerRadius ?? body.radius * 1.35,
                body.ringOuterRadius ?? body.radius * 2.1,
                72,
              ]}
            />
          </mesh>
        ) : null}
      </group>
    </group>
  )
}

function LabOrbitField() {
  const group = useMemo(() => {
    const orbitGroup = new THREE.Group()
    const dateMs = LAB_START_DATE_MS

    for (const body of planets) {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        getOrbitPoints(body.id, dateMs, 'explore', 128)
      )
      const material = new THREE.LineBasicMaterial({
        color: body.color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
      orbitGroup.add(new THREE.LineLoop(geometry, material))
    }

    return orbitGroup
  }, [])

  useEffect(() => () => {
    group.traverse((object) => {
      if (!(object instanceof THREE.Line)) return
      object.geometry.dispose()
      const material = object.material
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material.dispose()
    })
  }, [group])

  return <primitive object={group} />
}

function LabStars() {
  const points = useMemo(() => {
    let seed = 28_091
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647
      return (seed - 1) / 2_147_483_646
    }
    const count = 1_600
    const positions = new Float32Array(count * 3)

    for (let index = 0; index < count; index += 1) {
      const radius = 95 + random() * 75
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[index * 3 + 1] = radius * Math.cos(phi)
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({
      color: '#dbeafe',
      size: 0.24,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })

    return new THREE.Points(geometry, material)
  }, [])

  useEffect(() => () => {
    points.geometry.dispose()
    const material = points.material
    if (Array.isArray(material)) material.forEach((item) => item.dispose())
    else material.dispose()
  }, [points])

  return <primitive object={points} />
}

function readRendererCounters(state: RootState) {
  const renderer = state.gl as unknown as {
    info?: {
      render?: { calls?: number; triangles?: number }
      calls?: number
      triangles?: number
    }
  }
  const info = renderer.info

  return {
    drawCalls: info?.render?.calls ?? info?.calls ?? null,
    triangles: info?.render?.triangles ?? info?.triangles ?? null,
  }
}

function LabMetricsProbe({ onMetrics }: WebGPULabSceneProps) {
  const samplesRef = useRef<number[]>([])
  const lastPublishRef = useRef(0)

  useFrame((state, delta) => {
    const samples = samplesRef.current
    samples.push(delta * 1_000)
    if (samples.length > 180) samples.shift()

    const now = performance.now()
    if (samples.length < 30 || now - lastPublishRef.current < 500) return
    lastPublishRef.current = now

    const sorted = [...samples].sort((a, b) => a - b)
    const total = samples.reduce((sum, value) => sum + value, 0)
    const averageFrameMs = total / samples.length
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
    const counters = readRendererCounters(state)

    onMetrics({
      fps: averageFrameMs > 0 ? 1_000 / averageFrameMs : 0,
      averageFrameMs,
      p95FrameMs: sorted[p95Index] ?? averageFrameMs,
      longestFrameMs: sorted.at(-1) ?? averageFrameMs,
      samples: samples.length,
      ...counters,
    })
  })

  return null
}

export default function WebGPULabScene({ onMetrics }: WebGPULabSceneProps) {
  return (
    <>
      <color attach="background" args={['#02030a']} />
      <ambientLight color="#8fb8ff" intensity={0.22} />
      <LabStars />
      <LabOrbitField />
      <LabSun />
      {planets.map((body) => (
        <LabPlanet key={body.id} body={body} />
      ))}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.065}
        minDistance={5}
        maxDistance={145}
        zoomSpeed={0.85}
      />
      <LabMetricsProbe onMetrics={onMetrics} />
    </>
  )
}
