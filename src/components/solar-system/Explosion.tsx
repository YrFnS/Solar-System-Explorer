'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'

interface ExplosionProps {
  position: [number, number, number]
  color: string
  onComplete?: () => void
}

export default function Explosion({ position, color, onComplete }: ExplosionProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  const startTime = useRef(Date.now())

  const texture = useMemo(() => {
    // Create a simple glow texture
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.3, 'rgba(255,200,100,0.8)')
    gradient.addColorStop(0.7, 'rgba(255,100,50,0.4)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(canvas)
    return tex
  }, [])

  useFrame(() => {
    const elapsed = (Date.now() - startTime.current) / 1000

    if (meshRef.current) {
      const scale = 1 + elapsed * 15
      meshRef.current.scale.set(scale, scale, scale)
    }

    if (materialRef.current) {
      materialRef.current.opacity = Math.max(0, 1 - elapsed * 0.5)
    }

    if (elapsed > 2 && onComplete) {
      onComplete()
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          ref={materialRef}
          color={color}
          map={texture}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <Sparkles
        count={100}
        scale={10}
        size={5}
        speed={0.5}
        color={color}
      />
    </group>
  )
}
