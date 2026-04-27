'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

export default function ZodiacalLight() {
  const showPhenomena = useSolarSystemStore((s) => s.showPhenomena)
  const showZodiacalLight = useSolarSystemStore((s) => s.showZodiacalLight)

  const radius = 35

  const shaderArgs = useMemo(() => ({
    uniforms: {
      uColor: { value: new THREE.Color('#ffeedd') },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vPosition;
      void main() {
        float dist = length(vPosition.xz);
        float radius = ${radius.toFixed(1)};
        float radialAlpha = 1.0 - smoothstep(0.0, radius, dist);

        float verticalAlpha = exp(-abs(vPosition.y) * 8.0);

        gl_FragColor = vec4(uColor, radialAlpha * verticalAlpha * 0.1);
      }
    `,
  }), [radius])

  if (!showPhenomena || !showZodiacalLight) return null

  return (
    <mesh scale={[1, 0.05, 1]} renderOrder={5}>
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial
        args={[shaderArgs]}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
