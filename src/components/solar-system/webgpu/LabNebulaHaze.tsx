'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import {
  color,
  mix,
  positionLocal,
  time,
} from 'three/tsl'

export const LAB_NEBULA_SYSTEM_IDS = [
  'tsl-nebula-inner',
  'tsl-nebula-outer',
] as const
export const LAB_NEBULA_SHELL_COUNT = 2

export interface LabNebulaDiagnostics {
  visualSystems: string[]
  shellCount: number
  animationMode: 'material-tsl'
  cpuVertexUpdates: false
  postProcessing: false
}

declare global {
  interface Window {
    __SOLAR_WEBGPU_LAB_NEBULA__?: LabNebulaDiagnostics
  }
}

if (typeof window !== 'undefined') {
  window.__SOLAR_WEBGPU_LAB_NEBULA__ = {
    visualSystems: [...LAB_NEBULA_SYSTEM_IDS],
    shellCount: LAB_NEBULA_SHELL_COUNT,
    animationMode: 'material-tsl',
    cpuVertexUpdates: false,
    postProcessing: false,
  }
}

interface NebulaShellDefinition {
  id: string
  radius: number
  phase: number
  speed: number
  opacity: number
  colorA: string
  colorB: string
  rotation: [number, number, number]
}

const SHELLS: NebulaShellDefinition[] = [
  {
    id: LAB_NEBULA_SYSTEM_IDS[0],
    radius: 118,
    phase: 0.7,
    speed: 0.018,
    opacity: 0.036,
    colorA: '#312e81',
    colorB: '#0e7490',
    rotation: [0.16, 0.48, -0.12],
  },
  {
    id: LAB_NEBULA_SYSTEM_IDS[1],
    radius: 154,
    phase: 2.35,
    speed: -0.011,
    opacity: 0.024,
    colorA: '#581c87',
    colorB: '#164e63',
    rotation: [-0.3, -0.66, 0.2],
  },
]

function createNebulaMaterial(shell: NebulaShellDefinition) {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })
  const xWave = positionLocal.x
    .mul(0.047)
    .add(time.mul(shell.speed))
    .add(shell.phase)
    .sin()
  const yWave = positionLocal.y
    .mul(0.061)
    .sub(time.mul(shell.speed * 0.62))
    .add(shell.phase * 0.73)
    .cos()
  const zWave = positionLocal.z
    .mul(0.039)
    .add(time.mul(shell.speed * 0.41))
    .add(shell.phase * 1.61)
    .sin()
  const density = xWave
    .mul(zWave)
    .add(yWave.mul(0.46))
    .abs()
    .pow(3.35)
  const detail = positionLocal.x
    .add(positionLocal.z.mul(0.7))
    .mul(0.026)
    .add(time.mul(shell.speed * -0.35))
    .sin()
    .mul(0.5)
    .add(0.5)
  const pulse = time
    .mul(Math.abs(shell.speed) * 8 + 0.08)
    .add(shell.phase)
    .sin()
    .mul(0.06)
    .add(0.94)

  material.colorNode = mix(
    color(shell.colorA),
    color(shell.colorB),
    detail
  ).mul(density.mul(0.72).add(0.28))
  material.opacityNode = density
    .mul(detail.mul(0.34).add(0.66))
    .mul(shell.opacity)
    .mul(pulse)
  return material
}

export default function LabTslNebulaHaze() {
  const shells = useMemo(() => SHELLS.map((definition) => ({
    definition,
    material: createNebulaMaterial(definition),
  })), [])

  useEffect(() => () => {
    shells.forEach(({ material }) => material.dispose())
  }, [shells])

  return (
    <group renderOrder={-30}>
      {shells.map(({ definition, material }) => (
        <mesh
          key={definition.id}
          material={material}
          rotation={definition.rotation}
          renderOrder={-30}
        >
          <sphereGeometry args={[definition.radius, 48, 32]} />
        </mesh>
      ))}
    </group>
  )
}
