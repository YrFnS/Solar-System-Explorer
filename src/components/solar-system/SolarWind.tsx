'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

export default function SolarWind() {
  const pointsRef = useRef<THREE.Points>(null)
  const showPhenomena = useSolarSystemStore((s) => s.showPhenomena)
  const showSolarWind = useSolarSystemStore((s) => s.showSolarWind)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const isPaused = useSolarSystemStore((s) => s.isPaused)

  const count = 500

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = Math.random() * 2

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)

      const speed = 0.5 + Math.random() * 0.5
      vel[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
      vel[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed
      vel[i * 3 + 2] = Math.cos(phi) * speed
    }
    return [pos, vel]
  }, [])

  const shaderArgs = useMemo(() => ({
    uniforms: {
      uColor: { value: new THREE.Color('#ffccaa') },
      uOpacity: { value: 0.3 },
    },
    vertexShader: `
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 4.0 * (100.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float r = distance(gl_PointCoord, vec2(0.5));
        if (r > 0.5) discard;
        float alpha = (1.0 - r * 2.0) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  }), [])

  useFrame(() => {
    if (pointsRef.current && !isPaused) {
      const posAttr = pointsRef.current.geometry.attributes.position
      const maxDist = 150

      for (let i = 0; i < count; i++) {
        posAttr.array[i * 3] += velocities[i * 3] * timeSpeed * 0.1
        posAttr.array[i * 3 + 1] += velocities[i * 3 + 1] * timeSpeed * 0.1
        posAttr.array[i * 3 + 2] += velocities[i * 3 + 2] * timeSpeed * 0.1

        const distSq =
          posAttr.array[i * 3] ** 2 +
          posAttr.array[i * 3 + 1] ** 2 +
          posAttr.array[i * 3 + 2] ** 2

        if (distSq > maxDist * maxDist || Number.isNaN(distSq)) {
          posAttr.array[i * 3] = 0
          posAttr.array[i * 3 + 1] = 0
          posAttr.array[i * 3 + 2] = 0
        }
      }
      posAttr.needsUpdate = true
    }
  })

  if (!showPhenomena || !showSolarWind) return null

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        args={[shaderArgs]}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
