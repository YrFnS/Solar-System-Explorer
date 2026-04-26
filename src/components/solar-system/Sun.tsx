'use client'

import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sunData } from './data'
import { useSolarSystemStore } from './store'

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
        
        // Simplex noise function
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
          // Subtler distortion
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

  useFrame((_, delta) => {
    if (coronaRef.current) {
      const mat = coronaRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
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

  useFrame((_, delta) => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
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

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02
    }
    if (materialRef.current) {
      materialRef.current.uniforms.time.value += delta
    }
  })

  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          rotation={[0, (i / 6) * Math.PI * 2, 0]}
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
                // Sharper alpha fade to prevent square edges
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

  // Initialize particle positions and velocities
  useMemo(() => {
    const data = new Float32Array(SOLAR_WIND_COUNT * 6) // x,y,z, vx,vy,vz
    for (let i = 0; i < SOLAR_WIND_COUNT; i++) {
      const idx = i * 6
      // Random direction on sphere surface at sun radius
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = sunData.radius * (1.0 + Math.random() * 0.3)
      data[idx] = r * Math.sin(phi) * Math.cos(theta)
      data[idx + 1] = r * Math.sin(phi) * Math.sin(theta)
      data[idx + 2] = r * Math.cos(phi)
      // Outward velocity with some randomness
      const speed = 1.5 + Math.random() * 2.0
      const nx = Math.sin(phi) * Math.cos(theta)
      const ny = Math.sin(phi) * Math.sin(theta)
      const nz = Math.cos(phi)
      data[idx + 3] = nx * speed
      data[idx + 4] = ny * speed
      data[idx + 5] = nz * speed
    }
    particleData.current = data
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current || !particleData.current) return
    const data = particleData.current
    const maxDist = sunData.radius * 5

    for (let i = 0; i < SOLAR_WIND_COUNT; i++) {
      const idx = i * 6
      // Update position
      data[idx] += data[idx + 3] * delta
      data[idx + 1] += data[idx + 4] * delta
      data[idx + 2] += data[idx + 5] * delta

      // Calculate distance from origin
      const dx = data[idx]
      const dy = data[idx + 1]
      const dz = data[idx + 2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // Reset particle if too far or random chance
      if (dist > maxDist || (dist > sunData.radius * 2 && Math.random() < delta * 0.5)) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = sunData.radius * (1.0 + Math.random() * 0.2)
        data[idx] = r * Math.sin(phi) * Math.cos(theta)
        data[idx + 1] = r * Math.sin(phi) * Math.sin(theta)
        data[idx + 2] = r * Math.cos(phi)
        const speed = 1.5 + Math.random() * 2.0
        const nx = Math.sin(phi) * Math.cos(theta)
        const ny = Math.sin(phi) * Math.sin(theta)
        const nz = Math.cos(phi)
        data[idx + 3] = nx * speed
        data[idx + 4] = ny * speed
        data[idx + 5] = nz * speed
      }

      // Set instance transform
      dummy.position.set(data[idx], data[idx + 1], data[idx + 2])
      // Fade out with distance
      const alpha = Math.max(0, 1 - dist / maxDist)
      dummy.scale.setScalar(alpha * 0.8 + 0.2)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
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

function LensFlare() {
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  useFrame(() => {
    if (!groupRef.current) return
    // Make lens flare always face camera and stay at sun position
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  const flareMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          // Main flare - bright center
          float flare1 = 0.08 / (dist + 0.05);
          
          // Horizontal streak
          float streak = 0.02 / (abs(center.y) + 0.01);
          streak *= smoothstep(0.5, 0.0, abs(center.x));
          
          // Secondary ghost flares
          float ghost1 = 0.005 / (length(center - vec2(0.15, 0.1)) + 0.02);
          float ghost2 = 0.003 / (length(center - vec2(-0.2, -0.08)) + 0.02);
          
          // Animate brightness
          float pulse = sin(time * 1.5) * 0.15 + 0.85;
          float flicker = sin(time * 7.0) * 0.05 + 1.0;
          
          float alpha = (flare1 + streak + ghost1 + ghost2) * pulse * flicker;
          alpha = min(alpha, 1.0);
          
          // Warm color
          vec3 color = vec3(1.0, 0.85, 0.5);
          
          gl_FragColor = vec4(color, alpha * 0.4);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  }, [])

  useFrame((_, delta) => {
    if (groupRef.current) {
      const mat = (groupRef.current.children[0] as THREE.Mesh).material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
  })

  return (
    <group ref={groupRef}>
      <mesh material={flareMaterial}>
        <planeGeometry args={[sunData.radius * 6, sunData.radius * 6]} />
      </mesh>
    </group>
  )
}

export default function Sun() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody('sun')
  }

  const sunMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color('#FDB813') },
        color2: { value: new THREE.Color('#FF8C00') },
        color3: { value: new THREE.Color('#FFD700') },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float time;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 color3;
        
        // Simple noise
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
          for (int i = 0; i < 6; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
        
        void main() {
          vec2 uv = vUv;
          float n = fbm(uv * 8.0 + time * 0.1);
          float n2 = fbm(uv * 12.0 - time * 0.15);
          float n3 = fbm(uv * 4.0 + time * 0.05);
          
          vec3 col = mix(color1, color2, n);
          col = mix(col, color3, n2 * 0.4);
          
          // Sunspots (dark patches)
          float spots = fbm(uv * 20.0 + time * 0.03);
          col = mix(col, col * 0.4, smoothstep(0.55, 0.65, spots) * 0.6);
          
          // Bright granulation
          float granules = fbm(uv * 30.0 + time * 0.08);
          col += vec3(0.2, 0.1, 0.0) * smoothstep(0.6, 0.75, granules);
          
          // Edge darkening (limb darkening)
          float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.5);
          col = mix(col, color2 * 0.5, fresnel * 0.4);
          
          // Emission boost
          col *= 1.3;
          
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  }, [])

  useFrame((_, delta) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
  })

  const isSelected = selectedBody === 'sun'

  return (
    <group>
      {/* Main sun sphere */}
      <mesh
        ref={meshRef}
        material={sunMaterial}
        onClick={handleClick}
      >
        <sphereGeometry args={[sunData.radius, 64, 64]} />
      </mesh>

      {/* Corona effect */}
      <SunCorona />

      {/* Outer glow */}
      <SunGlow />

      {/* Solar flares */}
      <SunFlares />

      {/* Solar wind particles */}
      <SolarWindParticles />

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[sunData.radius + 0.3, sunData.radius + 0.35, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Point light from sun */}
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
