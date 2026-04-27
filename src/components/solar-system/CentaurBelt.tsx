'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

interface ParticleInfo {
  angle: number
  radius: number
  y: number
  speed: number
  scale: number
  rotX: number
  rotY: number
  rotZ: number
  rotSpeedX: number
  rotSpeedY: number
  rotSpeedZ: number
}

const CENTAUR_INNER = 5.2  // Jupiter's orbit in AU
const CENTAUR_OUTER = 30   // Neptune's orbit in AU
const CENTAUR_COUNT = 2000
const TEXTURE_URL = 'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/moonmap1k.jpg'

function CentaurBeltInner() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return loader.load(TEXTURE_URL)
  }, [])

  const particleDataRef = useRef<ParticleInfo[]>([])
  if (particleDataRef.current.length === 0) {
    for (let i = 0; i < CENTAUR_COUNT; i++) {
      particleDataRef.current.push({
        angle: Math.random() * Math.PI * 2,
        radius: CENTAUR_INNER + Math.random() * (CENTAUR_OUTER - CENTAUR_INNER),
        y: (Math.random() - 0.5) * 2.0,
        speed: 0.005 + Math.random() * 0.01,
        scale: 0.3 + Math.random() * 1.2,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedX: (Math.random() - 0.5) * 0.3,
        rotSpeedY: (Math.random() - 0.5) * 0.3,
        rotSpeedZ: (Math.random() - 0.5) * 0.3,
      })
    }
  }

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const timeSpeed = useSolarSystemStore.getState().timeSpeed
    const data = particleDataRef.current

    for (let i = 0; i < CENTAUR_COUNT; i++) {
      const p = data[i]
      p.angle += delta * p.speed * timeSpeed

      dummy.position.set(
        Math.cos(p.angle) * p.radius,
        p.y,
        Math.sin(p.angle) * p.radius
      )
      dummy.scale.setScalar(p.scale * 0.05)
      p.rotX += delta * p.rotSpeedX * timeSpeed
      p.rotY += delta * p.rotSpeedY * timeSpeed
      p.rotZ += delta * p.rotSpeedZ * timeSpeed
      dummy.rotation.set(p.rotX, p.rotY, p.rotZ)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CENTAUR_COUNT]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.8}
        metalness={0.1}
        transparent
        opacity={0.8}
      />
    </instancedMesh>
  )
}

export default function CentaurBelt() {
  const showCentaurs = useSolarSystemStore((s) => s.showCentaurs)

  if (!showCentaurs) return null

  return <CentaurBeltInner />
}