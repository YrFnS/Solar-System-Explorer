'use client'

import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { PlanetData } from './data'
import { useSolarSystemStore } from './store'
import PlanetLabel from './PlanetLabel'
import MoonComponent from './Moon'
import Rings from './Rings'
import OrbitalTrail from './OrbitalTrail'

interface PlanetProps {
  data: PlanetData
}

import { useTexture } from '@react-three/drei'

function TexturedPlanetSurface({ data }: { data: PlanetData }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  const textures = useTexture({
    map: data.textureUrl!,
  })

  const cloudTexture = data.cloudMapUrl ? useTexture(data.cloudMapUrl) : null
  const cloudRef = useRef<THREE.Mesh>(null!)

  useFrame((_, delta) => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += delta * 0.03
    }
  })

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[data.radius, 64, 64]} />
        <meshStandardMaterial 
          map={textures.map}
          roughness={data.type === 'Gas Giant' || data.type === 'Ice Giant' ? 0.4 : 0.8}
          metalness={data.type === 'Gas Giant' ? 0.1 : 0.2}
        />
      </mesh>
      {cloudTexture && (
        <mesh ref={cloudRef}>
          <sphereGeometry args={[data.radius * 1.015, 64, 64]} />
          <meshStandardMaterial
            map={cloudTexture}
            transparent
            opacity={0.6}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  )
}

function ColorPlanetSurface({ data }: { data: PlanetData }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const material = useMemo(() => {
    const baseColor = new THREE.Color(data.color)

    // Different shader behavior for different planet types
    const isGasGiant = data.type === 'Gas Giant'
    const isIceGiant = data.type === 'Ice Giant'
    const isEarth = data.id === 'earth'
    const isMars = data.id === 'mars'
    const isSaturn = data.id === 'saturn'
    const isJupiter = data.id === 'jupiter'
    const isVenus = data.id === 'venus'
    const isMercury = data.id === 'mercury'
    const isNeptune = data.id === 'neptune'

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: baseColor },
        lightDir: { value: new THREE.Vector3(0, 0, 1).normalize() },
        isGasGiant: { value: isGasGiant ? 1.0 : 0.0 },
        isIceGiant: { value: isIceGiant ? 1.0 : 0.0 },
        isEarth: { value: isEarth ? 1.0 : 0.0 },
        isMars: { value: isMars ? 1.0 : 0.0 },
        isSaturn: { value: isSaturn ? 1.0 : 0.0 },
        isJupiter: { value: isJupiter ? 1.0 : 0.0 },
        isVenus: { value: isVenus ? 1.0 : 0.0 },
        isMercury: { value: isMercury ? 1.0 : 0.0 },
        isNeptune: { value: isNeptune ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        uniform float time;
        uniform vec3 baseColor;
        uniform vec3 lightDir;
        uniform float isGasGiant;
        uniform float isIceGiant;
        uniform float isEarth;
        uniform float isMars;
        uniform float isSaturn;
        uniform float isJupiter;
        uniform float isVenus;
        uniform float isMercury;
        uniform float isNeptune;
        
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
          vec3 normal = normalize(vNormal);
          float diff = max(dot(normal, lightDir), 0.0);
          float ambient = 0.12;
          
          vec2 uv = vUv;
          float n = fbm(uv * 8.0 + time * 0.01);
          float n2 = fbm(uv * 16.0 - time * 0.02);
          
          vec3 color = baseColor;
          
          // Gas giant banding (Jupiter/Saturn)
          if (isGasGiant > 0.5) {
            float bands = sin(uv.y * 30.0 + n * 4.0) * 0.5 + 0.5;
            float bands2 = sin(uv.y * 50.0 + n2 * 2.0) * 0.3;
            color = mix(color * 0.7, color * 1.3, bands);
            color = mix(color, color * 0.85, bands2 > 0.0 ? bands2 : 0.0);
          }
          
          // Jupiter-specific: Enhanced banding, storms, and Great Red Spot
          if (isJupiter > 0.5) {
            // More detailed brown belt/zone differentiation
            vec3 lightZone = vec3(0.85, 0.75, 0.55); // light zones (cream/white)
            vec3 darkBelt = vec3(0.55, 0.35, 0.15);   // dark belts (brown/reddish)
            vec3 midTone = vec3(0.75, 0.60, 0.40);    // mid-tones
            
            // Wavy banding with distortion
            float wave = sin(uv.x * 20.0 + time * 0.05) * 0.02 + sin(uv.x * 35.0 - time * 0.03) * 0.015;
            float bandsJ = sin((uv.y + wave) * 28.0 + n * 3.0) * 0.5 + 0.5;
            float bandsJ2 = sin((uv.y + wave * 0.5) * 45.0 + n2 * 1.5) * 0.3;
            
            // Three-way mix for belt/zone structure
            vec3 bandColor = mix(darkBelt, lightZone, bandsJ);
            bandColor = mix(bandColor, midTone, bandsJ2 * step(0.0, bandsJ2));
            color = bandColor;
            
            // Great Red Spot (larger, more prominent)
            float spotDist = length((uv - vec2(0.3, 0.55)) * vec2(1.5, 3.0));
            float spot = smoothstep(0.18, 0.06, spotDist);
            vec3 grsColor = vec3(0.85, 0.25, 0.08);
            color = mix(color, grsColor, spot * 0.8);
            // GRS ring/aura
            float spotRing = smoothstep(0.22, 0.15, spotDist) - smoothstep(0.15, 0.08, spotDist);
            color = mix(color, vec3(0.9, 0.5, 0.2), spotRing * 0.3);
            
            // Second storm: White Oval (BA)
            float ovalDist = length((uv - vec2(0.65, 0.42)) * vec2(2.0, 4.0));
            float oval = smoothstep(0.1, 0.04, ovalDist);
            color = mix(color, vec3(0.95, 0.85, 0.7), oval * 0.5);
            
            // Third storm: Small dark barge
            float bargeDist = length((uv - vec2(0.15, 0.68)) * vec2(2.5, 5.0));
            float barge = smoothstep(0.08, 0.03, bargeDist);
            color = mix(color, vec3(0.35, 0.2, 0.1), barge * 0.4);
            
            // Equatorial darkening
            float eqBand = smoothstep(0.06, 0.0, abs(uv.y - 0.48)) * 0.15;
            color = mix(color, color * 0.7, eqBand);
          }
          
          // Saturn-specific: Enhanced subtle bands with belt/zone structure
          if (isSaturn > 0.5) {
            vec3 satLightZone = vec3(0.92, 0.85, 0.65); // pale gold zones
            vec3 satDarkBelt = vec3(0.72, 0.60, 0.38);  // darker brown belts
            
            // Wavy banding
            float satWave = sin(uv.x * 15.0 + time * 0.03) * 0.01;
            float satBands = sin((uv.y + satWave) * 18.0 + n * 1.5) * 0.5 + 0.5;
            float satBands2 = sin((uv.y + satWave) * 30.0 + n2 * 1.0) * 0.2;
            
            vec3 satColor = mix(satDarkBelt, satLightZone, satBands);
            satColor = mix(satColor, satColor * 0.9, satBands2 > 0.0 ? satBands2 : 0.0);
            color = satColor;
            
            // Warm golden tint
            color = mix(color, vec3(1.0, 0.9, 0.6), 0.08);
            
            // Hexagonal north pole storm - visible near the top
            float hexDist = length((uv - vec2(0.5, 0.05)) * vec2(1.0, 2.5));
            float hexAngle = atan(uv.x - 0.5, (uv.y - 0.05) * 2.5);
            float hexShape = abs(cos(hexAngle * 3.0)) * 0.06 + hexDist;
            float hexStorm = smoothstep(0.14, 0.05, hexShape);
            color = mix(color, vec3(0.7, 0.85, 1.0), hexStorm * 0.4);
            // Hex storm edge glow
            float hexEdge = smoothstep(0.16, 0.12, hexShape) - smoothstep(0.12, 0.08, hexShape);
            color = mix(color, vec3(0.8, 0.92, 1.0), hexEdge * 0.3);
            
            // Subtle storm feature
            float satStormDist = length((uv - vec2(0.5, 0.52)) * vec2(2.0, 4.0));
            float satStorm = smoothstep(0.08, 0.03, satStormDist);
            color = mix(color, vec3(0.95, 0.88, 0.65), satStorm * 0.3);
          }
          
          // Ice giant subtle banding
          if (isIceGiant > 0.5) {
            float bands = sin(uv.y * 20.0 + n * 2.0) * 0.3;
            color = mix(color * 0.9, color * 1.1, bands + 0.5);
            
            // Atmospheric haze
            float haze = smoothstep(0.3, 0.0, abs(uv.y - 0.5)) * 0.2;
            color = mix(color, vec3(0.8, 0.9, 1.0), haze);
          }
          
          // Neptune-specific: Great Dark Spot and vivid coloring
          if (isNeptune > 0.5) {
            // Vivid blue-teal base
            vec3 nepDeep = vec3(0.1, 0.15, 0.5);   // deep blue
            vec3 nepTeal = vec3(0.15, 0.35, 0.55);  // blue-teal
            vec3 nepBright = vec3(0.3, 0.5, 0.75);  // lighter blue
            
            // Wavy banding with strong distortion
            float nepWave = sin(uv.x * 12.0 + time * 0.04) * 0.02 + sin(uv.x * 25.0 - time * 0.02) * 0.01;
            float nepBands = sin((uv.y + nepWave) * 16.0 + n * 2.0) * 0.5 + 0.5;
            float nepBands2 = sin((uv.y + nepWave * 0.5) * 28.0 + n2 * 1.0) * 0.3;
            
            color = mix(nepDeep, nepTeal, nepBands);
            color = mix(color, nepBright, nepBands2 * step(0.0, nepBands2));
            
            // Great Dark Spot
            float gdsDist = length((uv - vec2(0.4, 0.45)) * vec2(1.8, 3.5));
            float gds = smoothstep(0.14, 0.05, gdsDist);
            color = mix(color, vec3(0.04, 0.06, 0.2), gds * 0.7);
            // GDS bright companion cloud
            float companionDist = length((uv - vec2(0.38, 0.38)) * vec2(2.0, 4.0));
            float companion = smoothstep(0.06, 0.02, companionDist);
            color = mix(color, vec3(0.6, 0.8, 1.0), companion * 0.5);
            
            // Second smaller storm
            float nepStorm2 = length((uv - vec2(0.7, 0.55)) * vec2(2.5, 5.0));
            float s2 = smoothstep(0.06, 0.02, nepStorm2);
            color = mix(color, vec3(0.5, 0.7, 0.95), s2 * 0.3);
            
            // Subtle bright cloud streaks
            float streaks = fbm(vec2(uv.x * 8.0 + time * 0.02, uv.y * 3.0));
            float streakMask = smoothstep(0.55, 0.65, streaks) * smoothstep(0.35, 0.55, uv.y) * smoothstep(0.75, 0.55, uv.y);
            color = mix(color, vec3(0.5, 0.75, 1.0), streakMask * 0.2);
          }
          
          // Earth-like surface
          if (isEarth > 0.5) {
            // Continents vs ocean
            float continents = fbm(uv * 6.0 + vec2(0.5, 0.3));
            float landMask = smoothstep(0.45, 0.55, continents);
            
            vec3 oceanColor = vec3(0.1, 0.3, 0.8);
            vec3 landColor = vec3(0.2, 0.6, 0.15);
            vec3 desertColor = vec3(0.7, 0.6, 0.3);
            vec3 iceColor = vec3(0.95, 0.95, 1.0);
            
            vec3 landMix = mix(landColor, desertColor, fbm(uv * 10.0));
            color = mix(oceanColor, landMix, landMask);
            
            // Polar ice caps
            float polar = smoothstep(0.15, 0.05, uv.y) + smoothstep(0.85, 0.95, uv.y);
            color = mix(color, iceColor, polar * 0.8);
            
            // Cloud layer with shadows
            float clouds = fbm(uv * 5.0 + time * 0.02);
            float cloudMask = smoothstep(0.4, 0.6, clouds);
            // Cloud shadows - darken the surface beneath clouds
            float cloudShadow = smoothstep(0.42, 0.55, clouds);
            color = mix(color * (1.0 - cloudShadow * 0.25), vec3(1.0), cloudMask * 0.4);
            
            // Secondary thin cloud layer
            float thinClouds = fbm(uv * 8.0 + vec2(time * 0.015, time * 0.01));
            float thinCloudMask = smoothstep(0.55, 0.7, thinClouds);
            color = mix(color, vec3(1.0), thinCloudMask * 0.15);
          }
          
          // Mars-like surface
          if (isMars > 0.5) {
            float terrain = fbm(uv * 8.0);
            vec3 rust = vec3(0.75, 0.25, 0.08);
            vec3 darkRust = vec3(0.5, 0.15, 0.05);
            color = mix(rust, darkRust, terrain);
            
            // Polar caps
            float polar = smoothstep(0.12, 0.03, uv.y) + smoothstep(0.88, 0.97, uv.y);
            color = mix(color, vec3(0.9, 0.85, 0.8), polar * 0.6);
            
            // Olympus Mons region
            float volcano = length((uv - vec2(0.35, 0.4)) * vec2(2.0, 3.0));
            color = mix(color, vec3(0.6, 0.3, 0.15), smoothstep(0.1, 0.04, volcano) * 0.5);
          }
          
          // Venus - thick cloud cover
          if (isVenus > 0.5) {
            float clouds = fbm(uv * 6.0 + time * 0.015);
            float clouds2 = fbm(uv * 10.0 - time * 0.01);
            vec3 paleYellow = vec3(0.85, 0.75, 0.55);
            vec3 brightYellow = vec3(0.95, 0.85, 0.6);
            color = mix(paleYellow, brightYellow, clouds);
            color = mix(color, color * 1.1, clouds2);
          }
          
          // Mercury - cratered, gray
          if (isMercury > 0.5) {
            float craters = fbm(uv * 25.0);
            float craters2 = fbm(uv * 12.0 + 0.5);
            vec3 gray1 = vec3(0.55, 0.5, 0.45);
            vec3 gray2 = vec3(0.4, 0.35, 0.3);
            color = mix(gray1, gray2, craters);
            // Subtle crater shadows
            color = mix(color, color * 0.6, smoothstep(0.55, 0.62, craters2) * 0.5);
          }
          
          // Default surface variation (fallback for any unhandled rocky bodies)
          if (isGasGiant < 0.5 && isIceGiant < 0.5 && isEarth < 0.5 && isMars < 0.5 && isVenus < 0.5 && isMercury < 0.5 && isSaturn < 0.5 && isJupiter < 0.5 && isNeptune < 0.5) {
            color = mix(color * 0.8, color * 1.2, n);
            color = mix(color, color * 0.9, n2 * 0.3);
            
            // Crater-like features for rocky bodies
            float craters = fbm(uv * 20.0);
            color = mix(color, color * 0.7, smoothstep(0.55, 0.6, craters) * 0.5);
          }
          
          // Apply lighting with enhanced dark side
          float terminator = smoothstep(0.0, 0.15, diff); // Soft terminator line
          vec3 darkSide = color * ambient * 0.6; // Darker on unlit side
          vec3 litSide = color * (ambient + diff * 0.88);
          vec3 lit = mix(darkSide, litSide, terminator);
          
          // Subtle rim light (atmospheric scattering) — stronger on dark side for atmosphere effect
          float rim = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
          float rimOnDarkSide = rim * (1.0 - diff) * 1.5; // Enhanced rim on dark side
          lit += baseColor * (rim * 0.15 + rimOnDarkSide * 0.2);
          
          // Specular highlight for gas/ice giants
          if (isGasGiant > 0.5 || isIceGiant > 0.5) {
            vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
            vec3 halfDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
            lit += vec3(1.0) * spec * 0.15;
          }
          
          gl_FragColor = vec4(lit, 1.0);
        }
      `,
    })
  }, [data.color, data.type, data.id])

  useFrame((_, delta) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
  })

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[data.radius, 48, 48]} />
    </mesh>
  )
}

function Atmosphere({ color, scale, radius, planetId }: { color: string; scale: number; radius: number; planetId: string }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const material = useMemo(() => {
    const isEarth = planetId === 'earth'
    const isVenus = planetId === 'venus'
    const isMars = planetId === 'mars'
    const isJupiter = planetId === 'jupiter'
    const isSaturn = planetId === 'saturn'
    const isNeptune = planetId === 'neptune'
    const isUranus = planetId === 'uranus'
    const isGasGiant = isJupiter || isSaturn
    const isIceGiant = isNeptune || isUranus

    // Override colors for specific planets to be more visible
    let atmosphereColor = color
    let atmosphereIntensity = 0.7
    let atmospherePower = 2.0
    let atmosphereScale = scale

    if (isEarth) {
      atmosphereColor = '#4488FF' // More vivid blue
      atmosphereIntensity = 1.2
      atmospherePower = 1.5
      atmosphereScale = 1.14
    } else if (isVenus) {
      atmosphereColor = '#E8D060' // More yellowish
      atmosphereIntensity = 1.0
      atmospherePower = 1.7
      atmosphereScale = 1.18
    } else if (isMars) {
      atmosphereColor = '#E87050' // Thin reddish
      atmosphereIntensity = 0.5
      atmospherePower = 2.5
      atmosphereScale = 1.06
    } else if (isJupiter) {
      atmosphereColor = '#D4A44C' // Warm golden
      atmosphereIntensity = 0.8
      atmospherePower = 2.2
      atmosphereScale = 1.08
    } else if (isSaturn) {
      atmosphereColor = '#C8A860' // Pale gold
      atmosphereIntensity = 0.6
      atmospherePower = 2.3
      atmosphereScale = 1.06
    } else if (isNeptune) {
      atmosphereColor = '#4466DD' // Deep blue
      atmosphereIntensity = 0.9
      atmospherePower = 2.0
      atmosphereScale = 1.10
    } else if (isUranus) {
      atmosphereColor = '#66CCBB' // Cyan-teal
      atmosphereIntensity = 0.7
      atmospherePower = 2.1
      atmosphereScale = 1.08
    }

    return new THREE.ShaderMaterial({
      uniforms: {
        atmosphereColor: { value: new THREE.Color(atmosphereColor) },
        time: { value: 0 },
        intensity: { value: atmosphereIntensity },
        power: { value: atmospherePower },
        isGasGiant: { value: isGasGiant ? 1.0 : 0.0 },
        isIceGiant: { value: isIceGiant ? 1.0 : 0.0 },
        isEarth: { value: isEarth ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        uniform vec3 atmosphereColor;
        uniform float time;
        uniform float intensity;
        uniform float power;
        uniform float isGasGiant;
        uniform float isIceGiant;
        uniform float isEarth;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), power);
          // Subtle animated shimmer
          float shimmer = sin(time * 1.5 + vWorldNormal.x * 5.0) * 0.05 + sin(time * 2.3 + vWorldNormal.y * 3.0) * 0.03 + 1.0;
          
          // Gas giant pulsing glow
          float pulse = 1.0;
          if (isGasGiant > 0.5) {
            pulse = 1.0 + sin(time * 0.8) * 0.08 + sin(time * 1.3) * 0.04;
          }
          // Ice giant subtle aurora shimmer
          if (isIceGiant > 0.5) {
            float aurora = sin(time * 0.6 + vWorldNormal.y * 4.0) * 0.1 + 1.0;
            pulse = aurora;
          }
          // Earth's atmospheric scattering — blue limb with subtle green aurora
          if (isEarth > 0.5) {
            float limbFade = pow(fresnel, 0.8);
            vec3 auroraColor = mix(atmosphereColor, vec3(0.2, 1.0, 0.4), sin(time * 0.4 + vWorldNormal.x * 8.0) * 0.15 + 0.1);
            gl_FragColor = vec4(auroraColor * shimmer * pulse, fresnel * intensity * shimmer * pulse);
            return;
          }
          
          gl_FragColor = vec4(atmosphereColor * shimmer * pulse, fresnel * intensity * shimmer * pulse);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [color, scale, planetId])

  // Determine final scale for specific planets
  const finalScale = useMemo(() => {
    if (planetId === 'earth') return 1.14
    if (planetId === 'venus') return 1.18
    if (planetId === 'mars') return 1.06
    if (planetId === 'jupiter') return 1.08
    if (planetId === 'saturn') return 1.06
    if (planetId === 'neptune') return 1.10
    if (planetId === 'uranus') return 1.08
    return scale
  }, [planetId, scale])

  useFrame((_, delta) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
  })

  return (
    <mesh ref={meshRef} material={material} scale={finalScale}>
      <sphereGeometry args={[radius, 32, 32]} />
    </mesh>
  )
}

function PlanetGlow({ color, radius }: { color: string; radius: number }) {
  const glowRef = useRef<THREE.Mesh>(null!)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(color) },
        time: { value: 0 },
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
          float intensity = pow(0.4 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          // Subtle pulsing glow
          float pulse = 1.0 + sin(time * 1.2) * 0.08 + sin(time * 2.1) * 0.04;
          gl_FragColor = vec4(glowColor * pulse, intensity * 0.45 * pulse);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [color])

  useFrame((_, delta) => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
  })

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <mesh ref={glowRef} material={material} scale={2.5}>
        <planeGeometry args={[radius, radius]} />
      </mesh>
    </Billboard>
  )
}

function AxialTiltIndicator({ tilt, radius }: { tilt: number; radius: number }) {
  // Convert tilt angle to radians and create rotation
  const tiltRad = (tilt * Math.PI) / 180

  // The axis pole height extends beyond the planet
  const poleHeight = radius * 2.2
  const poleRadius = Math.max(radius * 0.02, 0.008)

  return (
    <group rotation={[0, 0, tiltRad]}>
      {/* North pole axis line */}
      <mesh position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[poleRadius, poleRadius, poleHeight, 8]} />
        <meshBasicMaterial
          color="#FFD700"
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* North pole tip (small sphere) */}
      <mesh position={[0, poleHeight, 0]}>
        <sphereGeometry args={[poleRadius * 3, 8, 8]} />
        <meshBasicMaterial
          color="#FFEE88"
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* South pole tip */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[poleRadius * 2.5, 8, 8]} />
        <meshBasicMaterial
          color="#FFEE88"
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Equatorial ring to show tilt plane */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.4, radius * 1.45, 64]} />
        <meshBasicMaterial
          color="#FFD700"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function SelectionRings({ color, radius }: { color: string; radius: number }) {
  const innerRef = useRef<THREE.Mesh>(null!)
  const outerRef = useRef<THREE.Mesh>(null!)
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Inner ring: pulse between 0.3 and 0.8
    const innerOpacity = 0.55 + 0.25 * Math.sin(t * 3)
    if (innerMatRef.current) {
      innerMatRef.current.opacity = innerOpacity
    }
    // Outer ring: counter-phase pulse
    const outerOpacity = 0.55 - 0.25 * Math.sin(t * 3)
    if (outerMatRef.current) {
      outerMatRef.current.opacity = outerOpacity
    }
    // Slight scale pulse on inner ring
    if (innerRef.current) {
      const s = 1 + 0.03 * Math.sin(t * 3)
      innerRef.current.scale.set(s, s, s)
    }
  })

  return (
    <>
      {/* Inner pulsing ring */}
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.15, radius + 0.22, 64]} />
        <meshBasicMaterial ref={innerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Outer pulsing ring (counter-phase) */}
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.3, radius + 0.35, 64]} />
        <meshBasicMaterial ref={outerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  )
}

export default function Planet({ data }: PlanetProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const planetGroupRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(Math.random() * Math.PI * 2)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const showLabels = useSolarSystemStore((s) => s.showLabels)
  const customDateAngleBase = useSolarSystemStore((s) => s.customDateAngleBase)

  useFrame((_, delta) => {
    if (groupRef.current) {
      orbitAngleRef.current += delta * data.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current + customDateAngleBase * data.orbitSpeed
      groupRef.current.position.x = Math.cos(angle) * data.orbitRadius
      groupRef.current.position.z = Math.sin(angle) * data.orbitRadius
    }
    if (planetGroupRef.current) {
      // Multiply by 50 to make the texture rotation visually noticeable since we removed the fast shader animations
      planetGroupRef.current.rotation.y += delta * data.rotationSpeed * 50 * timeSpeed * useSolarSystemStore.getState().rotationSpeedMultiplier
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(data.id)
  }

  const isSelected = selectedBody === data.id

  return (
    <>
      {/* Orbital trail — rendered in world space (at origin) */}
      <OrbitalTrail
        orbitRadius={data.orbitRadius}
        color={data.color}
        orbitAngleRef={orbitAngleRef}
      />

      {/* Planet group — translated to orbit position */}
      <group ref={groupRef}>
        <group ref={planetGroupRef}>
          {/* Planet surface */}
          <group onClick={handleClick}>
            {data.textureUrl ? (
              <TexturedPlanetSurface data={data} />
            ) : (
              <ColorPlanetSurface data={data} />
            )}
            {/* Clickable hit area - larger invisible sphere for easier selection */}
            <mesh>
              <sphereGeometry args={[Math.max(data.radius * 1.8, 0.4), 16, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>

          {/* Atmosphere - with planetId for enhanced per-planet effects */}
          {data.hasAtmosphere && data.atmosphereColor && data.atmosphereScale && (
            <Atmosphere color={data.atmosphereColor} scale={data.atmosphereScale} radius={data.radius} planetId={data.id} />
          )}

          {/* Rings */}
          {data.hasRings && (
            <Rings
              innerRadius={data.ringInnerRadius || 1.2}
              outerRadius={data.ringOuterRadius || 2.0}
              color={data.ringColor || '#D4C090'}
              opacity={data.ringOpacity || 0.6}
              planetRadius={data.radius}
              textureUrl={data.ringTextureUrl}
            />
          )}

          {/* Selection indicator - animated pulsing rings */}
          {isSelected && <SelectionRings color={data.color} radius={data.radius} />}
          {/* Axial tilt indicator when selected */}
          {isSelected && <AxialTiltIndicator tilt={data.axialTilt} radius={data.radius} />}
          {/* Point light on selected planet */}
          {isSelected && (
            <pointLight color={data.color} intensity={0.5} distance={8} />
          )}
        </group>

        {/* Planet glow indicator (always visible) */}
        <PlanetGlow color={data.color} radius={data.radius * 1.5} />

        {/* Moons */}
        {data.moons.map((moon) => (
          <MoonComponent key={moon.name} moonData={moon} parentId={data.id} />
        ))}

        {/* Label */}
        {showLabels && (
          <PlanetLabel name={data.name} offset={data.radius + 0.5} bodyId={data.id} />
        )}
      </group>
    </>
  )
}
