'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

const OORT_CLOUD_COUNT = 800
const OORT_CLOUD_INNER_RADIUS = 65
const OORT_CLOUD_OUTER_RADIUS = 80

interface OortParticleInfo {
  theta: number
  phi: number
  radius: number
  rotSpeed: number
}

export default function OortCloud() {
  const showKuiperBelt = useSolarSystemStore((s) => s.showKuiperBelt)

  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Generate spherical particle data
  const particleDataRef = useRef<OortParticleInfo[]>([])
  if (particleDataRef.current.length === 0) {
    for (let i = 0; i < OORT_CLOUD_COUNT; i++) {
      particleDataRef.current.push({
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(2 * Math.random() - 1), // uniform sphere distribution
        radius: OORT_CLOUD_INNER_RADIUS + Math.random() * (OORT_CLOUD_OUTER_RADIUS - OORT_CLOUD_INNER_RADIUS),
        rotSpeed: (Math.random() - 0.5) * 0.003, // very slow random rotation
      })
    }
  }

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const data = particleDataRef.current

    for (let i = 0; i < OORT_CLOUD_COUNT; i++) {
      const p = data[i]
      p.theta += delta * p.rotSpeed * timeSpeed

      const sinPhi = Math.sin(p.phi)
      const cosPhi = Math.cos(p.phi)
      const sinTheta = Math.sin(p.theta)
      const cosTheta = Math.cos(p.theta)

      dummy.position.set(
        cosTheta * sinPhi * p.radius,
        cosPhi * p.radius,
        sinTheta * sinPhi * p.radius
      )
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (!showKuiperBelt) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, OORT_CLOUD_COUNT]}>
      <icosahedronGeometry args={[0.08, 0]} />
      <meshBasicMaterial
        color="#C8D8E8"
        transparent
        opacity={0.3}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
