'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrameLane } from './FrameUpdateLanes'
import PlanetLabel from './PlanetLabel'

export interface BlackHoleData {
  id: string
  name: string
  position: [number, number, number]
  mass: number
  eventHorizonRadius: number
  description: string
  funFacts: string[]
}

const SHADOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SHADOW_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSpin;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float angle = atan(centered.y, centered.x);
    vec2 shifted = centered - vec2(uSpin * 0.12, 0.0);
    float radius = 1.0 - uSpin * 0.08 * cos(angle);
    float distanceToShadow = length(shifted) / radius;

    float fresnel = pow(
      1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0),
      2.0
    );
    float edge = smoothstep(1.16, 0.94, distanceToShadow)
      - smoothstep(0.98, 0.90, distanceToShadow);
    float doppler = 1.0 + 0.35 * sin(angle + uTime * 0.15);
    vec3 glow = vec3(0.65, 0.18, 0.035) * edge * doppler;
    glow += vec3(0.08, 0.02, 0.18) * fresnel * 0.35;

    if (distanceToShadow < 0.95) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if (distanceToShadow < 1.18) {
      gl_FragColor = vec4(glow, max(edge * 0.8, fresnel * 0.12));
    } else {
      discard;
    }
  }
`

const DISK_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const DISK_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash(cell);
    float b = hash(cell + vec2(1.0, 0.0));
    float c = hash(cell + vec2(0.0, 1.0));
    float d = hash(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float radius = length(centered);
    if (radius < 0.18 || radius > 1.0) discard;

    float angle = atan(centered.y, centered.x);
    float radial = clamp((radius - 0.18) / 0.82, 0.0, 1.0);
    float temperature = pow(1.0 - radial, 0.72);
    float spiral = 0.5 + 0.5 * sin(
      angle * 3.0 - log(radius + 0.02) * 7.0 + uTime * 1.7
    );
    float turbulence = noise(vec2(
      angle * 2.2 + uTime * 0.35,
      radius * 18.0 - uTime * 0.22
    ));

    float doppler = 1.0 + 0.65 * sin(angle + uTime * 0.28);
    vec3 cool = vec3(0.95, 0.18, 0.03);
    vec3 warm = vec3(1.0, 0.58, 0.08);
    vec3 hot = vec3(1.0, 0.95, 0.78);
    vec3 veryHot = vec3(0.68, 0.84, 1.0);
    vec3 color = temperature < 0.55
      ? mix(cool, warm, temperature / 0.55)
      : mix(hot, veryHot, (temperature - 0.55) / 0.45);

    color *= pow(max(0.25, doppler), 1.7);
    color *= 0.45 + spiral * 0.42 + turbulence * 0.34;
    color += vec3(0.22, 0.02, 0.0) * pow(1.0 - radial, 3.0);

    float innerFade = smoothstep(0.18, 0.23, radius);
    float outerFade = smoothstep(1.0, 0.82, radius);
    float alpha = innerFade * outerFade * (0.48 + spiral * 0.42);
    gl_FragColor = vec4(clamp(color, 0.0, 4.0), alpha);
  }
`

interface MatterParticle {
  angle: number
  radius: number
  speed: number
  vertical: number
}

interface JetParticle {
  phase: number
  speed: number
  radial: number
  angle: number
}

const MATTER_COUNT = 180
const PLUNGING_COUNT = 40
const JET_COUNT = 60

export default function BlackHole({ data }: { data: BlackHoleData }) {
  const {
    id,
    name,
    position,
    eventHorizonRadius,
  } = data
  const spin = 0.5
  const photonSphereRadius = eventHorizonRadius * 1.5
  const iscoRadius = eventHorizonRadius * 3
  const diskInner = eventHorizonRadius * 2.5
  const diskOuter = eventHorizonRadius * 8
  const jetHeight = eventHorizonRadius * 16

  const groupRef = useRef<THREE.Group>(null)
  const shadowMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const diskMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const photonMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const matterRef = useRef<THREE.InstancedMesh>(null)
  const plungingRef = useRef<THREE.InstancedMesh>(null)
  const jetTopRef = useRef<THREE.InstancedMesh>(null)
  const jetBottomRef = useRef<THREE.InstancedMesh>(null)
  const elapsedRef = useRef(0)
  const dummyRef = useRef(new THREE.Object3D())
  const colorRef = useRef(new THREE.Color())

  const shadowUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpin: { value: spin },
  }), [])
  const diskUniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), [])

  const matterParticles = useMemo<MatterParticle[]>(() => Array.from(
    { length: MATTER_COUNT },
    (_, index) => {
      const fraction = ((index * 37) % MATTER_COUNT) / MATTER_COUNT
      const radius = diskInner * 0.65
        + fraction * (diskOuter * 1.14 - diskInner * 0.65)
      return {
        angle: index * 0.71,
        radius,
        speed: 1.5 / Math.sqrt(radius / eventHorizonRadius),
        vertical: (((index * 19) % 31) / 31 - 0.5) * 0.15,
      }
    }
  ), [diskInner, diskOuter, eventHorizonRadius])

  const plungingParticles = useMemo<MatterParticle[]>(() => Array.from(
    { length: PLUNGING_COUNT },
    (_, index) => {
      const fraction = ((index * 11) % PLUNGING_COUNT) / PLUNGING_COUNT
      const radius = eventHorizonRadius * 1.2
        + fraction * (iscoRadius - eventHorizonRadius * 1.2)
      return {
        angle: index * 1.17,
        radius,
        speed: 3 / Math.sqrt(radius / eventHorizonRadius),
        vertical: (((index * 7) % 17) / 17 - 0.5) * 0.08,
      }
    }
  ), [eventHorizonRadius, iscoRadius])

  const jetParticles = useMemo<JetParticle[]>(() => Array.from(
    { length: JET_COUNT },
    (_, index) => ({
      phase: ((index * 29) % JET_COUNT) / JET_COUNT,
      speed: 0.75 + ((index * 13) % 41) / 20,
      radial: eventHorizonRadius * (0.05 + ((index * 17) % 23) / 75),
      angle: index * 0.93,
    })
  ), [eventHorizonRadius])

  const particleGeometry = useMemo(
    () => new THREE.IcosahedronGeometry(1, 0),
    []
  )
  const matterMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffb35a',
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])
  const plungingMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ff5b28',
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])
  const jetMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#8bc8ff',
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  useFrameLane({
    id: `black-hole:${id}`,
    lane: 'decorative',
    priority: 96,
  }, ({ laneDelta }) => {
    const step = Math.min(laneDelta, 0.08)
    const elapsed = elapsedRef.current + laneDelta
    elapsedRef.current = elapsed
    const dummy = dummyRef.current
    const color = colorRef.current

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(elapsed * 0.035) * 0.07
    }
    if (shadowMaterialRef.current) {
      shadowMaterialRef.current.uniforms.uTime.value = elapsed
    }
    if (diskMaterialRef.current) {
      diskMaterialRef.current.uniforms.uTime.value = elapsed
    }
    if (photonMaterialRef.current) {
      photonMaterialRef.current.opacity = 0.48
        + Math.sin(elapsed * 1.7) * 0.12
    }

    if (matterRef.current) {
      for (let index = 0; index < matterParticles.length; index += 1) {
        const particle = matterParticles[index]
        particle.angle += step * particle.speed
        const wobble = Math.sin(elapsed * 0.8 + index) * 0.04
        dummy.position.set(
          Math.cos(particle.angle) * particle.radius,
          particle.vertical + wobble,
          Math.sin(particle.angle) * particle.radius
        )
        const scale = eventHorizonRadius * (
          0.045 + 0.035 * (1 - particle.radius / (diskOuter * 1.2))
        )
        dummy.scale.setScalar(Math.max(eventHorizonRadius * 0.025, scale))
        dummy.rotation.set(0, particle.angle, 0)
        dummy.updateMatrix()
        matterRef.current.setMatrixAt(index, dummy.matrix)
      }
      matterRef.current.instanceMatrix.needsUpdate = true
    }

    if (plungingRef.current) {
      for (let index = 0; index < plungingParticles.length; index += 1) {
        const particle = plungingParticles[index]
        particle.angle += step * particle.speed
        particle.radius -= step * eventHorizonRadius * (
          0.12 + (index % 7) * 0.008
        )
        if (particle.radius <= eventHorizonRadius * 1.08) {
          particle.radius = iscoRadius
          particle.angle += 1.3
        }
        dummy.position.set(
          Math.cos(particle.angle) * particle.radius,
          particle.vertical,
          Math.sin(particle.angle) * particle.radius
        )
        dummy.scale.setScalar(eventHorizonRadius * 0.038)
        dummy.rotation.set(0, particle.angle, 0)
        dummy.updateMatrix()
        plungingRef.current.setMatrixAt(index, dummy.matrix)
      }
      plungingRef.current.instanceMatrix.needsUpdate = true
    }

    const updateJet = (
      mesh: THREE.InstancedMesh | null,
      direction: 1 | -1
    ) => {
      if (!mesh) return

      for (let index = 0; index < jetParticles.length; index += 1) {
        const particle = jetParticles[index]
        const progress = (
          particle.phase + elapsed * particle.speed * 0.08
        ) % 1
        const height = progress * jetHeight
        const angle = particle.angle + elapsed * 0.7 * direction
        const radial = particle.radial * (0.35 + progress * 1.2)
        dummy.position.set(
          Math.cos(angle) * radial,
          direction * (eventHorizonRadius * 1.2 + height),
          Math.sin(angle) * radial
        )
        dummy.rotation.set(0, angle, 0)
        dummy.scale.set(
          eventHorizonRadius * 0.025,
          eventHorizonRadius * (0.055 + progress * 0.08),
          eventHorizonRadius * 0.025
        )
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)

        const fade = 1 - progress
        color.setRGB(
          0.35 + fade * 0.35,
          0.62 + fade * 0.28,
          1
        )
        mesh.setColorAt(index, color)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    updateJet(jetTopRef.current, 1)
    updateJet(jetBottomRef.current, -1)
  })

  return (
    <group position={position} ref={groupRef} name={`black-hole:${id}`}>
      <mesh>
        <sphereGeometry args={[eventHorizonRadius, 64, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <mesh scale={1.36}>
        <sphereGeometry args={[eventHorizonRadius, 64, 48]} />
        <shaderMaterial
          ref={shadowMaterialRef}
          vertexShader={SHADOW_VERTEX}
          fragmentShader={SHADOW_FRAGMENT}
          uniforms={shadowUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[diskInner, diskOuter, 192, 8]} />
        <shaderMaterial
          ref={diskMaterialRef}
          vertexShader={DISK_VERTEX}
          fragmentShader={DISK_FRAGMENT}
          uniforms={diskUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[photonSphereRadius, eventHorizonRadius * 0.08, 16, 128]} />
        <meshBasicMaterial
          ref={photonMaterialRef}
          color="#ffd8a0"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[iscoRadius - 0.025, iscoRadius + 0.025, 128]} />
        <meshBasicMaterial
          color="#d79a38"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <instancedMesh
        ref={matterRef}
        args={[particleGeometry, matterMaterial, MATTER_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={plungingRef}
        args={[particleGeometry, plungingMaterial, PLUNGING_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={jetTopRef}
        args={[particleGeometry, jetMaterial, JET_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={jetBottomRef}
        args={[particleGeometry, jetMaterial, JET_COUNT]}
        frustumCulled={false}
      />

      <pointLight
        color="#ff9f43"
        intensity={1.2}
        distance={diskOuter * 2.2}
      />
      <PlanetLabel
        name={name}
        offset={diskOuter + eventHorizonRadius * 2}
        bodyId={id}
      />
    </group>
  )
}
