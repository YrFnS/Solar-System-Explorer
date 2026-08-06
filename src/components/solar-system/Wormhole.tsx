'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'
import PlanetLabel from './PlanetLabel'

export interface WormholeData {
  id: string
  name: string
  position: [number, number, number]
  throatRadius: number
  mouthRadius: number
  description: string
  funFacts: string[]
}

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
    'Frame-dragging in a rotating wormhole causes the spiral pattern visible at each mouth — space itself is twisted by the rotation.',
    'Einstein-Rosen bridges were first described in 1935 as solutions to the Einstein field equations, though the original solutions were not traversable.',
    'The exotic matter stabilising this wormhole violates the null energy condition — something only possible quantum-mechanically via the Casimir effect.',
  ],
}

const MOUTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const MOUTH_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uDirection;
  varying vec2 vUv;

  void main() {
    vec2 c = vUv - 0.5;
    float dist = length(c);
    float angle = atan(c.y, c.x);
    float spiral = 0.5 + 0.5 * sin(
      angle * 5.0 + uTime * 1.8 * uDirection - dist * 12.0
    );
    spiral *= smoothstep(0.02, 0.15, dist);

    float radial = smoothstep(0.0, 0.5, dist);
    vec3 center = vec3(0.18, 0.02, 0.35);
    vec3 middle = vec3(0.35, 0.50, 1.0);
    vec3 edge = vec3(0.85, 0.92, 1.0);
    vec3 color = mix(center, middle, radial);
    color = mix(color, edge, smoothstep(0.4, 0.5, dist));
    color += spiral * vec3(0.25, 0.35, 0.6) * (1.0 - radial * 0.5);

    float ring = smoothstep(0.42, 0.48, dist)
      * smoothstep(0.50, 0.47, dist);
    color += ring * edge * 2.0;

    float alpha = smoothstep(0.0, 0.06, dist)
      * smoothstep(0.52, 0.44, dist);
    alpha = max(alpha, ring * 1.5);
    alpha = max(alpha, spiral * 0.45 * (1.0 - radial));
    gl_FragColor = vec4(color, alpha);
  }
`

const THROAT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const THROAT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float along = vUv.y;
    float around = vUv.x;
    float flow = 0.5 + 0.5 * sin(
      along * 20.0 - uTime * 3.0 + around * 18.8496
    );
    float flow2 = 0.5 + 0.5 * sin(
      along * 14.0 + uTime * 2.0 - around * 12.5664
    );
    float middle = 1.0 - 2.0 * abs(along - 0.5);
    vec3 color = mix(
      vec3(0.65, 0.75, 1.0),
      vec3(0.15, 0.04, 0.30),
      middle
    );
    color += flow * vec3(0.12, 0.18, 0.35) * (1.0 - middle * 0.6);
    color += flow2 * vec3(0.08, 0.10, 0.22) * (1.0 - middle * 0.4);
    float pulse = 0.85 + 0.15 * sin(uTime * 2.5 + along * 6.2831);
    gl_FragColor = vec4(
      color * pulse,
      (0.18 + flow * 0.12 + (1.0 - middle) * 0.15) * pulse
    );
  }
`

function createThroatGeometry(
  length: number,
  mouthRadius: number,
  throatRadius: number
) {
  const segments = 64
  const radialSegments = 48
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let segment = 0; segment <= segments; segment += 1) {
    const progress = segment / segments
    const radius = mouthRadius
      - (mouthRadius - throatRadius) * Math.sin(progress * Math.PI)
    const y = (progress - 0.5) * length

    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2
      positions.push(
        Math.cos(theta) * radius,
        y,
        Math.sin(theta) * radius
      )
      uvs.push(radial / radialSegments, progress)
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const a = segment * (radialSegments + 1) + radial
      const b = a + radialSegments + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createEmbeddingGeometry(
  mouthRadius: number,
  direction: 1 | -1
) {
  const segments = 32
  const radialSegments = 24
  const positions: number[] = []
  const indices: number[] = []
  const height = mouthRadius * 2.5
  const outerRadius = mouthRadius * 2.8
  const innerRadius = mouthRadius * 0.5

  for (let segment = 0; segment <= segments; segment += 1) {
    const progress = segment / segments
    const radius = innerRadius
      + (outerRadius - innerRadius) * Math.pow(progress, 0.6)
    const y = direction * (progress * height + mouthRadius * 0.3)

    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2
      positions.push(
        Math.cos(theta) * radius,
        y,
        Math.sin(theta) * radius
      )
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const a = segment * (radialSegments + 1) + radial
      const b = a + radialSegments + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function WormholeMouth({
  radius,
  direction,
  materialRef,
}: {
  radius: number
  direction: 1 | -1
  materialRef: React.RefObject<THREE.ShaderMaterial | null>
}) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDirection: { value: direction },
  }), [direction])

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 128]} />
      <shaderMaterial
        ref={materialRef}
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

function LensingRings({
  radius,
  innerRef,
  outerRef,
  brightRef,
}: {
  radius: number
  innerRef: React.RefObject<THREE.MeshBasicMaterial | null>
  outerRef: React.RefObject<THREE.MeshBasicMaterial | null>
  brightRef: React.RefObject<THREE.MeshBasicMaterial | null>
}) {
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.06, radius + 0.06, 128]} />
        <meshBasicMaterial
          ref={brightRef}
          color="#c0d8ff"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.08, radius + 0.22, 96]} />
        <meshBasicMaterial
          ref={innerRef}
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
          ref={outerRef}
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

function DistortionGrid({
  mouthRadius,
  groupRef,
}: {
  mouthRadius: number
  groupRef: React.RefObject<THREE.Group | null>
}) {
  const rings = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const distortion = 1 / (1 + index * 0.8)
    return {
      radius: mouthRadius * (1.3 + index * 0.55),
      tiltX: (0.16 + index * 0.019) * distortion,
      tiltZ: (0.11 + index * 0.013) * distortion,
      opacity: Math.max(0.25 - index * 0.03, 0.06),
    }
  }), [mouthRadius])

  return (
    <group ref={groupRef}>
      {rings.map((ring, index) => (
        <mesh
          key={index}
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

const TIDAL_COUNT = 24
const ENERGY_COUNT = 100

interface TidalParticle {
  angle: number
  distance: number
  phase: number
}

export default function Wormhole({ data = defaultWormhole }: { data?: WormholeData }) {
  const separation = 9
  const { position, mouthRadius, throatRadius, name } = data

  const groupRef = useRef<THREE.Group>(null)
  const mouthTopRef = useRef<THREE.ShaderMaterial>(null)
  const mouthBottomRef = useRef<THREE.ShaderMaterial>(null)
  const throatMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const gridTopRef = useRef<THREE.Group>(null)
  const gridBottomRef = useRef<THREE.Group>(null)
  const embeddingTopRef = useRef<THREE.Mesh>(null)
  const embeddingBottomRef = useRef<THREE.Mesh>(null)
  const tidalTopRef = useRef<THREE.InstancedMesh>(null)
  const tidalBottomRef = useRef<THREE.InstancedMesh>(null)
  const energyRef = useRef<THREE.InstancedMesh>(null)
  const flashMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloTopInnerRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloTopOuterRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloTopBrightRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloBottomInnerRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloBottomOuterRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloBottomBrightRef = useRef<THREE.MeshBasicMaterial>(null)
  const elapsedRef = useRef(0)
  const dummyRef = useRef(new THREE.Object3D())
  const colorRef = useRef(new THREE.Color())

  const throatGeometry = useMemo(
    () => createThroatGeometry(separation, mouthRadius, throatRadius),
    [mouthRadius, throatRadius]
  )
  const embeddingTopGeometry = useMemo(
    () => createEmbeddingGeometry(mouthRadius, 1),
    [mouthRadius]
  )
  const embeddingBottomGeometry = useMemo(
    () => createEmbeddingGeometry(mouthRadius, -1),
    [mouthRadius]
  )
  const throatUniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  const tidalTop = useMemo<TidalParticle[]>(() => Array.from(
    { length: TIDAL_COUNT },
    (_, index) => ({
      angle: (index / TIDAL_COUNT) * Math.PI * 2,
      distance: mouthRadius * (0.45 + ((index * 17) % 23) / 20),
      phase: index * 0.71,
    })
  ), [mouthRadius])
  const tidalBottom = useMemo<TidalParticle[]>(() => tidalTop.map((particle) => ({
    angle: particle.angle + Math.PI / TIDAL_COUNT,
    distance: particle.distance,
    phase: particle.phase + 1.2,
  })), [tidalTop])
  const energyPhases = useMemo(() => Array.from(
    { length: ENERGY_COUNT },
    (_, index) => ({
      phase: ((index * 37) % ENERGY_COUNT) / ENERGY_COUNT,
      speed: 0.15 + ((index * 13) % 25) / 100,
      spiral: index * 0.83,
    })
  ), [])

  const energyGeometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const energyMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#00e5ff',
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  useFrameLane({
    id: `wormhole:${data.id}`,
    lane: 'decorative',
    priority: 95,
  }, ({ laneDelta }) => {
    const elapsed = elapsedRef.current + laneDelta
    elapsedRef.current = elapsed
    const dummy = dummyRef.current
    const color = colorRef.current

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(elapsed * 0.03) * 0.1
    }
    if (mouthTopRef.current) mouthTopRef.current.uniforms.uTime.value = elapsed
    if (mouthBottomRef.current) mouthBottomRef.current.uniforms.uTime.value = elapsed
    if (throatMaterialRef.current) {
      throatMaterialRef.current.uniforms.uTime.value = elapsed
    }
    if (gridTopRef.current) gridTopRef.current.rotation.y = elapsed * 0.02
    if (gridBottomRef.current) gridBottomRef.current.rotation.y = -elapsed * 0.02
    if (embeddingTopRef.current) embeddingTopRef.current.rotation.y = elapsed * 0.01
    if (embeddingBottomRef.current) embeddingBottomRef.current.rotation.y = -elapsed * 0.01

    const updateTidalField = (
      mesh: THREE.InstancedMesh | null,
      particles: TidalParticle[],
      mouthY: number,
      direction: 1 | -1
    ) => {
      if (!mesh) return

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index]
        const angle = particle.angle + elapsed * 0.2 * direction
        const x = Math.cos(angle) * particle.distance
        const z = Math.sin(angle) * particle.distance
        const y = mouthY + direction * (
          0.3 + Math.abs(Math.sin(particle.phase + elapsed * 0.5)) * 0.5
        )
        const proximity = 1 - Math.min(
          1,
          particle.distance / (mouthRadius * 1.6)
        )
        const stretch = 1 + proximity * 3
        const squash = 1 / Math.sqrt(stretch)

        dummy.position.set(x, y, z)
        dummy.rotation.set(0, Math.atan2(z, x), Math.PI / 2 * direction)
        dummy.scale.set(
          squash * 0.04,
          stretch * 0.04,
          squash * 0.04
        )
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
        color.setRGB(
          0.3 + proximity * 0.4,
          0.2 + proximity * 0.2,
          0.8 + proximity * 0.2
        )
        mesh.setColorAt(index, color)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    updateTidalField(
      tidalTopRef.current,
      tidalTop,
      separation / 2,
      1
    )
    updateTidalField(
      tidalBottomRef.current,
      tidalBottom,
      -separation / 2,
      -1
    )

    let throatParticles = 0
    if (energyRef.current) {
      const halfSeparation = separation / 2
      for (let index = 0; index < energyPhases.length; index += 1) {
        const particle = energyPhases[index]
        const progress = (
          (particle.phase + elapsed * particle.speed * 0.12) % 1 + 1
        ) % 1
        let radius = mouthRadius
        let angle = particle.spiral
        let y = 0

        if (progress < 0.35) {
          const local = progress / 0.35
          const accelerated = local * local
          radius = mouthRadius * (1 - accelerated * 0.8)
          angle += local * Math.PI * 4 + elapsed * 1.2
          y = halfSeparation - accelerated * mouthRadius * 0.3
        } else if (progress < 0.65) {
          const local = (progress - 0.35) / 0.30
          radius = throatRadius * (
            0.3 + 0.7 * (1 - Math.sin(local * Math.PI))
          )
          angle += local * Math.PI * 6 + elapsed * 2
          y = halfSeparation - local * separation
        } else {
          const local = (progress - 0.65) / 0.35
          const decelerated = 1 - (1 - local) * (1 - local)
          radius = mouthRadius * (0.2 + decelerated * 0.8)
          angle += local * Math.PI * 4 + elapsed * 1.2
          y = -halfSeparation + decelerated * mouthRadius * 0.3
        }

        const throatFactor = 1 - 2 * Math.abs(progress - 0.5)
        const scale = (0.08 + throatFactor * 0.06) * (
          throatFactor > 0.8
            ? 1 + (throatFactor - 0.8) * 1.5
            : 1
        )
        dummy.position.set(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius
        )
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        energyRef.current.setMatrixAt(index, dummy.matrix)

        if (progress < 0.35) {
          const entering = progress / 0.35
          color.setRGB(0, 0.8 + entering * 0.1, 1)
        } else if (progress < 0.65) {
          const local = (progress - 0.35) / 0.30
          const flash = 1 - 2 * Math.abs(local - 0.5)
          color.setRGB(0.6 + flash * 0.4, 0.9 + flash * 0.1, 1)
        } else {
          const exiting = (progress - 0.65) / 0.35
          color.setRGB(
            0.8 + exiting * 0.2,
            0.7 - exiting * 0.3,
            1 - exiting * 0.5
          )
        }
        energyRef.current.setColorAt(index, color)
        if (throatFactor > 0.7) throatParticles += 1
      }
      energyRef.current.instanceMatrix.needsUpdate = true
      if (energyRef.current.instanceColor) {
        energyRef.current.instanceColor.needsUpdate = true
      }
    }

    if (flashMaterialRef.current) {
      const intensity = Math.min(1, throatParticles / 15)
      flashMaterialRef.current.opacity = 0.05
        + intensity * 0.2 * (0.8 + 0.2 * Math.sin(elapsed * 4))
    }

    const pulse = Math.sin(elapsed * 1.5)
    if (haloTopInnerRef.current) haloTopInnerRef.current.opacity = 0.30 + pulse * 0.10
    if (haloBottomInnerRef.current) haloBottomInnerRef.current.opacity = 0.30 + pulse * 0.10
    if (haloTopOuterRef.current) haloTopOuterRef.current.opacity = 0.15 + Math.sin(elapsed * 1.5 + 1) * 0.06
    if (haloBottomOuterRef.current) haloBottomOuterRef.current.opacity = 0.15 + Math.sin(elapsed * 1.5 + 1) * 0.06
    if (haloTopBrightRef.current) haloTopBrightRef.current.opacity = 0.55 + Math.sin(elapsed * 2) * 0.15
    if (haloBottomBrightRef.current) haloBottomBrightRef.current.opacity = 0.55 + Math.sin(elapsed * 2) * 0.15
  })

  return (
    <group position={position} ref={groupRef} name={`wormhole:${data.id}`}>
      <group position={[0, separation / 2, 0]}>
        <WormholeMouth
          radius={mouthRadius}
          direction={1}
          materialRef={mouthTopRef}
        />
        <LensingRings
          radius={mouthRadius}
          innerRef={haloTopInnerRef}
          outerRef={haloTopOuterRef}
          brightRef={haloTopBrightRef}
        />
        <DistortionGrid mouthRadius={mouthRadius} groupRef={gridTopRef} />
        <mesh ref={embeddingTopRef} geometry={embeddingTopGeometry}>
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
        <pointLight color="#6080ff" intensity={0.6} distance={12} />
      </group>

      <group position={[0, -separation / 2, 0]}>
        <WormholeMouth
          radius={mouthRadius}
          direction={-1}
          materialRef={mouthBottomRef}
        />
        <LensingRings
          radius={mouthRadius}
          innerRef={haloBottomInnerRef}
          outerRef={haloBottomOuterRef}
          brightRef={haloBottomBrightRef}
        />
        <DistortionGrid mouthRadius={mouthRadius} groupRef={gridBottomRef} />
        <mesh ref={embeddingBottomRef} geometry={embeddingBottomGeometry}>
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
        <pointLight color="#6080ff" intensity={0.6} distance={12} />
      </group>

      <instancedMesh
        ref={tidalTopRef}
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
      <instancedMesh
        ref={tidalBottomRef}
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

      <mesh geometry={throatGeometry}>
        <shaderMaterial
          ref={throatMaterialRef}
          vertexShader={THROAT_VERTEX}
          fragmentShader={THROAT_FRAGMENT}
          uniforms={throatUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <instancedMesh
        ref={energyRef}
        args={[energyGeometry, energyMaterial, ENERGY_COUNT]}
        frustumCulled={false}
      />
      <mesh>
        <sphereGeometry args={[throatRadius * 0.3, 16, 16]} />
        <meshBasicMaterial
          ref={flashMaterialRef}
          color="#80d0ff"
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <PlanetLabel
        name={name}
        offset={separation / 2 + mouthRadius + 1}
        bodyId={data.id}
      />
    </group>
  )
}
