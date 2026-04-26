'use client'

import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { ScatteredDiscObjectData } from './data'
import { useSolarSystemStore } from './store'
import PlanetLabel from './PlanetLabel'

interface ScatteredDiscObjectProps {
  data: ScatteredDiscObjectData
}

function SDRings({ color, radius }: { color: string; radius: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius + 0.08, radius + 0.16, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function SDSelectionRings({ color, radius }: { color: string; radius: number }) {
  const innerRef = useRef<THREE.Mesh>(null!)
  const outerRef = useRef<THREE.Mesh>(null!)
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const innerOpacity = 0.55 + 0.25 * Math.sin(t * 3)
    if (innerMatRef.current) innerMatRef.current.opacity = innerOpacity
    const outerOpacity = 0.55 - 0.25 * Math.sin(t * 3)
    if (outerMatRef.current) outerMatRef.current.opacity = outerOpacity
    if (innerRef.current) {
      const s = 1 + 0.03 * Math.sin(t * 3)
      innerRef.current.scale.set(s, s, s)
    }
  })

  return (
    <>
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.1, radius + 0.16, 64]} />
        <meshBasicMaterial ref={innerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.22, radius + 0.26, 64]} />
        <meshBasicMaterial ref={outerMatRef} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  )
}

function SDOSurface({ data }: { data: ScatteredDiscObjectData }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const material = useMemo(() => {
    const baseColor = new THREE.Color(data.color)

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: baseColor },
        lightDir: { value: new THREE.Vector3(0, 0, 1).normalize() },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform float time;
        uniform vec3 baseColor;
        uniform vec3 lightDir;

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
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          vec3 normal = normalize(vNormal);
          float diff = max(dot(normal, lightDir), 0.0);
          float ambient = 0.15;

          vec2 uv = vUv;
          float n = fbm(uv * 12.0 + time * 0.005);
          float n2 = fbm(uv * 20.0 - time * 0.003);

          vec3 color = baseColor;
          vec3 light = baseColor * 1.15;
          vec3 dark = baseColor * 0.55;
          color = mix(light, dark, n);

          // Subtle craters
          float craters = fbm(uv * 25.0);
          color = mix(color, color * 0.65, smoothstep(0.55, 0.62, craters) * 0.4);

          // Ice patches for distant objects
          float ice = fbm(uv * 8.0 + vec2(0.3, 0.7));
          vec3 iceColor = mix(baseColor, vec3(0.9, 0.88, 0.85), 0.5);
          color = mix(color, iceColor, smoothstep(0.55, 0.65, ice) * 0.25);

          vec3 lit = color * (ambient + diff * 0.85);

          float rim = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
          lit += baseColor * rim * 0.15;

          gl_FragColor = vec4(lit, 1.0);
        }
      `,
    })
  }, [data.color])

  useFrame((_, delta) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value += delta
    }
  })

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[data.radius, 32, 32]} />
    </mesh>
  )
}

export default function ScatteredDiscObject({ data }: ScatteredDiscObjectProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const spinRef = useRef<THREE.Group>(null!)
  const orbitAngleRef = useRef(data.initialAngle)
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)
  const selectedBody = useSolarSystemStore((s) => s.selectedBody)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const showLabels = useSolarSystemStore((s) => s.showLabels)
  const customDateAngleBase = useSolarSystemStore((s) => s.customDateAngleBase)

  const inclinationRad = (data.orbitInclination * Math.PI) / 180

  useFrame((_, delta) => {
    if (groupRef.current) {
      orbitAngleRef.current += delta * data.orbitSpeed * 0.05 * timeSpeed
      const angle = orbitAngleRef.current + customDateAngleBase * data.orbitSpeed

      // Eccentric orbit (like comets and centaurs)
      const e = data.orbitEccentricity
      const a = data.orbitRadius
      const r = a * (1 - e * e) / (1 + e * Math.cos(angle))

      groupRef.current.position.x = Math.cos(angle) * r
      groupRef.current.position.z = Math.sin(angle) * r
      groupRef.current.position.y = Math.sin(angle) * Math.sin(inclinationRad) * r * 0.3
    }
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 0.3 * timeSpeed
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelectedBody(data.id)
  }

  const isSelected = selectedBody === data.id

  return (
    <group ref={groupRef}>
      <group ref={spinRef} onClick={handleClick}>
        <SDOSurface data={data} />
        {/* Clickable hit area - larger invisible sphere for easier selection */}
        <mesh>
          <sphereGeometry args={[Math.max(data.radius * 2.5, 0.5), 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* Rings for Quaoar */}
      {data.hasRings && <SDRings color={data.color} radius={data.radius} />}

      {/* Selection indicator - animated pulsing rings */}
      {isSelected && <SDSelectionRings color={data.color} radius={data.radius} />}
      {/* Point light on selected scattered disc object */}
      {isSelected && (
        <pointLight color={data.color} intensity={0.5} distance={6} />
      )}

      {/* Subtle glow for visibility */}
      <pointLight
        color={data.color}
        intensity={0.08}
        distance={2}
      />

      {showLabels && (
        <PlanetLabel name={data.name} offset={data.radius + 0.3} bodyId={data.id} />
      )}
    </group>
  )
}
