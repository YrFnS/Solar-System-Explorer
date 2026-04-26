'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

export default function Nebula() {
  const showNebula = useSolarSystemStore((s) => s.showNebula)
  const meshRef = useRef<THREE.Mesh>(null!)
  const mesh2Ref = useRef<THREE.Mesh>(null!)

  // Layer 1: Primary nebula — deep space colors
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
          
          // Milky Way band
          float milkyWay = smoothstep(0.35, 0.5, uv.y) * smoothstep(0.65, 0.5, uv.y);
          milkyWay *= 0.15;
          
          // Nebula clouds
          float n1 = fbm(uv * 3.0 + vec2(time * 0.002, 0.0));
          float n2 = fbm(uv * 5.0 - vec2(0.0, time * 0.003));
          float n3 = fbm(uv * 8.0 + vec2(time * 0.001, time * 0.001));
          
          // Color palette - deep space colors
          vec3 color1 = vec3(0.05, 0.02, 0.1); // Deep purple
          vec3 color2 = vec3(0.02, 0.05, 0.12); // Deep blue
          vec3 color3 = vec3(0.1, 0.03, 0.05); // Deep red/brown
          vec3 color4 = vec3(0.02, 0.08, 0.08); // Teal
          
          // Mix nebula colors
          vec3 nebula = mix(color1, color2, n1);
          nebula = mix(nebula, color3, n2 * 0.5);
          nebula = mix(nebula, color4, n3 * 0.3);
          
          // Milky Way brightening
          vec3 milkyColor = vec3(0.08, 0.07, 0.1);
          nebula += milkyColor * milkyWay * (0.5 + n1 * 0.5);
          
          // Star dust in milky way
          float dust = fbm(uv * 20.0 + time * 0.001);
          nebula += vec3(0.03, 0.03, 0.04) * smoothstep(0.5, 0.7, dust) * milkyWay;
          
          // Very subtle pulsing
          float pulse = sin(time * 0.1) * 0.01 + 1.0;
          nebula *= pulse;
          
          gl_FragColor = vec4(nebula, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
  }, [])

  // Layer 2: Secondary nebula — different colors, different scale, subtle variation
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
          
          // Offset UVs to create variation from layer 1
          vec2 offsetUv = uv + vec2(0.15, 0.08);
          
          // Secondary nebula clouds — different frequencies and offsets
          float n1 = fbm(offsetUv * 4.0 + vec2(time * 0.001, time * 0.0015));
          float n2 = fbm(offsetUv * 6.5 - vec2(time * 0.002, 0.0));
          float n3 = fbm(offsetUv * 2.5 + vec2(0.0, time * 0.0008));
          
          // Color palette — warm tones: rose, copper, amber, deep indigo
          vec3 color1 = vec3(0.12, 0.02, 0.06); // Deep rose
          vec3 color2 = vec3(0.06, 0.01, 0.12); // Deep indigo
          vec3 color3 = vec3(0.10, 0.06, 0.02); // Copper/brown
          vec3 color4 = vec3(0.04, 0.02, 0.08); // Dark purple
          
          vec3 nebula = mix(color1, color2, n1);
          nebula = mix(nebula, color3, n2 * 0.4);
          nebula = mix(nebula, color4, n3 * 0.35);
          
          // Faint emission nebula glow at different position
          float emissionBand = smoothstep(0.25, 0.4, uv.x) * smoothstep(0.55, 0.4, uv.x);
          emissionBand *= smoothstep(0.3, 0.45, uv.y) * smoothstep(0.6, 0.45, uv.y);
          vec3 emissionColor = vec3(0.08, 0.03, 0.06);
          nebula += emissionColor * emissionBand * (0.4 + n1 * 0.6);
          
          // Very subtle pulsing (different phase from layer 1)
          float pulse = sin(time * 0.08 + 1.5) * 0.008 + 1.0;
          nebula *= pulse;
          
          // Lower overall intensity — this is a secondary layer
          gl_FragColor = vec4(nebula * 0.6, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
  }, [])

  useFrame((_, delta) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
    if (mesh2Ref.current) {
      const mat = mesh2Ref.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
  })

  if (!showNebula) return null

  return (
    <>
      {/* Layer 1: Primary nebula */}
      <mesh ref={meshRef} material={material}>
        <sphereGeometry args={[450, 32, 32]} />
      </mesh>
      {/* Layer 2: Secondary nebula — slightly smaller, different colors, adds variation */}
      <mesh ref={mesh2Ref} material={material2}>
        <sphereGeometry args={[448, 32, 32]} />
      </mesh>
    </>
  )
}
