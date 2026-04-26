'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import PlanetLabel from './PlanetLabel'

// ─── Data Interface ──────────────────────────────────────────────
export interface BlackHoleData {
  id: string
  name: string
  position: [number, number, number]
  mass: number // in solar masses (e.g. 4 million for Sgr A*)
  eventHorizonRadius: number // visual radius for rendering
  description: string
  funFacts: string[]
}

// ─── Kerr Shadow Shader ────────────────────────────────────────
// The shadow of a spinning (Kerr) black hole is D-shaped due to
// frame-dragging. The spin parameter a* shifts the shadow centre
// and flattens one side. This shader renders the shadow shape
// approximated from the analytic formula for the Kerr shadow
// boundary in celestial coordinates (Bardeen 1973).

const kerrShadowVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const kerrShadowFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpinParam;  // a* ∈ [0, 1) — dimensionless spin parameter
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    // Map UV to [-1,1] centered on sphere
    vec2 c = vUv * 2.0 - 1.0;
    float dist = length(c);
    float angle = atan(c.y, c.x);

    // Kerr shadow shape: The shadow boundary in the equatorial plane
    // is approximated by shifting the circular shadow by the spin parameter
    // and flattening the prograde side.
    // For a* ≈ 0.5 (moderate spin), the shadow shifts ~10% and flattens ~5%
    float a = uSpinParam;

    // Horizontal shift of shadow centre (frame-dragging displacement)
    float shift = a * 0.12;
    // Asymmetric radius: prograde side is slightly flattened
    // r(θ) = 1.0 - a * 0.08 * cos(θ) — flattened on +x side
    float shadowRadius = 1.0 - a * 0.08 * cos(angle);

    // Shifted distance check
    vec2 shiftedCenter = c - vec2(shift, 0.0);
    float shiftedDist = length(shiftedCenter) / shadowRadius;

    // Shadow interior: pure black
    // Edge: soft falloff with subtle gravitational redshift glow
    if (shiftedDist < 0.95) {
      // Inside shadow — pure black
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if (shiftedDist < 1.15) {
      // Edge of shadow — faint reddish glow (gravitational redshift
      // of last photons escaping near the photon sphere)
      float edge = (shiftedDist - 0.95) / 0.20;
      float glow = pow(1.0 - edge, 3.0);
      // Slight Doppler asymmetry: approaching side brighter
      float doppler = 1.0 + 0.3 * sin(angle + uTime * 0.15);
      vec3 edgeColor = vec3(0.6, 0.2, 0.05) * glow * doppler;
      gl_FragColor = vec4(edgeColor, glow * 0.6);
    } else {
      discard;
    }
  }
`

// ─── Accretion Disk GLSL Shaders ────────────────────────────────
// Implements Doppler beaming, temperature gradient (T ∝ r^(-3/4)),
// spiral turbulence, and gravitational redshift

const accretionDiskVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const accretionDiskFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uInnerRadius;
  uniform float uOuterRadius;
  uniform float uIscoRadius;     // normalised ISCO radius
  uniform float uEventHorizon;   // normalised event horizon radius

  varying vec2 vUv;
  varying vec3 vPosition;

  // ─── Simplex-style noise for turbulence ───
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // ─── Temperature to RGB (blackbody approximation) ───
  vec3 temperatureToColor(float t) {
    // t: 0 (cool, outer) to 1 (hot, inner)
    vec3 cool = vec3(1.0, 0.3, 0.05);   // Red-orange
    vec3 warm = vec3(1.0, 0.7, 0.2);    // Orange-yellow
    vec3 hot  = vec3(1.0, 0.95, 0.8);   // White-yellow
    vec3 vhot = vec3(0.7, 0.85, 1.0);   // Blue-white

    if (t < 0.33) return mix(cool, warm, t / 0.33);
    if (t < 0.66) return mix(warm, hot, (t - 0.33) / 0.33);
    return mix(hot, vhot, (t - 0.66) / 0.34);
  }

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float r = length(centered);
    float theta = atan(centered.y, centered.x);

    // Discard pixels outside the annular ring
    if (r < uEventHorizon || r > uOuterRadius) discard;

    // ─── Plunging Region (between ISCO and event horizon) ───
    // Matter in this region is on free-fall trajectories — no stable orbits.
    // It should appear dimmer, more chaotic, and redder (gravitational redshift).
    float isInPlunging = step(r, uIscoRadius) * step(uEventHorizon, r);

    // ─── Temperature Gradient: T ∝ r^(-3/4) ───
    float rNorm = (r - uInnerRadius) / (uOuterRadius - uInnerRadius);
    float temperature = pow(1.0 - rNorm, 0.75);

    // ─── Gravitational Redshift (enhanced) ───
    // z ∝ 1/sqrt(1 - Rs/r) — light from inner regions is redshifted
    // This also causes time dilation: particles appear to slow near EH
    float gravRedshift = 1.0 - 0.4 * pow(1.0 - rNorm, 2.0);

    // Extra redshift in the plunging region — much stronger
    float plungingRedshift = isInPlunging * 0.3 * pow(1.0 - (r - uEventHorizon) / max(0.01, uIscoRadius - uEventHorizon), 2.0);

    // Gravitational reddish tinge near event horizon
    float redshiftTinge = pow(max(0.0, 1.0 - rNorm), 3.0) * 0.25;

    // ─── Doppler Beaming ───
    float diskRotation = uTime * 0.3;
    float dopplerAngle = theta + diskRotation;
    float dopplerFactor = 1.0 + 0.6 * sin(dopplerAngle);
    float dopplerIntensity = pow(dopplerFactor, 2.5);

    // ─── Spiral Turbulence ───
    float spiralPhase = theta * 2.0 - log(r + 0.01) * 5.0 + uTime * 1.5;
    float turbulence = snoise(vec2(spiralPhase * 0.8, r * 8.0 + uTime * 0.5)) * 0.4;
    turbulence += snoise(vec2(spiralPhase * 1.6 + 3.7, r * 16.0 - uTime * 0.3)) * 0.2;

    // Plunging region: more chaotic turbulence
    float plungingTurbulence = isInPlunging * snoise(vec2(spiralPhase * 3.0, r * 24.0 + uTime * 2.0)) * 0.5;

    float spiralArms = 0.5 + 0.5 * sin(spiralPhase);
    spiralArms = pow(spiralArms, 0.6);

    // ─── Combine ───
    vec3 baseColor = temperatureToColor(temperature);

    // Apply Doppler
    vec3 dopplerColor = baseColor * dopplerIntensity;
    dopplerColor += vec3(-0.05, 0.0, 0.1) * max(0.0, dopplerFactor - 1.0);
    dopplerColor += vec3(0.1, -0.02, -0.08) * max(0.0, 1.0 - dopplerFactor);

    // Apply gravitational redshift
    dopplerColor *= (gravRedshift - plungingRedshift);

    // Apply gravitational reddish tinge (inner disk glow)
    dopplerColor += vec3(redshiftTinge, 0.0, -redshiftTinge * 0.5);

    // Apply spiral turbulence + plunging chaos
    float density = 0.5 + 0.5 * spiralArms + turbulence + plungingTurbulence;
    // Plunging region is dimmer
    density *= (1.0 - isInPlunging * 0.4);
    density = clamp(density, 0.05, 1.5);

    vec3 finalColor = dopplerColor * density;

    // Brightness falloff at edges
    float innerFade = smoothstep(uEventHorizon, uEventHorizon + 0.03, r);
    float outerFade = smoothstep(uOuterRadius, uOuterRadius - 0.1, r);
    float alpha = innerFade * outerFade * density * 0.9;

    // Boost inner disk brightness
    float innerBoost = 1.0 + 2.0 * pow(max(0.0, 1.0 - rNorm), 3.0);
    finalColor *= innerBoost;

    // Plunging region gets extra reddish tinge
    finalColor += vec3(0.15, 0.02, 0.0) * isInPlunging * (1.0 - rNorm);

    finalColor = clamp(finalColor, 0.0, 4.0);

    gl_FragColor = vec4(finalColor, alpha);
  }
`

// ─── ISCO Ring Shader (Dashed) ────────────────────────────────
const iscoRingVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const iscoRingFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    // Create dashed pattern along the ring
    float dashCount = 48.0;
    float dash = step(0.5, fract(vUv.x * dashCount));

    // Faint amber colour with low opacity
    vec3 ringColor = vec3(0.8, 0.55, 0.15);
    float alpha = dash * 0.25;

    // Subtle pulsation
    alpha *= 0.8 + 0.2 * sin(uTime * 0.8);

    gl_FragColor = vec4(ringColor, alpha);
  }
`

// ─── Props ──────────────────────────────────────────────────────
interface BlackHoleProps {
  data: BlackHoleData
}

export default function BlackHole({ data }: BlackHoleProps) {
  const {
    position,
    eventHorizonRadius,
    name,
  } = data

  // Derived radii from event horizon
  const photonSphereRadius = eventHorizonRadius * 1.5 // 1.5 × Schwarzschild radius
  const iscoRadius = eventHorizonRadius * 3.0 // ISCO for Schwarzschild = 3Rs
  const accretionDiskInner = eventHorizonRadius * 2.5 // Inner edge of stable accretion disk
  const accretionDiskOuter = eventHorizonRadius * 8.0
  const lensingRadius = eventHorizonRadius * 2.0

  // Kerr spin parameter (0 = Schwarzschild, approaches 1 = maximally spinning)
  // Sgr A* estimated spin: a* ≈ 0.5 from EHT observations
  const spinParam = 0.5

  // ─── Refs ───
  const groupRef = useRef<THREE.Group>(null!)
  const kerrShadowRef = useRef<THREE.ShaderMaterial>(null!)
  const accretionDiskRef = useRef<THREE.ShaderMaterial>(null!)
  const iscoRingRef = useRef<THREE.ShaderMaterial>(null!)
  const jetTopRef = useRef<THREE.Group>(null!)
  const jetBottomRef = useRef<THREE.Group>(null!)
  const matterSpiralRef = useRef<THREE.InstancedMesh>(null!)
  const jetParticlesTopRef = useRef<THREE.InstancedMesh>(null!)
  const jetParticlesBottomRef = useRef<THREE.InstancedMesh>(null!)
  const plungingParticlesRef = useRef<THREE.InstancedMesh>(null!)

  // ─── Kerr Shadow Uniforms ───
  const kerrUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpinParam: { value: spinParam },
  }), [spinParam])

  // ─── Accretion Disk Uniforms ───
  // Compute normalised ISCO and event horizon in UV space
  const diskUniforms = useMemo(() => {
    const diskFullRadius = accretionDiskOuter
    const uvInner = accretionDiskInner / diskFullRadius / 2.0 * 0.95
    const uvOuter = 0.95
    const uvIsco = iscoRadius / diskFullRadius / 2.0 * 0.95
    const uvEH = eventHorizonRadius / diskFullRadius / 2.0 * 0.95

    return {
      uTime: { value: 0 },
      uInnerRadius: { value: uvInner },
      uOuterRadius: { value: uvOuter },
      uIscoRadius: { value: uvIsco },
      uEventHorizon: { value: uvEH },
    }
  }, [eventHorizonRadius, iscoRadius, accretionDiskInner, accretionDiskOuter])

  // ─── ISCO Ring Uniforms ───
  const iscoUniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), [])

  // ─── Matter Spiral Particles ───
  const MATTER_COUNT = 180
  const matterParticleData = useRef(
    Array.from({ length: MATTER_COUNT }, () => {
      const r = accretionDiskInner * 0.6 + Math.random() * (accretionDiskOuter * 1.2 - accretionDiskInner * 0.6)
      const speed = 1.5 / Math.sqrt(r / eventHorizonRadius)
      return {
        angle: Math.random() * Math.PI * 2,
        radius: r,
        speed,
        offset: Math.random() * Math.PI * 2,
        y: (Math.random() - 0.5) * 0.15,
      }
    })
  )

  // ─── Plunging Region Particles ───
  // Particles between ISCO and event horizon in free-fall
  const PLUNGING_COUNT = 40
  const plungingParticleData = useRef(
    Array.from({ length: PLUNGING_COUNT }, () => {
      const r = eventHorizonRadius * 1.2 + Math.random() * (iscoRadius - eventHorizonRadius * 1.2)
      return {
        angle: Math.random() * Math.PI * 2,
        radius: r,
        speed: 3.0 / Math.sqrt(r / eventHorizonRadius), // faster — free-fall
        y: (Math.random() - 0.5) * 0.08,
        radialVelocity: -0.01 - Math.random() * 0.02, // inward free-fall
      }
    })
  )

  // ─── Jet Particles ───
  const JET_PARTICLE_COUNT = 60
  const jetParticleData = useMemo(() => {
    const particles: { speed: number; offset: number; lateralOffset: number }[] = []
    for (let i = 0; i < JET_PARTICLE_COUNT; i++) {
      particles.push({
        speed: 1.0 + Math.random() * 2.0,
        offset: Math.random() * Math.PI * 2,
        lateralOffset: (Math.random() - 0.5) * 0.1,
      })
    }
    return particles
  }, [])

  // ─── InstancedMesh Setup ───
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // ─── Animation ───
  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()

    // Update Kerr shadow shader
    if (kerrShadowRef.current) {
      kerrShadowRef.current.uniforms.uTime.value = elapsed
    }

    // Update accretion disk shader time
    if (accretionDiskRef.current) {
      accretionDiskRef.current.uniforms.uTime.value = elapsed
    }

    // Update ISCO ring shader time
    if (iscoRingRef.current) {
      iscoRingRef.current.uniforms.uTime.value = elapsed
    }

    // ─── Plunging Region Particles Animation ───
    if (plungingParticlesRef.current) {
      for (let i = 0; i < PLUNGING_COUNT; i++) {
        const p = plungingParticleData.current[i]

        // Free-fall inward — accelerating as approaching event horizon
        const gravAccel = 0.005 * (eventHorizonRadius / Math.max(0.5, p.radius)) ** 2
        p.radius += p.radialVelocity - gravAccel

        // Reset when reaching event horizon
        if (p.radius < eventHorizonRadius * 1.05) {
          p.radius = iscoRadius * (0.85 + Math.random() * 0.15)
          p.angle = Math.random() * Math.PI * 2
        }

        // Angular velocity — slower than stable orbit, increasingly chaotic
        const angularVelocity = p.speed * 0.15 * (1.0 + 0.5 * Math.sin(elapsed * 3.0 + i))
        p.angle += angularVelocity * 0.016

        // Position in disk plane (tilted)
        const x = Math.cos(p.angle) * p.radius
        const z = Math.sin(p.angle) * p.radius
        const y = p.y * (1.0 + Math.sin(elapsed * 5.0 + i * 0.7) * 0.3) // chaotic vertical motion

        const tiltAngle = 0.52
        const tiltedY = y * Math.cos(tiltAngle) - z * Math.sin(tiltAngle)
        const tiltedZ = y * Math.sin(tiltAngle) + z * Math.cos(tiltAngle)

        dummy.position.set(x, tiltedY, tiltedZ)
        const scale = 0.02 + Math.random() * 0.02
        dummy.scale.set(scale, scale, scale)
        dummy.updateMatrix()
        plungingParticlesRef.current.setMatrixAt(i, dummy.matrix)

        // Dim reddish color for plunging region
        const proximity = 1.0 - Math.min(1.0, (p.radius - eventHorizonRadius) / (iscoRadius - eventHorizonRadius))
        const color = new THREE.Color()
        color.setRGB(0.8 + proximity * 0.2, 0.15 + proximity * 0.1, 0.02)
        plungingParticlesRef.current.setColorAt(i, color)
      }
      plungingParticlesRef.current.instanceMatrix.needsUpdate = true
      if (plungingParticlesRef.current.instanceColor) {
        plungingParticlesRef.current.instanceColor.needsUpdate = true
      }
    }

    // ─── Matter Spiral Animation ───
    if (matterSpiralRef.current) {
      for (let i = 0; i < MATTER_COUNT; i++) {
        const p = matterParticleData.current[i]
        // Gravitational time dilation: particles slow down near the event horizon
        const timeDilation = Math.sqrt(1.0 - eventHorizonRadius / Math.max(eventHorizonRadius * 1.1, p.radius))
        const effectiveSpeed = p.speed * timeDilation

        p.radius -= 0.002 * (1.0 / Math.max(0.5, p.radius / eventHorizonRadius))

        if (p.radius < iscoRadius * 0.9) {
          p.radius = accretionDiskOuter * (0.8 + Math.random() * 0.4)
          p.angle = Math.random() * Math.PI * 2
        }

        const angularVelocity = effectiveSpeed * (accretionDiskOuter / p.radius) * 0.3
        p.angle += angularVelocity * 0.016

        const proximity = 1.0 - Math.min(1.0, (p.radius - eventHorizonRadius) / (accretionDiskOuter - eventHorizonRadius))

        const x = Math.cos(p.angle) * p.radius
        const z = Math.sin(p.angle) * p.radius
        const y = p.y * (1.0 - proximity * 0.5)

        const tiltAngle = 0.52
        const tiltedY = y * Math.cos(tiltAngle) - z * Math.sin(tiltAngle)
        const tiltedZ = y * Math.sin(tiltAngle) + z * Math.cos(tiltAngle)

        dummy.position.set(x, tiltedY, tiltedZ)
        const scale = 0.03 + proximity * 0.05
        dummy.scale.set(scale, scale, scale)
        dummy.updateMatrix()
        matterSpiralRef.current.setMatrixAt(i, dummy.matrix)

        const color = new THREE.Color()
        if (proximity > 0.7) {
          color.setRGB(0.8 + proximity * 0.2, 0.85 + proximity * 0.15, 1.0)
        } else if (proximity > 0.3) {
          color.setRGB(1.0, 0.8 + proximity * 0.3, 0.3 + proximity * 0.4)
        } else {
          color.setRGB(1.0, 0.3 + proximity * 1.5, 0.05 + proximity * 0.3)
        }
        matterSpiralRef.current.setColorAt(i, color)
      }
      matterSpiralRef.current.instanceMatrix.needsUpdate = true
      if (matterSpiralRef.current.instanceColor) {
        matterSpiralRef.current.instanceColor.needsUpdate = true
      }
    }

    // ─── Jet Particles Animation ───
    if (jetParticlesTopRef.current) {
      const jetLength = eventHorizonRadius * 12
      for (let i = 0; i < JET_PARTICLE_COUNT; i++) {
        const p = jetParticleData[i]
        const t = ((elapsed * p.speed + p.offset) % 3.0) / 3.0
        const yPos = t * jetLength
        const lateralSpread = t * 0.3
        const xPos = Math.sin(elapsed * 2 + p.offset) * lateralSpread + p.lateralOffset
        const zPos = Math.cos(elapsed * 2 + p.offset) * lateralSpread + p.lateralOffset

        dummy.position.set(xPos, yPos, zPos)
        const scale = (1.0 - t) * 0.08 + 0.02
        dummy.scale.set(scale, scale * 2, scale)
        dummy.updateMatrix()
        jetParticlesTopRef.current.setMatrixAt(i, dummy.matrix)

        const color = new THREE.Color()
        const brightness = (1.0 - t * 0.7)
        color.setRGB(0.5 * brightness, 0.7 * brightness, 1.0 * brightness)
        jetParticlesTopRef.current.setColorAt(i, color)
      }
      jetParticlesTopRef.current.instanceMatrix.needsUpdate = true
      if (jetParticlesTopRef.current.instanceColor) {
        jetParticlesTopRef.current.instanceColor.needsUpdate = true
      }
    }

    if (jetParticlesBottomRef.current) {
      const jetLength = eventHorizonRadius * 12
      for (let i = 0; i < JET_PARTICLE_COUNT; i++) {
        const p = jetParticleData[i]
        const t = ((elapsed * p.speed + p.offset + 1.5) % 3.0) / 3.0
        const yPos = -t * jetLength
        const lateralSpread = t * 0.3
        const xPos = Math.sin(elapsed * 2 + p.offset) * lateralSpread + p.lateralOffset
        const zPos = Math.cos(elapsed * 2 + p.offset) * lateralSpread + p.lateralOffset

        dummy.position.set(xPos, yPos, zPos)
        const scale = (1.0 - t) * 0.08 + 0.02
        dummy.scale.set(scale, scale * 2, scale)
        dummy.updateMatrix()
        jetParticlesBottomRef.current.setMatrixAt(i, dummy.matrix)

        const color = new THREE.Color()
        const brightness = (1.0 - t * 0.7)
        color.setRGB(0.5 * brightness, 0.7 * brightness, 1.0 * brightness)
        jetParticlesBottomRef.current.setColorAt(i, color)
      }
      jetParticlesBottomRef.current.instanceMatrix.needsUpdate = true
      if (jetParticlesBottomRef.current.instanceColor) {
        jetParticlesBottomRef.current.instanceColor.needsUpdate = true
      }
    }

    // ─── Jet Pulse Animation ───
    const jetPulse = 1.0 + Math.sin(elapsed * 2.0) * 0.08
    if (jetTopRef.current) {
      jetTopRef.current.scale.set(jetPulse, 1.0, jetPulse)
    }
    if (jetBottomRef.current) {
      jetBottomRef.current.scale.set(jetPulse, 1.0, jetPulse)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* ─── 1. Kerr Metric Shadow ─── */}
      {/* D-shaped shadow from a spinning black hole (frame-dragging) */}
      {/* Replaces the simple black sphere with a physically accurate shadow */}
      <mesh>
        <sphereGeometry args={[eventHorizonRadius * 1.05, 64, 64]} />
        <shaderMaterial
          ref={kerrShadowRef}
          vertexShader={kerrShadowVertexShader}
          fragmentShader={kerrShadowFragmentShader}
          uniforms={kerrUniforms}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Inner pure black core (fallback behind shader) */}
      <mesh>
        <sphereGeometry args={[eventHorizonRadius * 0.98, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* ─── 2. Accretion Disk with Doppler Beaming & Plunging Region ─── */}
      <group rotation={[0.52, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[eventHorizonRadius * 1.1, accretionDiskOuter, 128, 32]} />
          <shaderMaterial
            ref={accretionDiskRef}
            vertexShader={accretionDiskVertexShader}
            fragmentShader={accretionDiskFragmentShader}
            uniforms={diskUniforms}
            transparent
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ─── 3. ISCO Ring Indicator ─── */}
      {/* Dashed amber ring at 3×Rs showing the innermost stable circular orbit */}
      {/* This is the true inner edge of the accretion disk */}
      <mesh rotation={[0.52, 0, 0]}>
        <torusGeometry args={[iscoRadius, 0.02, 8, 128]} />
        <shaderMaterial
          ref={iscoRingRef}
          vertexShader={iscoRingVertexShader}
          fragmentShader={iscoRingFragmentShader}
          uniforms={iscoUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ─── 4. Photon Sphere ─── */}
      <mesh rotation={[0.52, 0, 0]}>
        <torusGeometry args={[photonSphereRadius, 0.03, 16, 128]} />
        <meshBasicMaterial
          color="#FFE8B0"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ─── 5. Gravitational Lensing Effect ─── */}
      <mesh rotation={[0.52, 0, 0]}>
        <torusGeometry args={[lensingRadius, 0.06, 16, 128]} />
        <meshBasicMaterial
          color="#FFD080"
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[0.52, 0, 0]}>
        <torusGeometry args={[lensingRadius * 1.15, 0.12, 16, 128]} />
        <meshBasicMaterial
          color="#FFB860"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ─── 6. Relativistic Jets ─── */}
      <group ref={jetTopRef}>
        <mesh position={[0, eventHorizonRadius * 6, 0]}>
          <cylinderGeometry args={[0.04, 0.15, eventHorizonRadius * 12, 16, 1, true]} />
          <meshBasicMaterial
            color="#80B0FF"
            transparent
            opacity={0.12}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, eventHorizonRadius * 6, 0]}>
          <cylinderGeometry args={[0.02, 0.06, eventHorizonRadius * 12, 8, 1, true]} />
          <meshBasicMaterial
            color="#A0C8FF"
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, eventHorizonRadius * 0.8, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial
            color="#A0C8FF"
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      <group ref={jetBottomRef}>
        <mesh position={[0, -eventHorizonRadius * 6, 0]}>
          <cylinderGeometry args={[0.04, 0.15, eventHorizonRadius * 12, 16, 1, true]} />
          <meshBasicMaterial
            color="#80B0FF"
            transparent
            opacity={0.12}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, -eventHorizonRadius * 6, 0]}>
          <cylinderGeometry args={[0.02, 0.06, eventHorizonRadius * 12, 8, 1, true]} />
          <meshBasicMaterial
            color="#A0C8FF"
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, -eventHorizonRadius * 0.8, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial
            color="#A0C8FF"
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Top Jet Particles */}
      <instancedMesh
        ref={jetParticlesTopRef}
        args={[undefined, undefined, JET_PARTICLE_COUNT]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Bottom Jet Particles */}
      <instancedMesh
        ref={jetParticlesBottomRef}
        args={[undefined, undefined, JET_PARTICLE_COUNT]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* ─── 7. Matter Spiral (Infalling Matter) ─── */}
      <instancedMesh
        ref={matterSpiralRef}
        args={[undefined, undefined, MATTER_COUNT]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* ─── 8. Plunging Region Particles ─── */}
      {/* Dimmer, chaotic particles free-falling between ISCO and event horizon */}
      <instancedMesh
        ref={plungingParticlesRef}
        args={[undefined, undefined, PLUNGING_COUNT]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* ─── Point lights for visibility ─── */}
      <pointLight
        color="#FFB060"
        intensity={3}
        distance={30}
        decay={2}
      />

      <pointLight
        color="#80A0FF"
        intensity={1}
        distance={20}
        decay={2}
      />

      {/* ─── 9. Label ─── */}
      <PlanetLabel name={name} offset={eventHorizonRadius * 9} bodyId={data.id} />
    </group>
  )
}
