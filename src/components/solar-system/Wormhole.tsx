'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import PlanetLabel from './PlanetLabel'

// ---------------------------------------------------------------------------
// Data interface — describes the wormhole's physical / visual parameters
// ---------------------------------------------------------------------------
export interface WormholeData {
  id: string
  name: string
  position: [number, number, number]
  throatRadius: number   // visual radius of the narrowest part of the throat
  mouthRadius: number    // visual radius of each mouth opening
  description: string
  funFacts: string[]
}

// ---------------------------------------------------------------------------
// Default wormhole data — Morris-Thorne traversable wormhole
// ---------------------------------------------------------------------------
export const defaultWormhole: WormholeData = {
  id: 'wormhole',
  name: 'Einstein-Rosen Bridge',
  position: [-85, -12, 75],
  throatRadius: 1.2,
  mouthRadius: 3.0,
  description:
    'A traversable wormhole based on the Morris-Thorne metric. Exotic matter with negative energy density stabilises the throat, allowing theoretical passage between two distant regions of spacetime.',
  funFacts: [
    'The Morris-Thorne metric (1987) describes a theoretically traversable wormhole that requires exotic matter with negative energy density to keep the throat open.',
    'Frame-dragging in a rotating (Ergo) wormhole causes the spiral pattern visible at each mouth — space itself is twisted by the rotation.',
    'Einstein-Rosen bridges were first described in 1935 as solutions to the Einstein field equations, though the original solutions were not traversable.',
    'The exotic matter stabilising this wormhole violates the null energy condition — something only possible quantum-mechanically via the Casimir effect.',
  ],
}

// ---------------------------------------------------------------------------
// 1. WORMHOLE MOUTH — Vortex disc with custom GLSL shader
// ---------------------------------------------------------------------------

const MOUTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv  = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const MOUTH_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uDirection;
  varying vec2 vUv;
  varying vec3 vPos;

  #define PI 3.14159265359
  #define ARMS 5.0

  void main() {
    vec2 c = vUv - 0.5;
    float dist = length(c);
    float angle = atan(c.y, c.x);

    float spiralPhase = angle * ARMS + uTime * 1.8 * uDirection - dist * 12.0;
    float spiral = 0.5 + 0.5 * sin(spiralPhase);
    spiral *= smoothstep(0.02, 0.15, dist);

    vec3 edgeColor  = vec3(0.85, 0.92, 1.0);
    vec3 midColor   = vec3(0.35, 0.50, 1.0);
    vec3 centerColor = vec3(0.18, 0.02, 0.35);

    float t = smoothstep(0.0, 0.5, dist);
    vec3 baseColor = mix(centerColor, midColor, t);
    baseColor = mix(baseColor, edgeColor, smoothstep(0.4, 0.5, dist));

    baseColor += spiral * vec3(0.25, 0.35, 0.6) * (1.0 - t * 0.5);

    float ring = smoothstep(0.42, 0.48, dist) * smoothstep(0.50, 0.47, dist);
    baseColor += ring * vec3(0.6, 0.7, 1.0) * 2.0;

    float core = smoothstep(0.08, 0.0, dist);
    baseColor += core * vec3(0.1, 0.0, 0.2);

    float alpha = smoothstep(0.0, 0.06, dist) * smoothstep(0.52, 0.44, dist);
    alpha = max(alpha, ring * 1.5);
    alpha = max(alpha, spiral * 0.45 * (1.0 - t));

    gl_FragColor = vec4(baseColor, alpha);
  }
`

interface MouthProps {
  radius: number
  direction: 1 | -1
}

function WormholeMouth({ radius, direction }: MouthProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null!)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDirection: { value: direction },
  }), [direction])

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta
    }
  })

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 128]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={MOUTH_VERTEX}
        fragmentShader={MOUTH_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 2. THROAT — Tube connecting the two mouths
// ---------------------------------------------------------------------------

const THROAT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const THROAT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uMouthRadius;
  uniform float uThroatRadius;
  varying vec2 vUv;

  void main() {
    float along  = vUv.y;
    float around = vUv.x;

    float flow = sin(along * 20.0 - uTime * 3.0 + around * 6.2831 * 3.0);
    flow = 0.5 + 0.5 * flow;

    float flow2 = sin(along * 14.0 + uTime * 2.0 - around * 6.2831 * 2.0);
    flow2 = 0.5 + 0.5 * flow2;

    float midFactor = 1.0 - 2.0 * abs(along - 0.5);
    vec3 mouthCol  = vec3(0.65, 0.75, 1.0);
    vec3 throatCol = vec3(0.15, 0.04, 0.30);

    vec3 color = mix(mouthCol, throatCol, midFactor);

    color += flow  * vec3(0.12, 0.18, 0.35) * (1.0 - midFactor * 0.6);
    color += flow2 * vec3(0.08, 0.10, 0.22) * (1.0 - midFactor * 0.4);

    float pulse = 0.85 + 0.15 * sin(uTime * 2.5 + along * 6.2831);
    color *= pulse;

    float alpha = 0.18 + flow * 0.12 + (1.0 - midFactor) * 0.15;
    alpha *= pulse;

    gl_FragColor = vec4(color, alpha);
  }
`

interface ThroatProps {
  length: number
  mouthRadius: number
  throatRadius: number
}

function WormholeThroat({ length, mouthRadius, throatRadius }: ThroatProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null!)

  const geometry = useMemo(() => {
    const segments = 64
    const radialSegments = 48
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const r = mouthRadius - (mouthRadius - throatRadius) * Math.sin(t * Math.PI)
      const y = (t - 0.5) * length

      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2
        const x = Math.cos(theta) * r
        const z = Math.sin(theta) * r

        positions.push(x, y, z)
        uvs.push(j / radialSegments, t)
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j
        const b = a + radialSegments + 1
        indices.push(a, b, a + 1)
        indices.push(b, b + 1, a + 1)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }, [length, mouthRadius, throatRadius])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMouthRadius: { value: mouthRadius },
    uThroatRadius: { value: throatRadius },
  }), [mouthRadius, throatRadius])

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta
    }
  })

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={THROAT_VERTEX}
        fragmentShader={THROAT_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 3. SPACETIME DISTORTION GRID
// ---------------------------------------------------------------------------

interface DistortionGridProps {
  mouthRadius: number
}

function SpacetimeDistortionGrid({ mouthRadius }: DistortionGridProps) {
  const groupRef = useRef<THREE.Group>(null!)

  const ringData = useMemo(() => {
    const rings: { radius: number; tiltX: number; tiltZ: number; opacity: number }[] = []
    const count = 6
    for (let i = 0; i < count; i++) {
      const dist = mouthRadius * (1.3 + i * 0.55)
      const distortion = 1.0 / (1.0 + i * 0.8)
      const tiltX = (0.15 + Math.random() * 0.25) * distortion
      const tiltZ = (0.10 + Math.random() * 0.20) * distortion
      const opacity = 0.25 - i * 0.03
      rings.push({ radius: dist, tiltX, tiltZ, opacity: Math.max(opacity, 0.06) })
    }
    return rings
  }, [mouthRadius])

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.02
    }
  })

  return (
    <group ref={groupRef}>
      {ringData.map((ring, idx) => (
        <mesh
          key={idx}
          rotation={[Math.PI / 2 + ring.tiltX, 0, ring.tiltZ]}
        >
          <ringGeometry args={[ring.radius - 0.04, ring.radius + 0.04, 96]} />
          <meshBasicMaterial
            color="#40e0d0"
            transparent
            opacity={ring.opacity}
            wireframe
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 4. EMBEDDING DIAGRAM — Funnel-like mesh below each mouth
//    Classic "rubber sheet" visualization of curved spacetime.
//    Uses a cone/funnel shape narrowing toward the mouth.
//    Very low opacity (0.03-0.05) with wireframe.
// ---------------------------------------------------------------------------

interface EmbeddingDiagramProps {
  mouthRadius: number
  direction: 1 | -1  // 1 = top mouth (funnel goes up), -1 = bottom mouth (funnel goes down)
}

function EmbeddingDiagram({ mouthRadius, direction }: EmbeddingDiagramProps) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const geometry = useMemo(() => {
    // Create a funnel shape: wide at top, narrow at the mouth
    // The funnel extends outward from the mouth and narrows toward it
    const segments = 32
    const radialSegments = 24
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const funnelHeight = mouthRadius * 2.5
    const topRadius = mouthRadius * 2.8  // wide end (far from mouth)
    const bottomRadius = mouthRadius * 0.5  // narrow end (near mouth)

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      // Exponential funnel shape: more curvature near the mouth
      const r = bottomRadius + (topRadius - bottomRadius) * Math.pow(t, 0.6)
      const y = direction * (t * funnelHeight + mouthRadius * 0.3)

      for (let j = 0; j <= radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2
        const x = Math.cos(theta) * r
        const z = Math.sin(theta) * r

        positions.push(x, y, z)
        uvs.push(j / radialSegments, t)
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j
        const b = a + radialSegments + 1
        indices.push(a, b, a + 1)
        indices.push(b, b + 1, a + 1)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }, [mouthRadius, direction])

  useFrame(({ clock }) => {
    if (meshRef.current) {
      // Very slow rotation
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.01 * direction
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        color="#40e0d0"
        transparent
        opacity={0.04}
        wireframe
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 5. TIDAL FORCE INDICATORS — Elongated particles near each mouth
//    Showing spaghettification direction. More visible closer to mouth.
//    Uses elongated ellipsoids (stretched along the radial direction).
// ---------------------------------------------------------------------------

interface TidalForceIndicatorProps {
  mouthRadius: number
  mouthY: number  // Y position of the mouth
  direction: 1 | -1
}

function TidalForceIndicators({ mouthRadius, mouthY, direction }: TidalForceIndicatorProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const TIDAL_COUNT = 24
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const particleData = useMemo(() => {
    const data: { angle: number; dist: number; phase: number }[] = []
    for (let i = 0; i < TIDAL_COUNT; i++) {
      data.push({
        angle: Math.random() * Math.PI * 2,
        dist: mouthRadius * (0.4 + Math.random() * 1.2),
        phase: Math.random() * Math.PI * 2,
      })
    }
    return data
  }, [mouthRadius])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const time = clock.getElapsedTime()

    for (let i = 0; i < TIDAL_COUNT; i++) {
      const p = particleData[i]
      // Orbit slowly around the mouth
      const angle = p.angle + time * 0.2 * direction

      // Position around the mouth
      const x = Math.cos(angle) * p.dist
      const z = Math.sin(angle) * p.dist
      const y = mouthY + direction * (0.3 + Math.abs(Math.sin(p.phase + time * 0.5)) * 0.5)

      dummy.position.set(x, y, z)

      // Elongate along the radial direction (spaghettification)
      // Closer to mouth = more elongated
      const proximity = 1.0 - Math.min(1.0, p.dist / (mouthRadius * 1.6))
      const stretch = 1.0 + proximity * 3.0  // up to 4x stretch
      const squash = 1.0 / Math.sqrt(stretch) // conserve volume

      // Orient the elongation toward the mouth center
      const radialDir = Math.atan2(z, x)
      dummy.rotation.set(0, 0, 0)
      dummy.rotation.set(0, radialDir, Math.PI / 2 * direction)
      dummy.scale.set(squash * 0.04, stretch * 0.04, squash * 0.04)

      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)

      // Color: more intense near mouth
      const color = new THREE.Color()
      color.setRGB(
        0.3 + proximity * 0.4,
        0.2 + proximity * 0.2,
        0.8 + proximity * 0.2
      )
      meshRef.current.setColorAt(i, color)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, TIDAL_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

// ---------------------------------------------------------------------------
// 6. ENERGY PARTICLES — enhanced physics
//    Particles accelerate when entering and decelerate when exiting.
//    Flash effect at throat. Color shift: blueshift entering, redshift exiting.
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 100

interface EnergyParticlesProps {
  mouthRadius: number
  throatRadius: number
  separation: number
}

function EnergyParticles({ mouthRadius, throatRadius, separation }: EnergyParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const flashRef = useRef<THREE.Mesh>(null!)
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const particlePhases = useMemo(() => {
    const phases = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      phases[i * 3]     = Math.random()
      phases[i * 3 + 1] = 0.15 + Math.random() * 0.25
      phases[i * 3 + 2] = Math.random() * Math.PI * 2
    }
    return phases
  }, [])

  const getPosition = useMemo(() => {
    const halfSep = separation / 2

    return (t: number, spiralOffset: number, time: number): THREE.Vector3 => {
      const pos = new THREE.Vector3()

      if (t < 0.35) {
        const local = t / 0.35
        // Accelerate as entering: use ease-in curve (quadratic)
        const accelLocal = local * local
        const r = mouthRadius * (1.0 - accelLocal * 0.8)
        const angle = local * Math.PI * 4.0 + spiralOffset + time * 1.2
        pos.x = Math.cos(angle) * r
        pos.z = Math.sin(angle) * r
        pos.y = halfSep - accelLocal * mouthRadius * 0.3
      } else if (t < 0.65) {
        const local = (t - 0.35) / 0.30
        const y = halfSep - local * separation
        const r = throatRadius * (0.3 + 0.7 * (1.0 - Math.sin(local * Math.PI)))
        const angle = local * Math.PI * 6.0 + spiralOffset + time * 2.0
        pos.x = Math.cos(angle) * r
        pos.z = Math.sin(angle) * r
        pos.y = y
      } else {
        const local = (t - 0.65) / 0.35
        // Decelerate as exiting: use ease-out curve
        const decelLocal = 1.0 - (1.0 - local) * (1.0 - local)
        const r = mouthRadius * (0.2 + decelLocal * 0.8)
        const angle = local * Math.PI * 4.0 + spiralOffset + time * 1.2
        pos.x = Math.cos(angle) * r
        pos.z = Math.sin(angle) * r
        pos.y = -halfSep + decelLocal * mouthRadius * 0.3
      }

      return pos
    }
  }, [mouthRadius, throatRadius, separation])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const time = clock.getElapsedTime()

    let throatParticleCount = 0

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phase    = particlePhases[i * 3]
      const speed    = particlePhases[i * 3 + 1]
      const spiral   = particlePhases[i * 3 + 2]

      const t = ((phase + time * speed * 0.12) % 1.0 + 1.0) % 1.0

      const pos = getPosition(t, spiral, time)
      dummy.position.copy(pos)

      const throatFactor = 1.0 - 2.0 * Math.abs(t - 0.5)
      const s = 0.08 + throatFactor * 0.06

      // Flash at throat: particles briefly scale up
      const flashBoost = throatFactor > 0.8 ? (1.0 + (throatFactor - 0.8) * 5.0 * 0.3) : 1.0
      dummy.scale.set(s * flashBoost, s * flashBoost, s * flashBoost)

      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)

      // Color shift: blueshift entering (t < 0.5), redshift exiting (t > 0.5)
      const color = new THREE.Color()
      if (t < 0.35) {
        // Entering: shift toward blue
        const enterProgress = t / 0.35
        color.setRGB(
          0.0 + enterProgress * 0.0,
          0.8 + enterProgress * 0.1,
          1.0
        )
      } else if (t < 0.65) {
        // Throat: bright white-cyan flash
        const throatProgress = (t - 0.35) / 0.30
        const flash = 1.0 - 2.0 * Math.abs(throatProgress - 0.5)
        color.setRGB(
          0.6 + flash * 0.4,
          0.9 + flash * 0.1,
          1.0
        )
      } else {
        // Exiting: shift toward red/orange (redshift)
        const exitProgress = (t - 0.65) / 0.35
        color.setRGB(
          0.8 + exitProgress * 0.2,
          0.7 - exitProgress * 0.3,
          1.0 - exitProgress * 0.5
        )
      }

      meshRef.current.setColorAt(i, color)

      // Count particles near throat for flash effect
      if (throatFactor > 0.7) throatParticleCount++
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }

    // Flash at the throat midpoint
    if (flashMatRef.current) {
      const flashIntensity = Math.min(1.0, throatParticleCount / 15.0)
      flashMatRef.current.opacity = 0.05 + flashIntensity * 0.2 * (0.8 + 0.2 * Math.sin(time * 4.0))
    }
  })

  const particleGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const particleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#00e5ff',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[particleGeo, particleMat, PARTICLE_COUNT]}
        frustumCulled={false}
      />
      {/* Throat flash effect — a bright point at the midpoint */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[throatRadius * 0.3, 16, 16]} />
        <meshBasicMaterial
          ref={flashMatRef}
          color="#80d0ff"
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

// ---------------------------------------------------------------------------
// 7. GRAVITATIONAL LENSING HALO
// ---------------------------------------------------------------------------

interface LensingHaloProps {
  radius: number
}

function GravitationalLensingHalo({ radius }: LensingHaloProps) {
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (innerMatRef.current) {
      innerMatRef.current.opacity = 0.30 + 0.10 * Math.sin(t * 1.5)
    }
    if (outerMatRef.current) {
      outerMatRef.current.opacity = 0.15 + 0.06 * Math.sin(t * 1.5 + 1.0)
    }
  })

  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.08, radius + 0.22, 96]} />
        <meshBasicMaterial
          ref={innerMatRef}
          color="#aaccff"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.30, radius + 0.65, 96]} />
        <meshBasicMaterial
          ref={outerMatRef}
          color="#6688cc"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}

// ---------------------------------------------------------------------------
// 8. MOUTH BRIGHT RING
// ---------------------------------------------------------------------------

interface MouthRingProps {
  radius: number
}

function MouthBrightRing({ radius }: MouthRingProps) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (matRef.current) {
      matRef.current.opacity = 0.55 + 0.15 * Math.sin(t * 2.0)
    }
  })

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.06, radius + 0.06, 128]} />
      <meshBasicMaterial
        ref={matRef}
        color="#c0d8ff"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT — Wormhole
// ---------------------------------------------------------------------------

interface WormholeProps {
  data?: WormholeData
}

export default function Wormhole({ data = defaultWormhole }: WormholeProps) {
  const groupRef = useRef<THREE.Group>(null!)

  const separation = 9

  const { position, mouthRadius, throatRadius, name } = data

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.03) * 0.1
    }
  })

  return (
    <group position={position} ref={groupRef}>
      {/* ---- Mouth A (entry) ---- */}
      <group position={[0, separation / 2, 0]}>
        <WormholeMouth radius={mouthRadius} direction={1} />
        <MouthBrightRing radius={mouthRadius} />
        <GravitationalLensingHalo radius={mouthRadius} />
        <SpacetimeDistortionGrid mouthRadius={mouthRadius} />
        {/* Embedding diagram — funnel extending upward from mouth A */}
        <EmbeddingDiagram mouthRadius={mouthRadius} direction={1} />
        <pointLight color="#6080ff" intensity={0.6} distance={12} />
      </group>

      {/* ---- Mouth B (exit) ---- */}
      <group position={[0, -separation / 2, 0]}>
        <WormholeMouth radius={mouthRadius} direction={-1} />
        <MouthBrightRing radius={mouthRadius} />
        <GravitationalLensingHalo radius={mouthRadius} />
        <SpacetimeDistortionGrid mouthRadius={mouthRadius} />
        {/* Embedding diagram — funnel extending downward from mouth B */}
        <EmbeddingDiagram mouthRadius={mouthRadius} direction={-1} />
        <pointLight color="#6080ff" intensity={0.6} distance={12} />
      </group>

      {/* ---- Tidal force indicators near each mouth ---- */}
      <TidalForceIndicators
        mouthRadius={mouthRadius}
        mouthY={separation / 2}
        direction={1}
      />
      <TidalForceIndicators
        mouthRadius={mouthRadius}
        mouthY={-separation / 2}
        direction={-1}
      />

      {/* ---- Throat (tunnel connecting the two mouths) ---- */}
      <WormholeThroat
        length={separation}
        mouthRadius={mouthRadius}
        throatRadius={throatRadius}
      />

      {/* ---- Energy particles flowing through ---- */}
      <EnergyParticles
        mouthRadius={mouthRadius}
        throatRadius={throatRadius}
        separation={separation}
      />

      {/* ---- Label ---- */}
      <PlanetLabel name={name} offset={separation / 2 + mouthRadius + 1.0} bodyId={data.id} />
    </group>
  )
}
