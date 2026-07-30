'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'
import {
  getEffectiveQuality,
  QUALITY_PROFILES,
  usePerformanceStore,
} from './performance-store'

const BASE_METEOR_COUNT = 100
const METEOR_TAIL_LENGTH = 10
const METEOR_SPEED_MIN = 40
const METEOR_SPEED_MAX = 80
const SPAWN_INTERVAL_MIN = 0.45
const SPAWN_INTERVAL_MAX = 2.2
const HIDDEN_Y = -1000

interface MeteorData {
  active: boolean
  lifetime: number
  maxLifetime: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  trail: THREE.Vector3[]
}

function randomSpawnInterval(reducedMotion: boolean) {
  const interval = SPAWN_INTERVAL_MIN
    + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN)
  return reducedMotion ? interval * 2.4 : interval
}

function spawnMeteor(meteor: MeteorData, reducedMotion: boolean) {
  const angle = Math.random() * Math.PI * 2
  const height = 50 + Math.random() * 40
  const radius = 30 + Math.random() * 50
  const speedMultiplier = reducedMotion ? 0.45 : 1
  const speed = (METEOR_SPEED_MIN
    + Math.random() * (METEOR_SPEED_MAX - METEOR_SPEED_MIN)) * speedMultiplier
  const downAngle = -0.5 - Math.random() * 0.5
  const sideAngle = Math.random() * Math.PI * 2

  meteor.position.set(
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius
  )
  meteor.velocity.set(
    Math.cos(sideAngle) * speed * 0.3,
    downAngle * speed,
    Math.sin(sideAngle) * speed * 0.3
  )
  meteor.lifetime = 0
  meteor.maxLifetime = 1 + Math.random() * 1.5
  meteor.active = true

  for (const trailPoint of meteor.trail) {
    trailPoint.copy(meteor.position)
  }
}

function hideMeteor(
  meteorIndex: number,
  positionAttribute: THREE.BufferAttribute,
  alphaAttribute: THREE.BufferAttribute,
  sizeAttribute: THREE.BufferAttribute
) {
  for (let segment = 0; segment < METEOR_TAIL_LENGTH; segment++) {
    const attributeIndex = meteorIndex * METEOR_TAIL_LENGTH + segment
    positionAttribute.setXYZ(attributeIndex, 0, HIDDEN_Y, 0)
    alphaAttribute.setX(attributeIndex, 0)
    sizeAttribute.setX(attributeIndex, 0)
  }
}

export default function MeteorShower() {
  const pointsRef = useRef<THREE.Points>(null!)
  const meteorsRef = useRef<MeteorData[]>([])
  const spawnTimerRef = useRef(0)
  const nextSpawnRef = useRef(SPAWN_INTERVAL_MIN)
  const showPhenomena = useSolarSystemStore((state) => state.showPhenomena)
  const quality = usePerformanceStore((state) => getEffectiveQuality(state))
  const reducedMotion = usePerformanceStore((state) => state.reducedMotion)
  const meteorCount = Math.max(
    16,
    Math.round(BASE_METEOR_COUNT * QUALITY_PROFILES[quality].instanceDensity)
  )
  const totalPoints = meteorCount * METEOR_TAIL_LENGTH

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(totalPoints * 3)
    const alphas = new Float32Array(totalPoints)
    const sizes = new Float32Array(totalPoints)
    const pool: MeteorData[] = []

    for (let meteorIndex = 0; meteorIndex < meteorCount; meteorIndex++) {
      pool.push({
        active: false,
        lifetime: 0,
        maxLifetime: 0,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        trail: Array.from(
          { length: METEOR_TAIL_LENGTH },
          () => new THREE.Vector3(0, HIDDEN_Y, 0)
        ),
      })

      for (let segment = 0; segment < METEOR_TAIL_LENGTH; segment++) {
        const pointIndex = meteorIndex * METEOR_TAIL_LENGTH + segment
        positions[pointIndex * 3 + 1] = HIDDEN_Y
      }
    }

    meteorsRef.current = pool
    spawnTimerRef.current = 0
    nextSpawnRef.current = randomSpawnInterval(reducedMotion)

    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    nextGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    nextGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const nextMaterial = new THREE.ShaderMaterial({
      uniforms: {
        pixelRatio: { value: 1 },
      },
      vertexShader: `
        attribute float aAlpha;
        attribute float aSize;
        varying float vAlpha;
        uniform float pixelRatio;

        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * pixelRatio * (200.0 / -mvPosition.z), 0.0, 20.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;

        void main() {
          float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
          if (distanceFromCenter > 0.5) discard;

          float softEdge = 1.0 - smoothstep(0.2, 0.5, distanceFromCenter);
          vec3 headColor = vec3(1.0, 1.0, 0.9);
          vec3 tailColor = vec3(1.0, 0.7, 0.3);
          vec3 color = mix(tailColor, headColor, vAlpha);
          gl_FragColor = vec4(color, vAlpha * softEdge);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: nextGeometry, material: nextMaterial }
  }, [meteorCount, reducedMotion, totalPoints])

  useFrame((_, delta) => {
    if (!pointsRef.current || !showPhenomena) return

    const scene = useSolarSystemStore.getState()
    if (scene.isPaused) return

    const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute
    const alphaAttribute = geometry.getAttribute('aAlpha') as THREE.BufferAttribute
    const sizeAttribute = geometry.getAttribute('aSize') as THREE.BufferAttribute
    const meteors = meteorsRef.current
    let buffersChanged = false

    spawnTimerRef.current += delta
    if (spawnTimerRef.current >= nextSpawnRef.current) {
      spawnTimerRef.current = 0
      nextSpawnRef.current = randomSpawnInterval(reducedMotion)

      const inactiveMeteor = meteors.find((meteor) => !meteor.active)
      if (inactiveMeteor) {
        spawnMeteor(inactiveMeteor, reducedMotion)
        buffersChanged = true
      }
    }

    for (let meteorIndex = 0; meteorIndex < meteors.length; meteorIndex++) {
      const meteor = meteors[meteorIndex]
      if (!meteor.active) continue

      meteor.lifetime += delta
      if (meteor.lifetime >= meteor.maxLifetime) {
        meteor.active = false
        hideMeteor(meteorIndex, positionAttribute, alphaAttribute, sizeAttribute)
        buffersChanged = true
        continue
      }

      meteor.position.addScaledVector(meteor.velocity, delta)
      for (let segment = METEOR_TAIL_LENGTH - 1; segment > 0; segment--) {
        meteor.trail[segment].copy(meteor.trail[segment - 1])
      }
      meteor.trail[0].copy(meteor.position)

      const lifeFraction = meteor.lifetime / meteor.maxLifetime
      const fadeAlpha = lifeFraction < 0.1
        ? lifeFraction / 0.1
        : lifeFraction > 0.7
          ? 1 - (lifeFraction - 0.7) / 0.3
          : 1

      for (let segment = 0; segment < METEOR_TAIL_LENGTH; segment++) {
        const attributeIndex = meteorIndex * METEOR_TAIL_LENGTH + segment
        const trailPoint = meteor.trail[segment]
        const tailFade = 1 - segment / METEOR_TAIL_LENGTH

        positionAttribute.setXYZ(attributeIndex, trailPoint.x, trailPoint.y, trailPoint.z)
        alphaAttribute.setX(attributeIndex, tailFade * fadeAlpha)
        sizeAttribute.setX(
          attributeIndex,
          segment === 0 ? 3 : Math.max(0.5, 2 * tailFade)
        )
      }
      buffersChanged = true
    }

    if (buffersChanged) {
      positionAttribute.needsUpdate = true
      alphaAttribute.needsUpdate = true
      sizeAttribute.needsUpdate = true
    }
  })

  if (!showPhenomena) return null

  return <points ref={pointsRef} geometry={geometry} material={material} />
}
