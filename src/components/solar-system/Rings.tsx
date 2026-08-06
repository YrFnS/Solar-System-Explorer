'use client'

import { useRef, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'

interface RingsProps {
  innerRadius: number
  outerRadius: number
  color: string
  opacity: number
  planetRadius: number
  textureUrl?: string
}

function TexturedRing({ innerRadius, outerRadius, opacity, planetRadius, textureUrl }: Omit<RingsProps, 'color'>) {
  const texture = useTexture(textureUrl!)
  const ringRef = useRef<THREE.Mesh>(null!)
  
  const geometry = useMemo(() => {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 128, 4)
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    const v3 = new THREE.Vector3()

    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i)
      const r = v3.length()
      const u = (r - innerRadius) / (outerRadius - innerRadius)
      uv.setXY(i, u, 0.5)
    }
    return geo
  }, [innerRadius, outerRadius])

  const shadowGeometry = useMemo(() => {
    const segments = 128
    const geo = new THREE.CircleGeometry(planetRadius * 0.98, segments)
    const pos = geo.attributes.position
    const shadowAlpha = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const dist = Math.sqrt(x * x + y * y) / (planetRadius * 0.98)
      const shadowIntensity = (1.0 - dist * dist) * 0.2
      shadowAlpha[i] = Math.max(0, shadowIntensity)
    }
    geo.setAttribute('aShadowAlpha', new THREE.BufferAttribute(shadowAlpha, 1))
    return geo
  }, [planetRadius])

  return (
    <>
      <mesh
        ref={ringRef}
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

function ProceduralRing({ innerRadius, outerRadius, color, opacity, planetRadius }: Omit<RingsProps, 'textureUrl'>) {
  const ringRef = useRef<THREE.Mesh>(null!)
  const timeRef = useRef(0)

  const geometry = useMemo(() => {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 128, 4)
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    const v3 = new THREE.Vector3()
    const ringColor = new Float32Array(pos.count * 3)
    const ringAlpha = new Float32Array(pos.count)
    const baseColor = new THREE.Color(color)

    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i)
      const r = v3.length()
      const u = (r - innerRadius) / (outerRadius - innerRadius)
      uv.setXY(i, u, 0.5)

      let alpha = 0
      let brightness = 1.0
      let colorShift = 0.0

      if (u >= 0.00 && u < 0.15) {
        alpha = u < 0.05 ? u / 0.05 * 0.2 : (0.15 - u) / 0.1 * 0.2
        brightness = 0.65
        colorShift = -0.15
      } else if (u >= 0.18 && u < 0.48) {
        alpha = 0.85
        brightness = 1.0 + (0.33 - Math.abs(u - 0.33)) * 0.5
        colorShift = (u - 0.33) * 0.3
        if (u < 0.30) {
          brightness *= 1.05
          colorShift = 0.1
        } else if (u < 0.40) {
          brightness *= 1.15
          colorShift = 0.05
        }
      } else if (u >= 0.48 && u < 0.54) {
        alpha = 0.025
        brightness = 0.15
        colorShift = 0
      } else if (u >= 0.54 && u < 0.84) {
        alpha = 0.65 * (1.0 - (u - 0.54) / 0.3 * 0.25)
        brightness = 0.95
        colorShift = -0.05
        if (u >= 0.72 && u < 0.74) {
          alpha = 0.02
          brightness = 0.12
        }
      } else if (u >= 0.88 && u < 0.93) {
        alpha = 0.4 * (1.0 - Math.abs(u - 0.905) / 0.025)
        brightness = 0.85
        colorShift = -0.1
      }

      const cr = baseColor.r * brightness * (1.0 + colorShift * 0.3)
      const cg = baseColor.g * brightness * (1.0 + colorShift * 0.15)
      const cb = baseColor.b * brightness * (1.0 - colorShift * 0.2)
      ringColor[i * 3] = Math.min(1.0, cr)
      ringColor[i * 3 + 1] = Math.min(1.0, cg)
      ringColor[i * 3 + 2] = Math.min(1.0, cb)
      ringAlpha[i] = alpha
    }

    geo.setAttribute('aRingColor', new THREE.BufferAttribute(ringColor, 3))
    geo.setAttribute('aRingAlpha', new THREE.BufferAttribute(ringAlpha, 1))

    return geo
  }, [innerRadius, outerRadius, color])

  const shadowGeometry = useMemo(() => {
    const segments = 128
    const geo = new THREE.CircleGeometry(planetRadius * 0.98, segments)

    const pos = geo.attributes.position
    const shadowAlpha = new Float32Array(pos.count)

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const dist = Math.sqrt(x * x + y * y) / (planetRadius * 0.98)
      const shadowIntensity = (1.0 - dist * dist) * 0.2
      shadowAlpha[i] = Math.max(0, shadowIntensity)
    }

    geo.setAttribute('aShadowAlpha', new THREE.BufferAttribute(shadowAlpha, 1))
    return geo
  }, [planetRadius])

  const ringMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: opacity },
        time: { value: 0 },
      },
      vertexShader: `
        attribute vec3 aRingColor;
        attribute float aRingAlpha;
        varying vec3 vRingColor;
        varying float vRingAlpha;
        varying vec2 vUv;
        void main() {
          vRingColor = aRingColor;
          vRingAlpha = aRingAlpha;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vRingColor;
        varying float vRingAlpha;
        varying vec2 vUv;
        uniform float opacity;
        uniform float time;
        void main() {
          float shimmer1 = sin(vUv.x * 80.0 + time * 0.8) * 0.05 + sin(vUv.x * 120.0 - time * 0.5) * 0.03 + 1.0;
          float shimmer2 = sin(vUv.x * 200.0 + time * 1.5) * 0.02;
          float shimmer3 = sin(vUv.x * 350.0 - time * 2.0) * 0.015;
          float shimmer = shimmer1 + shimmer2 + shimmer3;
          float sparkle = step(0.97, sin(vUv.x * 500.0 + time * 3.0) * sin(vUv.x * 300.0 - time * 2.5)) * 0.3;
          vec3 finalColor = vRingColor * shimmer;
          float spec = pow(max(vRingAlpha, 0.0), 1.5) * 0.25;
          finalColor += vec3(1.0, 0.98, 0.95) * spec;
          finalColor += vec3(1.0, 0.98, 1.0) * sparkle * vRingAlpha;
          gl_FragColor = vec4(finalColor, vRingAlpha * opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [opacity])

  useFrameLane({
    id: `ring-shimmer:${innerRadius}:${outerRadius}`,
    lane: 'decorative',
    priority: 50,
  }, ({ laneDelta }) => {
    timeRef.current += laneDelta
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value = timeRef.current
    }
  })

  return (
    <>
      <mesh
        ref={ringRef}
        geometry={geometry}
        material={ringMaterial}
        rotation={[Math.PI * 0.35, 0, 0]}
        renderOrder={2}
      />

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

export default function Rings(props: RingsProps) {
  if (props.textureUrl) {
    return <TexturedRing {...props} />
  }
  return <ProceduralRing {...props} />
}
