'use client'

import { useRef, useEffect } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

export default function NearEarthObjects() {
  const count = 1000
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const texture = useTexture('https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/moonmap1k.jpg')
  const bumpMap = useTexture('https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/moonbump1k.jpg')
  const showPhenomena = useSolarSystemStore((s) => s.showPhenomena)

  useEffect(() => {
    if (!meshRef.current) return
    const dummy = new THREE.Object3D()
    const random = seededRandom(67890)

    const innerRadius = 5
    const outerRadius = 8

    for (let i = 0; i < count; i++) {
      const distance = innerRadius + random() * (outerRadius - innerRadius)
      const angle = random() * Math.PI * 2
      const y = (random() - 0.5) * 0.5

      dummy.position.set(Math.cos(angle) * distance, y, Math.sin(angle) * distance)
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI)
      const baseScale = random() * 0.05 + 0.01
      dummy.scale.set(
        baseScale * (0.8 + random() * 0.6),
        baseScale * (0.8 + random() * 0.6),
        baseScale * (0.8 + random() * 0.6)
      )
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [])

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y -= 0.002
    }
  })

  if (!showPhenomena) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        map={texture}
        bumpMap={bumpMap}
        bumpScale={0.05}
        roughness={0.9}
        metalness={0.1}
        color="#aaaaaa"
      />
    </instancedMesh>
  )
}
