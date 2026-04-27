'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const METEOR_COUNT = 100
const METEOR_SPEED_MIN = 40
const METEOR_SPEED_MAX = 80
const METEOR_TAIL_LENGTH = 12
const SPAWN_INTERVAL_MIN = 0.3 // seconds between spawns
const SPAWN_INTERVAL_MAX = 2.0

interface MeteorData {
  active: boolean
  lifetime: number
  maxLifetime: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  trail: THREE.Vector3[]
}

export default function MeteorShower() {
  const pointsRef = useRef<THREE.Points>(null!)
  const meteorsRef = useRef<MeteorData[]>([])
  const spawnTimerRef = useRef(0)
  const nextSpawnRef = useRef(SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN))

  // Total points = METEOR_COUNT * METEOR_TAIL_LENGTH (head + tail segments)
  const totalPoints = METEOR_COUNT * METEOR_TAIL_LENGTH

  const { positions, alphas, sizes } = useMemo(() => {
    const positions = new Float32Array(totalPoints * 3)
    const alphas = new Float32Array(totalPoints)
    const sizes = new Float32Array(totalPoints)

    // Initialize all meteors as inactive
    for (let i = 0; i < METEOR_COUNT; i++) {
      meteorsRef.current[i] = {
        active: false,
        lifetime: 0,
        maxLifetime: 0,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        trail: [],
      }
      for (let j = 0; j < METEOR_TAIL_LENGTH; j++) {
        const idx = (i * METEOR_TAIL_LENGTH + j) * 3
        positions[idx] = 0
        positions[idx + 1] = 0
        positions[idx + 2] = 0
        alphas[i * METEOR_TAIL_LENGTH + j] = 0
        sizes[i * METEOR_TAIL_LENGTH + j] = 0
      }
    }

    return { positions, alphas, sizes }
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    return geo
  }, [positions, alphas, sizes])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        pixelRatio: { value: 1.0 },
      },
      vertexShader: `
        attribute float aAlpha;
        attribute float aSize;
        varying float vAlpha;
        uniform float pixelRatio;
        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * pixelRatio * (200.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 0.0, 20.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          // Circular point with soft edges
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float softEdge = 1.0 - smoothstep(0.2, 0.5, dist);
          // White-yellow color for meteor head, fading to orange for tail
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
  }, [])

  const spawnMeteor = (meteor: MeteorData) => {
    // Spawn at a random position high above the scene
    const angle = Math.random() * Math.PI * 2
    const height = 50 + Math.random() * 40
    const radius = 30 + Math.random() * 50

    meteor.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    )

    // Velocity direction: generally downward and inward with some randomness
    const speed = METEOR_SPEED_MIN + Math.random() * (METEOR_SPEED_MAX - METEOR_SPEED_MIN)
    const downAngle = -0.5 - Math.random() * 0.5 // mostly downward
    const sideAngle = Math.random() * Math.PI * 2

    meteor.velocity.set(
      Math.cos(sideAngle) * speed * 0.3,
      downAngle * speed,
      Math.sin(sideAngle) * speed * 0.3
    )

    meteor.lifetime = 0
    meteor.maxLifetime = 1.0 + Math.random() * 1.5
    meteor.active = true
    meteor.trail = []

    // Pre-fill trail with starting position
    for (let i = 0; i < METEOR_TAIL_LENGTH; i++) {
      meteor.trail.push(meteor.position.clone())
    }
  }

  useFrame((_, delta) => {
    if (!pointsRef.current) return

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const alphaAttr = pointsRef.current.geometry.attributes.aAlpha as THREE.BufferAttribute
    const sizeAttr = pointsRef.current.geometry.attributes.aSize as THREE.BufferAttribute

    const meteors = meteorsRef.current

    // Spawn new meteors
    spawnTimerRef.current += delta
    if (spawnTimerRef.current >= nextSpawnRef.current) {
      spawnTimerRef.current = 0
      nextSpawnRef.current = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN)

      // Find an inactive meteor to spawn
      for (let i = 0; i < METEOR_COUNT; i++) {
        if (!meteors[i].active) {
          spawnMeteor(meteors[i])
          break
        }
      }
    }

    // Update all meteors
    for (let i = 0; i < METEOR_COUNT; i++) {
      const meteor = meteors[i]

      if (meteor.active) {
        meteor.lifetime += delta

        if (meteor.lifetime >= meteor.maxLifetime) {
          meteor.active = false
          // Zero out all trail points
          for (let j = 0; j < METEOR_TAIL_LENGTH; j++) {
            const idx = i * METEOR_TAIL_LENGTH + j
            posAttr.setXYZ(idx, 0, -1000, 0)
            alphaAttr.setX(idx, 0)
            sizeAttr.setX(idx, 0)
          }
          continue
        }

        // Update position
        meteor.position.addScaledVector(meteor.velocity, delta)

        // Update trail: shift everything back, add new head position
        meteor.trail.pop()
        meteor.trail.unshift(meteor.position.clone())

        // Fade based on lifetime
        const lifeFraction = meteor.lifetime / meteor.maxLifetime
        // Fade in quickly at start, fade out near end
        const fadeAlpha = lifeFraction < 0.1
          ? lifeFraction / 0.1
          : lifeFraction > 0.7
            ? 1.0 - (lifeFraction - 0.7) / 0.3
            : 1.0

        for (let j = 0; j < METEOR_TAIL_LENGTH; j++) {
          const idx = i * METEOR_TAIL_LENGTH + j
          const trailPoint = meteor.trail[j]

          posAttr.setXYZ(idx, trailPoint.x, trailPoint.y, trailPoint.z)

          // Head is brightest, tail fades
          const tailFade = 1.0 - (j / METEOR_TAIL_LENGTH)
          const alpha = tailFade * fadeAlpha
          alphaAttr.setX(idx, alpha)

          // Head is larger, tail shrinks
          const size = j === 0 ? 3.0 : Math.max(0.5, 2.0 * tailFade)
          sizeAttr.setX(idx, size)
        }
      } else {
        // Inactive meteor - ensure all points are hidden
        for (let j = 0; j < METEOR_TAIL_LENGTH; j++) {
          const idx = i * METEOR_TAIL_LENGTH + j
          posAttr.setXYZ(idx, 0, -1000, 0)
          alphaAttr.setX(idx, 0)
          sizeAttr.setX(idx, 0)
        }
      }
    }

    posAttr.needsUpdate = true
    alphaAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry} material={material} />
  )
}
