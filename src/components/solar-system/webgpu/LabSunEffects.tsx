'use client'

import { useEffect, useMemo } from 'react'
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
  time,
} from 'three/tsl'

export const LAB_SUN_EFFECT_IDS = [
  'tsl-sun-corona',
  'tsl-sun-glow',
  'tsl-sun-flares',
] as const
export const LAB_SUN_FLARE_ARCS = 5

export interface LabSunEffectsDiagnostics {
  visualSystems: string[]
  flareArcs: number
  animationMode: 'material-tsl'
  cpuVertexUpdates: false
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_LAB_SUN__?: LabSunEffectsDiagnostics
  }
}

if (typeof window !== 'undefined') {
  window.__SOLAR_WEBGPU_LAB_SUN__ = {
    visualSystems: [...LAB_SUN_EFFECT_IDS],
    flareArcs: LAB_SUN_FLARE_ARCS,
    animationMode: 'material-tsl',
    cpuVertexUpdates: false,
  }
}

function createCoronaMaterial() {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const viewDirection = normalize(cameraPosition.sub(positionWorld))
  const rim = float(1)
    .sub(dot(normalWorld, viewDirection).abs())
    .pow(1.55)
  const latitudeWave = positionLocal.y
    .mul(4.3)
    .add(time.mul(0.88))
    .sin()
    .mul(0.5)
    .add(0.5)
  const pulse = time.mul(1.2).sin().mul(0.055).add(0.945)

  material.colorNode = mix(
    color('#ff4d12'),
    color('#ffe39a'),
    rim.mul(0.68).add(latitudeWave.mul(0.32))
  ).mul(pulse)
  material.opacityNode = rim
    .mul(latitudeWave.mul(0.24).add(0.76))
    .mul(0.42)
    .mul(pulse)
  return material
}

function createGlowMaterial() {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })
  const viewDirection = normalize(cameraPosition.sub(positionWorld))
  const rim = float(1)
    .sub(dot(normalWorld, viewDirection).abs())
    .pow(2.7)
  const slowPulse = time.mul(0.55).sin().mul(0.05).add(0.95)

  material.colorNode = mix(
    color('#ff6a00'),
    color('#fff2bd'),
    rim
  ).mul(slowPulse)
  material.opacityNode = rim.mul(0.2).mul(slowPulse)
  return material
}

function createFlareMaterial(phase: number) {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const sweep = positionLocal.x
    .mul(2.1)
    .add(time.mul(0.72))
    .add(phase)
    .sin()
    .mul(0.5)
    .add(0.5)
  const pulse = time
    .mul(0.86 + phase * 0.035)
    .add(phase)
    .sin()
    .mul(0.5)
    .add(0.5)
    .pow(1.6)

  material.colorNode = mix(
    color('#ff6a00'),
    color('#fff5bf'),
    sweep.mul(0.74).add(0.18)
  ).mul(pulse.mul(0.25).add(0.82))
  material.opacityNode = sweep
    .pow(1.8)
    .mul(pulse.mul(0.72).add(0.28))
    .mul(0.3)
  return material
}

interface LabTslSunEffectsProps {
  radius: number
}

export default function LabTslSunEffects({ radius }: LabTslSunEffectsProps) {
  const coronaMaterial = useMemo(() => createCoronaMaterial(), [])
  const glowMaterial = useMemo(() => createGlowMaterial(), [])
  const flareArcs = useMemo(() => {
    const rotations: Array<[number, number, number]> = [
      [0.15, 0.2, 0.35],
      [1.05, -0.45, 1.4],
      [-0.75, 0.9, -0.2],
      [0.55, 1.35, 2.15],
      [-1.15, -0.75, 0.9],
    ]

    return rotations.map((rotation, index) => ({
      id: `flare-${index}`,
      rotation,
      geometry: new THREE.TorusGeometry(
        radius * (1.065 + index * 0.022),
        radius * (0.012 + index * 0.0015),
        6,
        72,
        Math.PI * (0.48 + index * 0.055)
      ),
      material: createFlareMaterial(index * 1.37),
    }))
  }, [radius])

  useEffect(() => () => {
    coronaMaterial.dispose()
    glowMaterial.dispose()
    flareArcs.forEach((arc) => {
      arc.geometry.dispose()
      arc.material.dispose()
    })
  }, [coronaMaterial, flareArcs, glowMaterial])

  return (
    <>
      <mesh material={coronaMaterial} scale={1.13} renderOrder={5}>
        <sphereGeometry args={[radius, 52, 36]} />
      </mesh>
      <mesh material={glowMaterial} scale={1.48} renderOrder={3}>
        <sphereGeometry args={[radius, 40, 28]} />
      </mesh>
      <group renderOrder={6}>
        {flareArcs.map((arc) => (
          <mesh
            key={arc.id}
            geometry={arc.geometry}
            material={arc.material}
            rotation={arc.rotation}
            renderOrder={6}
          />
        ))}
      </group>
    </>
  )
}
