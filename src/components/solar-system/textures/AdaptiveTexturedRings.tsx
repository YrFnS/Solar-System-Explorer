'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useAdaptiveTexture } from './useAdaptiveTexture'

interface AdaptiveTexturedRingsProps {
  innerRadius: number
  outerRadius: number
  opacity: number
  planetRadius: number
  textureUrl: string
}

export default function AdaptiveTexturedRings({
  innerRadius,
  outerRadius,
  opacity,
  planetRadius,
  textureUrl,
}: AdaptiveTexturedRingsProps) {
  const texture = useAdaptiveTexture(textureUrl, { anisotropy: 4 })

  const geometry = useMemo(() => {
    const nextGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128, 4)
    const position = nextGeometry.attributes.position
    const uv = nextGeometry.attributes.uv
    const point = new THREE.Vector3()

    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index)
      const radius = point.length()
      const u = (radius - innerRadius) / (outerRadius - innerRadius)
      uv.setXY(index, u, 0.5)
    }

    return nextGeometry
  }, [innerRadius, outerRadius])

  const shadowGeometry = useMemo(() => {
    const nextGeometry = new THREE.CircleGeometry(planetRadius * 0.98, 128)
    const position = nextGeometry.attributes.position
    const shadowAlpha = new Float32Array(position.count)

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index)
      const y = position.getY(index)
      const distance = Math.sqrt(x * x + y * y) / (planetRadius * 0.98)
      shadowAlpha[index] = Math.max(0, (1 - distance * distance) * 0.2)
    }

    nextGeometry.setAttribute(
      'aShadowAlpha',
      new THREE.BufferAttribute(shadowAlpha, 1)
    )
    return nextGeometry
  }, [planetRadius])

  return (
    <>
      <mesh
        geometry={geometry}
        rotation={[Math.PI * 0.35, 0, 0]}
        renderOrder={2}
      >
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={opacity * 1.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh
        geometry={shadowGeometry}
        rotation={[Math.PI * 0.35, 0, 0]}
        position={[0, -planetRadius * 0.02, -planetRadius * 0.1]}
        renderOrder={1}
      >
        <shaderMaterial
          vertexShader={`
            attribute float aShadowAlpha;
            varying float vShadowAlpha;
            void main() {
              vShadowAlpha = aShadowAlpha;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying float vShadowAlpha;
            void main() {
              gl_FragColor = vec4(0.0, 0.0, 0.0, vShadowAlpha);
            }
          `}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}
