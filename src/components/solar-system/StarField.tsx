'use client'

import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'

export default function StarField() {
  const pointsRef = useRef<THREE.Points>(null!)
  const timeRef = useRef(0)

  const [positions, colors, sizes, twinkleSpeeds] = useMemo(() => {
    const count = 15000
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const siz = new Float32Array(count)
    const twk = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 150 + Math.random() * 400

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = radius * Math.cos(phi)

      const temp = Math.random()
      if (temp < 0.08) {
        col[i * 3] = 1.0
        col[i * 3 + 1] = 0.45 + Math.random() * 0.25
        col[i * 3 + 2] = 0.2 + Math.random() * 0.15
      } else if (temp < 0.15) {
        col[i * 3] = 1.0
        col[i * 3 + 1] = 0.7 + Math.random() * 0.2
        col[i * 3 + 2] = 0.4 + Math.random() * 0.2
      } else if (temp < 0.30) {
        col[i * 3] = 1.0
        col[i * 3 + 1] = 0.92 + Math.random() * 0.08
        col[i * 3 + 2] = 0.7 + Math.random() * 0.2
      } else if (temp < 0.45) {
        col[i * 3] = 0.95 + Math.random() * 0.05
        col[i * 3 + 1] = 0.95 + Math.random() * 0.05
        col[i * 3 + 2] = 0.9 + Math.random() * 0.1
      } else if (temp < 0.60) {
        const b = 0.88 + Math.random() * 0.12
        col[i * 3] = b
        col[i * 3 + 1] = b
        col[i * 3 + 2] = b + Math.random() * 0.05
      } else if (temp < 0.75) {
        col[i * 3] = 0.7 + Math.random() * 0.15
        col[i * 3 + 1] = 0.8 + Math.random() * 0.15
        col[i * 3 + 2] = 1.0
      } else if (temp < 0.85) {
        col[i * 3] = 0.5 + Math.random() * 0.15
        col[i * 3 + 1] = 0.6 + Math.random() * 0.2
        col[i * 3 + 2] = 1.0
      } else {
        const b = 0.82 + Math.random() * 0.18
        col[i * 3] = b
        col[i * 3 + 1] = b
        col[i * 3 + 2] = b
      }

      const r = Math.random()
      if (r < 0.015) {
        siz[i] = 2.0 + Math.random() * 2.5
      } else if (r < 0.05) {
        siz[i] = 1.2 + Math.random() * 1.5
      } else if (r < 0.15) {
        siz[i] = 0.6 + Math.random() * 0.8
      } else {
        siz[i] = 0.15 + Math.random() * 0.45
      }

      twk[i] = 0.5 + Math.random() * 3.0
      if (siz[i] > 1.5) twk[i] *= 0.6
    }

    return [pos, col, siz, twk]
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute float twinkleSpeed;
        varying vec3 vColor;
        varying float vSize;
        varying float vTwinkle;
        uniform float time;

        void main() {
          vColor = color;
          vSize = size;
          vTwinkle = twinkleSpeed;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float twinkle1 = sin(time * twinkleSpeed + position.x * 5.0 + position.z * 3.0) * 0.35 + 0.65;
          float twinkle2 = sin(time * twinkleSpeed * 1.7 + position.y * 8.0) * 0.15 + 0.85;
          float twinkle3 = cos(time * twinkleSpeed * 0.6 + position.x * 2.0 - position.z * 4.0) * 0.1 + 0.9;
          float finalTwinkle = twinkle1 * twinkle2 * twinkle3;
          gl_PointSize = size * finalTwinkle * (250.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSize;
        varying float vTwinkle;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;

          float alpha = smoothstep(0.5, 0.0, d);
          alpha = pow(alpha, 1.1);

          if (vSize > 1.5) {
            float core = smoothstep(0.12, 0.0, d);
            alpha = mix(alpha, 1.0, core * 0.5);
          }

          float spike = 0.0;
          if (vSize > 1.2) {
            float dx = abs(gl_PointCoord.x - 0.5);
            float dy = abs(gl_PointCoord.y - 0.5);
            float spikeLength = vSize > 2.0 ? 0.5 : 0.35;
            spike = max(
              smoothstep(0.015, 0.0, dx) * smoothstep(spikeLength, 0.05, dy),
              smoothstep(0.015, 0.0, dy) * smoothstep(spikeLength, 0.05, dx)
            ) * 0.35;
            if (vSize > 2.0) {
              float d45 = abs(gl_PointCoord.x - 0.5 - (gl_PointCoord.y - 0.5));
              float d135 = abs(gl_PointCoord.x - 0.5 + (gl_PointCoord.y - 0.5));
              spike += max(
                smoothstep(0.02, 0.0, d45) * smoothstep(0.35, 0.08, d),
                smoothstep(0.02, 0.0, d135) * smoothstep(0.35, 0.08, d)
              ) * 0.15;
            }
          }

          gl_FragColor = vec4(vColor, alpha + spike);
        }
      `,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  useFrameLane({
    id: 'star-field',
    lane: 'decorative',
    priority: 60,
  }, ({ laneDelta }) => {
    timeRef.current += laneDelta
    if (pointsRef.current) {
      const mat = pointsRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value = timeRef.current
    }
  })

  return (
    <>
      <points ref={pointsRef} material={material}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[sizes, 1]}
          />
          <bufferAttribute
            attach="attributes-twinkleSpeed"
            args={[twinkleSpeeds, 1]}
          />
        </bufferGeometry>
      </points>
      <MilkyWayBand />
    </>
  )
}

function MilkyWayBand() {
  const pointsRef = useRef<THREE.Points>(null!)
  const timeRef = useRef(0)

  const [positions, colors, sizes] = useMemo(() => {
    const count = 8000
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const siz = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const spread = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * 0.35
      const phi = Math.PI / 2 + spread
      const radius = 200 + Math.random() * 250

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = radius * Math.cos(phi) * 0.5
      pos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)

      const variation = Math.random()
      if (variation < 0.3) {
        col[i * 3] = 0.9 + Math.random() * 0.1
        col[i * 3 + 1] = 0.75 + Math.random() * 0.15
        col[i * 3 + 2] = 0.5 + Math.random() * 0.2
      } else if (variation < 0.5) {
        col[i * 3] = 0.6 + Math.random() * 0.2
        col[i * 3 + 1] = 0.7 + Math.random() * 0.2
        col[i * 3 + 2] = 0.85 + Math.random() * 0.15
      } else {
        const b = 0.7 + Math.random() * 0.3
        col[i * 3] = b
        col[i * 3 + 1] = b * 0.95
        col[i * 3 + 2] = b * 0.9
      }

      siz[i] = 0.1 + Math.random() * 0.3
    }

    return [pos, col, siz]
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float time;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float twinkle = sin(time * 0.8 + position.x * 2.0 + position.z * 1.5) * 0.2 + 0.8;
          gl_PointSize = size * twinkle * (180.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.05, d);
          alpha = pow(alpha, 1.5);
          gl_FragColor = vec4(vColor, alpha * 0.6);
        }
      `,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  useFrameLane({
    id: 'milky-way-band',
    lane: 'decorative',
    priority: 61,
  }, ({ laneDelta }) => {
    timeRef.current += laneDelta
    if (pointsRef.current) {
      const mat = pointsRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value = timeRef.current
    }
  })

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
    </points>
  )
}
