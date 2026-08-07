'use client'

import { useMemo, useRef } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { sunData } from './data'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'
import { useAdaptiveTexture } from './textures/useAdaptiveTexture'

const SOLAR_WIND_COUNT = 200

function SunCorona() {
  const coronaRef = useRef<THREE.Mesh>(null!)

  const coronaMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color('#FDB813') },
        color2: { value: new THREE.Color('#FF6600') },
        color3: { value: new THREE.Color('#FF2200') },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float time;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
        }

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec3 pos = position;
          float noise = snoise(pos * 1.5 + time * 0.2) * 0.1;
          pos += normal * noise;
          vPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 color3;

        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          float pulse = sin(time * 1.5) * 0.1 + 0.9;
          vec3 color = mix(color1, color2, intensity);
          color = mix(color, color3, intensity * intensity);
          gl_FragColor = vec4(color * pulse, intensity * 0.85 * pulse);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  useFrameLane({
    id: 'sun-corona',
    lane: 'decorative',
    priority: 70,
  }, ({ laneDelta }) => {
    if (!coronaRef.current) return
    const material = coronaRef.current.material as THREE.ShaderMaterial
    material.uniforms.time.value += laneDelta
  })

  return (
    <mesh ref={coronaRef} material={coronaMaterial} scale={1.8}>
      <sphereGeometry args={[sunData.radius, 64, 64]} />
    </mesh>
  )
}

function SunGlow() {
  const glowRef = useRef<THREE.Mesh>(null!)

  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        glowColor: { value: new THREE.Color('#FDB813') },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        uniform float time;
        void main() {
          float intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          float pulse = sin(time * 2.0) * 0.05 + 0.95;
          float flicker = sin(time * 5.3) * 0.03 + sin(time * 8.7) * 0.02 + 1.0;
          gl_FragColor = vec4(glowColor * pulse * flicker, intensity * 0.65 * pulse * flicker);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  useFrameLane({
    id: 'sun-glow',
    lane: 'decorative',
    priority: 71,
  }, ({ laneDelta }) => {
    if (!glowRef.current) return
    const material = glowRef.current.material as THREE.ShaderMaterial
    material.uniforms.time.value += laneDelta
  })

  return (
    <mesh ref={glowRef} material={glowMaterial} scale={2.5}>
      <sphereGeometry args={[sunData.radius, 32, 32]} />
    </mesh>
  )
}

function SunFlares() {
  const groupRef = useRef<THREE.Group>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useFrameLane({
    id: 'sun-flares',
    lane: 'decorative',
    priority: 72,
  }, ({ laneDelta }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += laneDelta * 0.02
    }
    if (materialRef.current) {
      materialRef.current.uniforms.time.value += laneDelta
    }
  })

  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <mesh
          key={index}
          rotation={[0, (index / 6) * Math.PI * 2, 0]}
        >
          <planeGeometry args={[0.15, sunData.radius * 3]} />
          <shaderMaterial
            ref={materialRef}
            uniforms={{
              time: { value: 0 },
              color: { value: new THREE.Color('#FFA500') },
            }}
            vertexShader={`
              varying vec2 vUv;
              varying vec3 vNormal;
              void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              varying vec2 vUv;
              varying vec3 vNormal;
              uniform vec3 color;
              uniform float time;
              void main() {
                float alpha = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
                float horizontalFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
                alpha *= horizontalFade;
                alpha *= 0.15 * (sin(time * 3.0) * 0.3 + 0.7);
                gl_FragColor = vec4(color, alpha);
              }
            `}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

function SolarWindParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const particleData = useRef<Float32Array | null>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.04, 0), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#FFCC44',
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  useMemo(() => {
    const data = new Float32Array(SOLAR_WIND_COUNT * 6)
    for (let index = 0; index < SOLAR_WIND_COUNT; index++) {
      const offset = index * 6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = sunData.radius * (1.0 + Math.random() * 0.3)
      data[offset] = radius * Math.sin(phi) * Math.cos(theta)
      data[offset + 1] = radius * Math.sin(phi) * Math.sin(theta)
      data[offset + 2] = radius * Math.cos(phi)
      const speed = 1.5 + Math.random() * 2.0
      const normalX = Math.sin(phi) * Math.cos(theta)
      const normalY = Math.sin(phi) * Math.sin(theta)
      const normalZ = Math.cos(phi)
      data[offset + 3] = normalX * speed
      data[offset + 4] = normalY * speed
      data[offset + 5] = normalZ * speed
    }
    particleData.current = data
  }, [])

  useFrameLane({
    id: 'sun-wind-particles',
    lane: 'decorative',
    priority: 75,
  }, ({ laneDelta }) => {
    if (!meshRef.current || !particleData.current) return
    const data = particleData.current
    const maxDistance = sunData.radius * 5

    for (let index = 0; index < SOLAR_WIND_COUNT; index++) {
      const offset = index * 6
      data[offset] += data[offset + 3] * laneDelta
      data[offset + 1] += data[offset + 4] * laneDelta
      data[offset + 2] += data[offset + 5] * laneDelta

      const x = data[offset]
      const y = data[offset + 1]
      const z = data[offset + 2]
      const distance = Math.sqrt(x * x + y * y + z * z)

      if (
        distance > maxDistance
        || (
          distance > sunData.radius * 2
          && Math.random() < laneDelta * 0.5
        )
      ) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const radius = sunData.radius * (1.0 + Math.random() * 0.2)
        data[offset] = radius * Math.sin(phi) * Math.cos(theta)
        data[offset + 1] = radius * Math.sin(phi) * Math.sin(theta)
        data[offset + 2] = radius * Math.cos(phi)
        const speed = 1.5 + Math.random() * 2.0
        const normalX = Math.sin(phi) * Math.cos(theta)
        const normalY = Math.sin(phi) * Math.sin(theta)
        const normalZ = Math.cos(phi)
        data[offset + 3] = normalX * speed
        data[offset + 4] = normalY * speed
        data[offset + 5] = normalZ * speed
      }

      dummy.position.set(data[offset], data[offset + 1], data[offset + 2])
      const alpha = Math.max(0, 1 - distance / maxDistance)
      dummy.scale.setScalar(alpha * 0.8 + 0.2)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, SOLAR_WIND_COUNT]}
      frustumCulled={false}
    />
  )
}

export default function Sun() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const setSelectedBody = useSolarSystemStore((state) => state.setSelectedBody)
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const isSelected = selectedBody === 'sun'

  const sunTexture = useAdaptiveTexture(sunData.textureUrl!, { anisotropy: 4 })

  useFrameLane({
    id: 'sun-surface',
    lane: isSelected ? 'critical' : 'decorative',
    priority: isSelected ? -15 : 69,
  }, ({ laneDelta }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += laneDelta * 0.05
    }
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    setSelectedBody('sun')
  }

  return (
    <group name="body:sun">
      <mesh
        ref={meshRef}
        onClick={handleClick}
      >
        <sphereGeometry args={[sunData.radius, 64, 64]} />
        <meshBasicMaterial map={sunTexture} />
      </mesh>

      <SunCorona />
      <SunGlow />
      <SunFlares />
      <SolarWindParticles />

      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[sunData.radius + 0.3, sunData.radius + 0.35, 64]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <pointLight
        color="#FDB813"
        intensity={500}
        distance={250}
        decay={2}
      />
      <pointLight
        color="#FF8C00"
        intensity={200}
        distance={350}
        decay={2}
      />
    </group>
  )
}
