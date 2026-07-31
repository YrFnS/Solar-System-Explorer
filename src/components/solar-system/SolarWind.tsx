'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  usePerformanceStore,
} from './performance-store'

const BASE_PARTICLE_COUNT = 500
const MAX_DISTANCE = 150

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export default function SolarWind() {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const elapsedRef = useRef(0)
  const showPhenomena = useSolarSystemStore((state) => state.showPhenomena)
  const showSolarWind = useSolarSystemStore((state) => state.showSolarWind)
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const count = Math.max(
    100,
    Math.round(BASE_PARTICLE_COUNT * QUALITY_PROFILES[quality].instanceDensity)
  )

  const { directions, radii, speeds } = useMemo(() => {
    const random = seededRandom(6299)
    const directionArray = new Float32Array(count * 3)
    const radiusArray = new Float32Array(count)
    const speedArray = new Float32Array(count)

    for (let index = 0; index < count; index++) {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      const sinPhi = Math.sin(phi)

      directionArray[index * 3] = sinPhi * Math.cos(theta)
      directionArray[index * 3 + 1] = sinPhi * Math.sin(theta)
      directionArray[index * 3 + 2] = Math.cos(phi)
      radiusArray[index] = random() * MAX_DISTANCE
      speedArray[index] = 4 + random() * 5
    }

    return {
      directions: directionArray,
      radii: radiusArray,
      speeds: speedArray,
    }
  }, [count])

  useFrame((_, delta) => {
    if (!materialRef.current || !showPhenomena || !showSolarWind) return

    const scene = useSolarSystemStore.getState()
    if (scene.isPaused) return

    const motionFactor = reducedMotion ? 0.2 : 1
    elapsedRef.current += delta * scene.timeSpeed * motionFactor
    materialRef.current.uniforms.uTime.value = elapsedRef.current
  })

  if (!showPhenomena || !showSolarWind) return null

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[directions, 3]} />
        <bufferAttribute attach="attributes-aRadius" args={[radii, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new THREE.Color('#ffccaa') },
          uOpacity: { value: 0.3 },
          uMaxDistance: { value: MAX_DISTANCE },
        }}
        vertexShader={`
          attribute float aRadius;
          attribute float aSpeed;
          uniform float uTime;
          uniform float uMaxDistance;

          void main() {
            float radius = mod(aRadius + uTime * aSpeed, uMaxDistance);
            vec3 animatedPosition = position * radius;
            vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
            gl_PointSize = clamp(4.0 * (100.0 / -mvPosition.z), 0.75, 8.0);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uOpacity;

          void main() {
            float radius = distance(gl_PointCoord, vec2(0.5));
            if (radius > 0.5) discard;
            float alpha = (1.0 - radius * 2.0) * uOpacity;
            gl_FragColor = vec4(uColor, alpha);
          }
        `}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
