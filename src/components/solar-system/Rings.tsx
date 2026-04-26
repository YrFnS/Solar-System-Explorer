'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface RingsProps {
  innerRadius: number
  outerRadius: number
  color: string
  opacity: number
  planetRadius: number
}

export default function Rings({ innerRadius, outerRadius, color, opacity, planetRadius }: RingsProps) {
  const ringRef = useRef<THREE.Mesh>(null!)
  const timeRef = useRef(0)

  const geometry = useMemo(() => {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 128, 4)
    // Fix UV mapping - map U to radial distance
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

      // Per-vertex color and alpha for ring bands with enhanced color gradients
      let alpha = 0
      let brightness = 1.0
      let colorShift = 0.0 // Warm/cool shift for variety

      // C Ring (faint inner) - slightly cooler/bluer
      if (u >= 0.00 && u < 0.15) {
        alpha = u < 0.05 ? u / 0.05 * 0.2 : (0.15 - u) / 0.1 * 0.2
        brightness = 0.65
        colorShift = -0.15
      }
      // B Ring (bright, wide) - warm golden
      else if (u >= 0.18 && u < 0.48) {
        alpha = 0.85
        brightness = 1.0 + (0.33 - Math.abs(u - 0.33)) * 0.5
        colorShift = (u - 0.33) * 0.3
        // B Ring color variation: inner part slightly orange, outer slightly pale
        if (u < 0.30) {
          brightness *= 1.05
          colorShift = 0.1
        } else if (u < 0.40) {
          brightness *= 1.15
          colorShift = 0.05
        }
      }
      // Cassini Division (dark gap - enhanced)
      else if (u >= 0.48 && u < 0.54) {
        alpha = 0.025
        brightness = 0.15
        colorShift = 0
      }
      // A Ring - slightly cooler/brighter than B ring
      else if (u >= 0.54 && u < 0.84) {
        alpha = 0.65 * (1.0 - (u - 0.54) / 0.3 * 0.25)
        brightness = 0.95
        colorShift = -0.05
        // Encke gap
        if (u >= 0.72 && u < 0.74) {
          alpha = 0.02
          brightness = 0.12
        }
      }
      // F Ring (narrow outer) - bright and icy
      else if (u >= 0.88 && u < 0.93) {
        alpha = 0.4 * (1.0 - Math.abs(u - 0.905) / 0.025)
        brightness = 0.85
        colorShift = -0.1
      }

      // Apply color shift: warm shift increases red/green, cool shift increases blue
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

  // Ring shadow - a dark disc slightly above the planet's equator
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

  // Material with shimmer effect
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
          // Subtle shimmer/sparkle effect along the ring
          float shimmer = sin(vUv.x * 80.0 + time * 0.5) * 0.03 + sin(vUv.x * 120.0 - time * 0.3) * 0.02 + 1.0;
          vec3 finalColor = vRingColor * shimmer;
          // Slight specular highlight on bright portions
          float spec = pow(max(vRingAlpha, 0.0), 2.0) * 0.15;
          finalColor += vec3(1.0, 0.95, 0.85) * spec;
          gl_FragColor = vec4(finalColor, vRingAlpha * opacity * shimmer);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [opacity])

  useFrame((_, delta) => {
    timeRef.current += delta
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

      {/* Ring shadow on planet surface */}
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
