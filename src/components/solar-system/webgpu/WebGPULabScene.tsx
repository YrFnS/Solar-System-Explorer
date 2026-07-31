'use client'

import { useEffect, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, type RootState } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import {
  cameraPosition,
  color,
  dot,
  float,
  mix,
  normalWorld,
  normalize,
  positionLocal,
  positionWorld,
  texture as textureNode,
  time,
} from 'three/tsl'
import { planets, sunData, type PlanetData } from '../data'
import { getMajorPlanetVisualPosition, getOrbitPoints } from '../ephemeris'
import {
  LabTslSolarWind,
  LabTslStarField,
} from './LabParticleFields'
import { useLabTextureStore } from './lab-texture-store'
import { useLabKtx2Texture } from './useLabKtx2Texture'

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

function createPlanetMaterial(body: PlanetData, map: THREE.Texture | null) {
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
    .mul(0.018)
    .add(0.982)

  const surface = map
    ? mix(textureNode(map).rgb, color(base), 0.035)
    : mix(color(shadow), color(highlight), latitude)
  material.colorNode = surface.mul(pulse)
  return material
}

function createSunMaterial(map: THREE.Texture | null) {
  const material = new THREE.MeshBasicNodeMaterial()
  const latitude = positionLocal.y.div(2.5).mul(0.5).add(0.5)
  const pulse = time.mul(1.15).sin().mul(0.06).add(0.94)
  const procedural = mix(
    color(new THREE.Color('#ff5a18')),
    color(new THREE.Color('#ffe29a')),
    latitude
  )

  material.colorNode = (map ? textureNode(map).rgb : procedural).mul(pulse)
  return material
}

function createAtmosphereMaterial(body: PlanetData) {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const viewDirection = normalize(cameraPosition.sub(positionWorld))
  const rim = float(1)
    .sub(dot(normalWorld, viewDirection).abs())
    .pow(2.35)
  const pulse = time
    .mul(0.18 + body.orbitSpeed * 0.01)
    .sin()
    .mul(0.04)
    .add(0.96)
  const intensity = body.id === 'earth'
    ? 0.72
    : body.id === 'venus'
      ? 0.58
      : body.type.includes('Giant')
        ? 0.32
        : 0.4

  material.colorNode = color(body.atmosphereColor ?? body.color)
    .mul(rim.mul(1.45).add(0.18))
    .mul(pulse)
  material.opacityNode = rim.mul(intensity).mul(pulse)
  return material
}

function createCloudMaterial(map: THREE.Texture) {
  const sample = textureNode(map)
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  material.colorNode = sample.rgb.mul(1.12)
  material.opacityNode = sample.a.mul(0.58)
  return material
}

function LabSun() {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useLabKtx2Texture(sunData.textureUrl ?? '/textures/sun.jpg')
  const material = useMemo(() => createSunMaterial(texture), [texture])

  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.08
  })

  return (
    <group>
      <mesh ref={meshRef} material={material}>
        <sphereGeometry args={[2.5, 64, 40]} />
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

function LabAtmosphere({ body }: { body: PlanetData }) {
  const material = useMemo(() => createAtmosphereMaterial(body), [body])
  const scale = Math.max(
    1.035,
    Math.min(1.14, body.atmosphereScale ?? (body.type.includes('Giant') ? 1.045 : 1.07))
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh material={material} scale={scale}>
      <sphereGeometry args={[body.radius, 40, 28]} />
    </mesh>
  )
}

function LabEarthClouds({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useLabKtx2Texture('/textures/earth-clouds.svg')
  const material = useMemo(
    () => texture ? createCloudMaterial(texture) : null,
    [texture]
  )

  useEffect(() => () => material?.dispose(), [material])

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.055
  })

  if (!material) return null

  return (
    <mesh ref={meshRef} material={material} scale={1.012}>
      <sphereGeometry args={[radius, 48, 32]} />
    </mesh>
  )
}

function LabRings({ body }: { body: PlanetData }) {
  const innerRadius = body.ringInnerRadius ?? body.radius * 1.35
  const outerRadius = body.ringOuterRadius ?? body.radius * 2.1
  const opacity = body.ringOpacity ?? 0.45
  const texture = useLabKtx2Texture(body.ringTextureUrl ?? '/textures/saturn_ring.png')

  const geometry = useMemo(() => {
    const nextGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 112, 3)
    const position = nextGeometry.attributes.position
    const uv = nextGeometry.attributes.uv
    const point = new THREE.Vector3()

    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index)
      const radius = point.length()
      const u = (radius - innerRadius) / Math.max(0.0001, outerRadius - innerRadius)
      uv.setXY(index, u, 0.5)
    }

    return nextGeometry
  }, [innerRadius, outerRadius])

  const material = useMemo(() => {
    const nextMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    if (texture) {
      const sample = textureNode(texture)
      nextMaterial.colorNode = sample.rgb
      nextMaterial.opacityNode = sample.a.mul(opacity * 1.45)
    } else {
      nextMaterial.colorNode = color(body.ringColor ?? body.color)
      nextMaterial.opacityNode = float(opacity)
    }

    return nextMaterial
  }, [body.color, body.ringColor, opacity, texture])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[Math.PI * 0.5, 0, 0]}
      renderOrder={2}
    />
  )
}

function LabPlanet({ body }: { body: PlanetData }) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const targetRef = useRef(new THREE.Vector3())
  const texture = useLabKtx2Texture(body.textureUrl ?? '')
  const material = useMemo(() => createPlanetMaterial(body, texture), [body, texture])

  useEffect(() => () => material.dispose(), [material])

  useFrame((state, delta) => {
    const dateMs = LAB_START_DATE_MS
      + state.clock.elapsedTime * LAB_DAYS_PER_SECOND * 86_400_000

    if (groupRef.current) {
      groupRef.current.position.copy(
        getMajorPlanetVisualPosition(body, dateMs, 'explore', targetRef.current)
      )
    }
    if (meshRef.current) {
      const direction = body.rotationSpeed < 0 ? -1 : 1
      meshRef.current.rotation.y += direction
        * delta
        * Math.max(0.06, Math.abs(body.rotationSpeed) * 0.18)
    }
  })

  return (
    <group ref={groupRef}>
      <group rotation={[0, 0, THREE.MathUtils.degToRad(body.axialTilt)]}>
        <mesh ref={meshRef} material={material}>
          <sphereGeometry args={[body.radius, 48, 32]} />
        </mesh>

        {body.id === 'earth' ? <LabEarthClouds radius={body.radius} /> : null}
        {body.hasAtmosphere && body.atmosphereColor ? <LabAtmosphere body={body} /> : null}
        {body.hasRings ? <LabRings body={body} /> : null}
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
  const readyRef = useRef(false)
  const textureBackend = useLabTextureStore((state) => state.backend)

  useFrame((state, delta) => {
    if (textureBackend !== 'ktx2') {
      samplesRef.current = []
      lastPublishRef.current = 0
      readyRef.current = false
      return
    }

    if (!readyRef.current) {
      readyRef.current = true
      samplesRef.current = []
      lastPublishRef.current = performance.now()
      return
    }

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
      <LabTslStarField />
      <LabOrbitField />
      <LabSun />
      <LabTslSolarWind />
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
