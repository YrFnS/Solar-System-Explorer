'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import {
  color,
  float,
  instancedBufferAttribute,
  mix,
  mod,
  shapeCircle,
  time,
} from 'three/tsl'

export const LAB_STAR_COUNT = 1_600
export const LAB_SOLAR_WIND_COUNT = 320
export const LAB_VISUAL_SYSTEMS = [
  'tsl-star-field',
  'tsl-solar-wind',
] as const

export interface LabEffectsDiagnostics {
  visualSystems: string[]
  starCount: number
  solarWindCount: number
  animationMode: 'vertex-tsl'
  cpuPositionUpdates: false
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_LAB_EFFECTS__?: LabEffectsDiagnostics
  }
}

if (typeof window !== 'undefined') {
  window.__SOLAR_WEBGPU_LAB_EFFECTS__ = {
    visualSystems: [...LAB_VISUAL_SYSTEMS],
    starCount: LAB_STAR_COUNT,
    solarWindCount: LAB_SOLAR_WIND_COUNT,
    animationMode: 'vertex-tsl',
    cpuPositionUpdates: false,
  }
}

function seededRandom(initialSeed: number) {
  let seed = initialSeed
  return () => {
    seed = (seed * 16_807) % 2_147_483_647
    return (seed - 1) / 2_147_483_646
  }
}

function createInstancedSprite(
  material: THREE.PointsNodeMaterial,
  count: number
) {
  const sprite = new THREE.Sprite(material) as THREE.Sprite & { count: number }
  sprite.count = count
  sprite.frustumCulled = false
  return sprite
}

function createStarField() {
  const random = seededRandom(28_091)
  const positions = new Float32Array(LAB_STAR_COUNT * 3)
  const colors = new Float32Array(LAB_STAR_COUNT * 3)
  const sizes = new Float32Array(LAB_STAR_COUNT)
  const phases = new Float32Array(LAB_STAR_COUNT)
  const starColor = new THREE.Color()

  for (let index = 0; index < LAB_STAR_COUNT; index += 1) {
    const radius = 95 + random() * 75
    const theta = random() * Math.PI * 2
    const phi = Math.acos(2 * random() - 1)
    const sinPhi = Math.sin(phi)
    const offset = index * 3

    positions[offset] = radius * sinPhi * Math.cos(theta)
    positions[offset + 1] = radius * Math.cos(phi)
    positions[offset + 2] = radius * sinPhi * Math.sin(theta)

    const warmth = random()
    starColor.setHSL(
      0.56 + warmth * 0.09,
      0.3 + random() * 0.25,
      0.72 + random() * 0.2,
      THREE.SRGBColorSpace
    )
    colors[offset] = starColor.r
    colors[offset + 1] = starColor.g
    colors[offset + 2] = starColor.b
    sizes[index] = 1.2 + random() * 2.7
    phases[index] = random() * Math.PI * 2
  }

  const positionAttribute = new THREE.InstancedBufferAttribute(positions, 3)
  const colorAttribute = new THREE.InstancedBufferAttribute(colors, 3)
  const sizeAttribute = new THREE.InstancedBufferAttribute(sizes, 1)
  const phaseAttribute = new THREE.InstancedBufferAttribute(phases, 1)
  const phaseNode = instancedBufferAttribute(phaseAttribute)
  const twinkle = time
    .mul(0.82)
    .add(phaseNode)
    .sin()
    .mul(0.28)
    .add(0.72)
  const material = new THREE.PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    alphaToCoverage: true,
  })

  material.positionNode = instancedBufferAttribute(positionAttribute)
  material.colorNode = instancedBufferAttribute(colorAttribute)
    .mul(twinkle.mul(0.34).add(0.76))
  material.opacityNode = shapeCircle()
    .mul(twinkle.mul(0.55).add(0.32))
  material.sizeNode = instancedBufferAttribute(sizeAttribute)
    .mul(twinkle.mul(0.3).add(0.82))

  const sprite = createInstancedSprite(material, LAB_STAR_COUNT)
  sprite.renderOrder = -20
  return sprite
}

function createSolarWindField() {
  const random = seededRandom(91_277)
  const directions = new Float32Array(LAB_SOLAR_WIND_COUNT * 3)
  const tangents = new Float32Array(LAB_SOLAR_WIND_COUNT * 3)
  const phases = new Float32Array(LAB_SOLAR_WIND_COUNT)
  const speeds = new Float32Array(LAB_SOLAR_WIND_COUNT)
  const sizes = new Float32Array(LAB_SOLAR_WIND_COUNT)
  const temperatures = new Float32Array(LAB_SOLAR_WIND_COUNT)
  const direction = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const reference = new THREE.Vector3()

  for (let index = 0; index < LAB_SOLAR_WIND_COUNT; index += 1) {
    const theta = random() * Math.PI * 2
    const y = random() * 2 - 1
    const horizontal = Math.sqrt(Math.max(0, 1 - y * y))
    direction.set(
      horizontal * Math.cos(theta),
      y,
      horizontal * Math.sin(theta)
    )

    reference.set(0, 1, 0)
    if (Math.abs(direction.y) > 0.9) reference.set(1, 0, 0)
    tangent.crossVectors(direction, reference).normalize()

    const offset = index * 3
    directions[offset] = direction.x
    directions[offset + 1] = direction.y
    directions[offset + 2] = direction.z
    tangents[offset] = tangent.x
    tangents[offset + 1] = tangent.y
    tangents[offset + 2] = tangent.z
    phases[index] = random()
    speeds[index] = 0.045 + random() * 0.055
    sizes[index] = 2.1 + random() * 3.6
    temperatures[index] = random()
  }

  const directionAttribute = new THREE.InstancedBufferAttribute(directions, 3)
  const tangentAttribute = new THREE.InstancedBufferAttribute(tangents, 3)
  const phaseAttribute = new THREE.InstancedBufferAttribute(phases, 1)
  const speedAttribute = new THREE.InstancedBufferAttribute(speeds, 1)
  const sizeAttribute = new THREE.InstancedBufferAttribute(sizes, 1)
  const temperatureAttribute = new THREE.InstancedBufferAttribute(temperatures, 1)

  const directionNode = instancedBufferAttribute(directionAttribute)
  const tangentNode = instancedBufferAttribute(tangentAttribute)
  const phaseNode = instancedBufferAttribute(phaseAttribute)
  const speedNode = instancedBufferAttribute(speedAttribute)
  const temperatureNode = instancedBufferAttribute(temperatureAttribute)
  const progress = mod(time.mul(speedNode).add(phaseNode), 1)
  const radius = progress.mul(31).add(2.7)
  const spiral = time
    .mul(0.72)
    .add(phaseNode.mul(Math.PI * 2))
    .sin()
    .mul(progress.mul(0.42).add(0.08))
  const remaining = float(1).sub(progress)
  const material = new THREE.PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    alphaToCoverage: true,
  })

  material.positionNode = directionNode
    .mul(radius)
    .add(tangentNode.mul(spiral))
  material.colorNode = mix(
    color('#fff2a8'),
    color('#7dd3fc'),
    progress.mul(0.72).add(temperatureNode.mul(0.28))
  ).mul(remaining.mul(0.42).add(0.72))
  material.opacityNode = shapeCircle()
    .mul(remaining.pow(1.35))
    .mul(0.76)
  material.sizeNode = instancedBufferAttribute(sizeAttribute)
    .mul(remaining.mul(0.48).add(0.52))

  const sprite = createInstancedSprite(material, LAB_SOLAR_WIND_COUNT)
  sprite.renderOrder = 4
  return sprite
}

export function LabTslStarField() {
  const sprite = useMemo(() => createStarField(), [])

  useEffect(() => () => {
    sprite.material.dispose()
  }, [sprite])

  return <primitive object={sprite} />
}

export function LabTslSolarWind() {
  const sprite = useMemo(() => createSolarWindField(), [])

  useEffect(() => () => {
    sprite.material.dispose()
  }, [sprite])

  return <primitive object={sprite} />
}
