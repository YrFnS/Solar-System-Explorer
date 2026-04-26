'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

interface OrbitalTrailProps {
  orbitRadius: number
  color: string
  orbitAngleRef: React.RefObject<number>
}

// Number of points along the trail arc
const TRAIL_POINTS = 80
// Show the last 20% of the orbit path
const TRAIL_FRACTION = 0.2

// Shader strings defined outside component to avoid recreating each render
const VERTEX_SHADER = `
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha * 0.75);
  }
`

export default function OrbitalTrail({ orbitRadius, color, orbitAngleRef }: OrbitalTrailProps) {
  const showTrails = useSolarSystemStore((s) => s.showTrails)
  const geometryRef = useRef<THREE.BufferGeometry>(null!)

  // Pre-compute static attribute arrays (positions are updated per-frame in useFrame)
  const { positions, alphas, colorArray } = useMemo(() => {
    const positions = new Float32Array(TRAIL_POINTS * 3)
    const alphas = new Float32Array(TRAIL_POINTS)
    const baseColor = new THREE.Color(color)
    const colorArray = new Float32Array(TRAIL_POINTS * 3)

    for (let i = 0; i < TRAIL_POINTS; i++) {
      const t = i / (TRAIL_POINTS - 1) // 0 = tail end, 1 = head (near planet)
      // Quadratic fade: transparent at tail, opaque at head
      alphas[i] = t * t
      colorArray[i * 3] = baseColor.r
      colorArray[i * 3 + 1] = baseColor.g
      colorArray[i * 3 + 2] = baseColor.b
    }

    return { positions, alphas, colorArray }
  }, [color])

  // Update trail positions every frame based on the planet's current orbit angle
  useFrame(() => {
    if (!showTrails || !geometryRef.current) return

    const currentAngle = orbitAngleRef.current ?? 0
    const trailLength = Math.PI * 2 * TRAIL_FRACTION
    const posAttr = geometryRef.current.attributes.position as THREE.BufferAttribute

    for (let i = 0; i < TRAIL_POINTS; i++) {
      const t = i / (TRAIL_POINTS - 1) // 0 = tail, 1 = head
      // Trail spans from (currentAngle - trailLength) to currentAngle
      const angle = currentAngle - trailLength * (1 - t)
      posAttr.setXYZ(
        i,
        Math.cos(angle) * orbitRadius,
        0,
        Math.sin(angle) * orbitRadius
      )
    }

    posAttr.needsUpdate = true
  })

  if (!showTrails) return null

  return (
    <line>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aAlpha"
          args={[alphas, 1]}
        />
        <bufferAttribute
          attach="attributes-aColor"
          args={[colorArray, 3]}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </line>
  )
}
