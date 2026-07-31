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

export const LAB_GRAVITY_SYSTEM_IDS = [
  'tsl-black-hole-shadow',
  'tsl-black-hole-accretion',
  'tsl-black-hole-photon-ring',
  'tsl-wormhole-mouths',
  'tsl-wormhole-throat',
  'tsl-wormhole-rims',
] as const
export const LAB_GRAVITY_OBJECT_COUNT = 2
export const LAB_BLACK_HOLE_COUNT = 1
export const LAB_ACCRETION_DISC_COUNT = 2
export const LAB_WORMHOLE_COUNT = 1
export const LAB_WORMHOLE_MOUTH_COUNT = 2

export interface LabGravityDiagnostics {
  visualSystems: string[]
  objectCount: number
  blackHoleCount: number
  accretionDiscCount: number
  wormholeCount: number
  wormholeMouthCount: number
  animationMode: 'material-tsl'
  cpuVertexUpdates: false
  postProcessing: false
  screenSpaceDistortion: false
}

interface GravityWindow extends Window {
  __SOLAR_WEBGPU_LAB_GRAVITY__?: LabGravityDiagnostics
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_LAB_GRAVITY__?: LabGravityDiagnostics
  }
}

function createBlackHoleCoreMaterial() {
  const material = new THREE.MeshBasicNodeMaterial()
  material.colorNode = color('#000000')
  return material
}

function createBlackHoleHaloMaterial() {
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
    .pow(2.2)
  const pulse = time.mul(0.58).sin().mul(0.045).add(0.955)

  material.colorNode = mix(
    color('#3a0900'),
    color('#ff9f55'),
    rim
  ).mul(pulse)
  material.opacityNode = rim.mul(0.28).mul(pulse)
  return material
}

function createAccretionMaterial(phase: number, opacity: number) {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })
  const sweep = positionLocal.x
    .mul(1.65)
    .add(positionLocal.y.mul(0.92))
    .add(time.mul(1.08))
    .add(phase)
    .sin()
    .mul(0.5)
    .add(0.5)
  const turbulence = positionLocal.x
    .mul(positionLocal.y)
    .mul(0.46)
    .sub(time.mul(0.64))
    .add(phase * 1.73)
    .cos()
    .mul(0.5)
    .add(0.5)
  const heat = sweep
    .mul(0.66)
    .add(turbulence.mul(0.34))
    .pow(1.45)
  const pulse = time
    .mul(0.43 + phase * 0.012)
    .add(phase)
    .sin()
    .mul(0.04)
    .add(0.96)

  material.colorNode = mix(
    color('#c92f00'),
    color('#fff4c7'),
    heat
  ).mul(heat.mul(0.48).add(0.78)).mul(pulse)
  material.opacityNode = heat
    .mul(0.58)
    .add(0.12)
    .mul(opacity)
    .mul(pulse)
  return material
}

function createPhotonRingMaterial() {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })
  const sweep = positionLocal.x
    .mul(2.2)
    .add(positionLocal.z.mul(1.35))
    .add(time.mul(1.18))
    .sin()
    .mul(0.5)
    .add(0.5)
    .pow(1.7)
  const pulse = time.mul(0.92).sin().mul(0.07).add(0.93)

  material.colorNode = mix(
    color('#ff6b00'),
    color('#fffbdc'),
    sweep
  ).mul(pulse)
  material.opacityNode = sweep.mul(0.42).add(0.5).mul(pulse)
  return material
}

function createWormholeMouthMaterial(phase: number, direction: 1 | -1) {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })
  const armA = positionLocal.x
    .mul(2.25)
    .add(positionLocal.y.mul(1.15))
    .add(time.mul(1.22 * direction))
    .add(phase)
    .sin()
    .mul(0.5)
    .add(0.5)
  const armB = positionLocal.x
    .mul(positionLocal.y)
    .mul(0.82)
    .sub(time.mul(0.58 * direction))
    .add(phase * 1.51)
    .cos()
    .mul(0.5)
    .add(0.5)
  const field = armA
    .mul(0.62)
    .add(armB.mul(0.38))
    .pow(1.55)
  const pulse = time
    .mul(0.72)
    .add(phase)
    .sin()
    .mul(0.06)
    .add(0.94)

  material.colorNode = mix(
    color('#3f0a7a'),
    color('#8cecff'),
    field
  ).mul(field.mul(0.35).add(0.78)).mul(pulse)
  material.opacityNode = field
    .mul(0.54)
    .add(0.1)
    .mul(pulse)
  return material
}

function createWormholeRimMaterial(phase: number) {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })
  const sweep = positionLocal.x
    .mul(1.8)
    .add(positionLocal.y.mul(1.3))
    .add(time.mul(0.84))
    .add(phase)
    .sin()
    .mul(0.5)
    .add(0.5)
  const pulse = time.mul(0.63).add(phase).sin().mul(0.08).add(0.92)

  material.colorNode = mix(
    color('#5a27d4'),
    color('#c9fbff'),
    sweep
  ).mul(pulse)
  material.opacityNode = sweep.mul(0.38).add(0.48).mul(pulse)
  return material
}

function createWormholeThroatMaterial() {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })
  const flow = positionLocal.y
    .mul(2.65)
    .sub(time.mul(1.06))
    .sin()
    .mul(0.5)
    .add(0.5)
  const twist = positionLocal.x
    .add(positionLocal.z.mul(0.78))
    .mul(1.35)
    .add(time.mul(0.57))
    .cos()
    .mul(0.5)
    .add(0.5)
  const field = flow.mul(0.64).add(twist.mul(0.36))
  const pulse = time.mul(0.48).sin().mul(0.05).add(0.95)

  material.colorNode = mix(
    color('#23054d'),
    color('#55d8ff'),
    field
  ).mul(pulse)
  material.opacityNode = field
    .mul(0.18)
    .add(0.075)
    .mul(pulse)
  return material
}

function LabBlackHole() {
  const assets = useMemo(() => ({
    coreGeometry: new THREE.SphereGeometry(1.72, 40, 28),
    haloGeometry: new THREE.SphereGeometry(2.6, 38, 26),
    diskGeometryA: new THREE.RingGeometry(2.15, 6.4, 144, 4),
    diskGeometryB: new THREE.RingGeometry(2.75, 5.75, 128, 3),
    photonGeometry: new THREE.TorusGeometry(2.28, 0.09, 10, 96),
    coreMaterial: createBlackHoleCoreMaterial(),
    haloMaterial: createBlackHoleHaloMaterial(),
    diskMaterialA: createAccretionMaterial(0.35, 0.62),
    diskMaterialB: createAccretionMaterial(2.1, 0.34),
    photonMaterial: createPhotonRingMaterial(),
  }), [])

  useEffect(() => () => {
    assets.coreGeometry.dispose()
    assets.haloGeometry.dispose()
    assets.diskGeometryA.dispose()
    assets.diskGeometryB.dispose()
    assets.photonGeometry.dispose()
    assets.coreMaterial.dispose()
    assets.haloMaterial.dispose()
    assets.diskMaterialA.dispose()
    assets.diskMaterialB.dispose()
    assets.photonMaterial.dispose()
  }, [assets])

  return (
    <group position={[46, 12, -43]} rotation={[0.18, -0.42, 0.08]} renderOrder={8}>
      <mesh geometry={assets.haloGeometry} material={assets.haloMaterial} renderOrder={7} />
      <mesh geometry={assets.coreGeometry} material={assets.coreMaterial} renderOrder={9} />
      <mesh
        geometry={assets.diskGeometryA}
        material={assets.diskMaterialA}
        rotation={[Math.PI / 2 - 0.12, 0.22, 0.08]}
        renderOrder={8}
      />
      <mesh
        geometry={assets.diskGeometryB}
        material={assets.diskMaterialB}
        rotation={[Math.PI / 2 + 0.16, -0.28, 0.14]}
        renderOrder={8}
      />
      <mesh
        geometry={assets.photonGeometry}
        material={assets.photonMaterial}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={10}
      />
    </group>
  )
}

function LabWormhole() {
  const assets = useMemo(() => ({
    mouthGeometry: new THREE.CircleGeometry(3.15, 96),
    rimGeometry: new THREE.TorusGeometry(3.18, 0.16, 10, 96),
    outerRimGeometry: new THREE.TorusGeometry(3.72, 0.045, 8, 96),
    throatGeometry: new THREE.CylinderGeometry(1.58, 1.58, 5.4, 48, 18, true),
    mouthMaterialA: createWormholeMouthMaterial(0.4, 1),
    mouthMaterialB: createWormholeMouthMaterial(2.45, -1),
    rimMaterialA: createWormholeRimMaterial(0.6),
    rimMaterialB: createWormholeRimMaterial(2.8),
    outerRimMaterial: createWormholeRimMaterial(4.2),
    throatMaterial: createWormholeThroatMaterial(),
  }), [])

  useEffect(() => () => {
    assets.mouthGeometry.dispose()
    assets.rimGeometry.dispose()
    assets.outerRimGeometry.dispose()
    assets.throatGeometry.dispose()
    assets.mouthMaterialA.dispose()
    assets.mouthMaterialB.dispose()
    assets.rimMaterialA.dispose()
    assets.rimMaterialB.dispose()
    assets.outerRimMaterial.dispose()
    assets.throatMaterial.dispose()
  }, [assets])

  return (
    <group position={[-48, -7, 45]} rotation={[0.22, -0.58, 0.16]} renderOrder={8}>
      <mesh
        geometry={assets.throatGeometry}
        material={assets.throatMaterial}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={7}
      />
      <mesh
        geometry={assets.mouthGeometry}
        material={assets.mouthMaterialA}
        position={[0, 0, 2.7]}
        renderOrder={9}
      />
      <mesh
        geometry={assets.mouthGeometry}
        material={assets.mouthMaterialB}
        position={[0, 0, -2.7]}
        rotation={[0, Math.PI, 0]}
        renderOrder={9}
      />
      <mesh
        geometry={assets.rimGeometry}
        material={assets.rimMaterialA}
        position={[0, 0, 2.72]}
        renderOrder={10}
      />
      <mesh
        geometry={assets.rimGeometry}
        material={assets.rimMaterialB}
        position={[0, 0, -2.72]}
        renderOrder={10}
      />
      <mesh
        geometry={assets.outerRimGeometry}
        material={assets.outerRimMaterial}
        position={[0, 0, 2.74]}
        renderOrder={8}
      />
      <mesh
        geometry={assets.outerRimGeometry}
        material={assets.outerRimMaterial}
        position={[0, 0, -2.74]}
        renderOrder={8}
      />
    </group>
  )
}

export default function LabTslGravitationalObjects() {
  const diagnostics = useMemo<LabGravityDiagnostics>(() => ({
    visualSystems: [...LAB_GRAVITY_SYSTEM_IDS],
    objectCount: LAB_GRAVITY_OBJECT_COUNT,
    blackHoleCount: LAB_BLACK_HOLE_COUNT,
    accretionDiscCount: LAB_ACCRETION_DISC_COUNT,
    wormholeCount: LAB_WORMHOLE_COUNT,
    wormholeMouthCount: LAB_WORMHOLE_MOUTH_COUNT,
    animationMode: 'material-tsl',
    cpuVertexUpdates: false,
    postProcessing: false,
    screenSpaceDistortion: false,
  }), [])

  useEffect(() => {
    const target = window as GravityWindow
    target.__SOLAR_WEBGPU_LAB_GRAVITY__ = diagnostics

    return () => {
      if (target.__SOLAR_WEBGPU_LAB_GRAVITY__ === diagnostics) {
        delete target.__SOLAR_WEBGPU_LAB_GRAVITY__
      }
    }
  }, [diagnostics])

  return (
    <>
      <LabBlackHole />
      <LabWormhole />
    </>
  )
}
