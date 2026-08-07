'use client'

import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'

export default function Nebula() {
  const showNebula = useSolarSystemStore((s) => s.showNebula)
  const meshRef = useRef<THREE.Mesh>(null!)
  const mesh2Ref = useRef<THREE.Mesh>(null!)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;
        
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
        
        void main() {
          vec2 uv = vUv;
          float milkyWay = smoothstep(0.35, 0.5, uv.y) * smoothstep(0.65, 0.5, uv.y);
          milkyWay *= 0.15;
          float n1 = fbm(uv * 3.0 + vec2(time * 0.002, 0.0));
          float n2 = fbm(uv * 5.0 - vec2(0.0, time * 0.003));
          float n3 = fbm(uv * 8.0 + vec2(time * 0.001, time * 0.001));
          vec3 color1 = vec3(0.05, 0.02, 0.1);
          vec3 color2 = vec3(0.02, 0.05, 0.12);
          vec3 color3 = vec3(0.1, 0.03, 0.05);
          vec3 color4 = vec3(0.02, 0.08, 0.08);
          vec3 nebula = mix(color1, color2, n1);
          nebula = mix(nebula, color3, n2 * 0.5);
          nebula = mix(nebula, color4, n3 * 0.3);
          vec3 milkyColor = vec3(0.08, 0.07, 0.1);
          nebula += milkyColor * milkyWay * (0.5 + n1 * 0.5);
          float dust = fbm(uv * 20.0 + time * 0.001);
          nebula += vec3(0.03, 0.03, 0.04) * smoothstep(0.5, 0.7, dust) * milkyWay;
          float pulse = sin(time * 0.1) * 0.01 + 1.0;
          nebula *= pulse;
          gl_FragColor = vec4(nebula, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
  }, [])

  const material2 = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;
        
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.4;
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.3;
            amplitude *= 0.45;
          }
          return value;
        }
        
        void main() {
          vec2 uv = vUv;
          vec2 offsetUv = uv + vec2(0.15, 0.08);
          float n1 = fbm(offsetUv * 4.0 + vec2(time * 0.001, time * 0.0015));
          float n2 = fbm(offsetUv * 6.5 - vec2(time * 0.002, 0.0));
          float n3 = fbm(offsetUv * 2.5 + vec2(0.0, time * 0.0008));
          vec3 color1 = vec3(0.12, 0.02, 0.06);
          vec3 color2 = vec3(0.06, 0.01, 0.12);
          vec3 color3 = vec3(0.10, 0.06, 0.02);
          vec3 color4 = vec3(0.04, 0.02, 0.08);
          vec3 nebula = mix(color1, color2, n1);
          nebula = mix(nebula, color3, n2 * 0.4);
          nebula = mix(nebula, color4, n3 * 0.35);
          float emissionBand = smoothstep(0.25, 0.4, uv.x) * smoothstep(0.55, 0.4, uv.x);
          emissionBand *= smoothstep(0.3, 0.45, uv.y) * smoothstep(0.6, 0.45, uv.y);
          vec3 emissionColor = vec3(0.08, 0.03, 0.06);
          nebula += emissionColor * emissionBand * (0.4 + n1 * 0.6);
          float pulse = sin(time * 0.08 + 1.5) * 0.008 + 1.0;
          nebula *= pulse;
          gl_FragColor = vec4(nebula * 0.6, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
  }, [])

  useFrameLane({
    id: 'nebula',
    lane: 'decorative',
    priority: 87,
    enabled: showNebula,
  }, ({ laneDelta }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += laneDelta
    }
    if (mesh2Ref.current) {
      const mat = mesh2Ref.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += laneDelta
    }
  })

  if (!showNebula) return null

  return (
    <>
      <mesh ref={meshRef} material={material}>
        <sphereGeometry args={[450, 32, 32]} />
      </mesh>
      <mesh ref={mesh2Ref} material={material2}>
        <sphereGeometry args={[448, 32, 32]} />
      </mesh>
    </>
  )
}
