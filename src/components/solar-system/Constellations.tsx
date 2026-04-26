'use client'

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSolarSystemStore } from './store'

interface ConstellationData {
  name: string
  stars: [number, number, number][]
  lines: [number, number][]
  color: string
}

const CONSTELLATIONS: ConstellationData[] = [
  {
    name: 'Orion',
    stars: [
      [180, 60, -250],
      [220, 55, -260],
      [190, 30, -255],
      [200, 25, -258],
      [210, 20, -255],
      [175, -15, -250],
      [225, -20, -260],
    ],
    lines: [[0, 2], [1, 4], [2, 3], [3, 4], [0, 5], [1, 6], [5, 2], [6, 4]],
    color: '#FFE4B5',
  },
  {
    name: 'Ursa Major',
    stars: [
      [-150, 80, -280],
      [-140, 75, -285],
      [-125, 82, -290],
      [-118, 88, -295],
      [-108, 95, -290],
      [-95, 100, -285],
      [-82, 95, -280],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
    color: '#E0E8FF',
  },
  {
    name: 'Cassiopeia',
    stars: [
      [50, 150, -300],
      [65, 160, -305],
      [80, 145, -310],
      [95, 158, -305],
      [110, 148, -300],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
    color: '#FFD0E0',
  },
  {
    name: 'Leo',
    stars: [
      [-200, 40, -200],
      [-195, 55, -210],
      [-185, 60, -215],
      [-175, 55, -210],
      [-165, 45, -205],
      [-190, 35, -195],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 4]],
    color: '#FFEEBB',
  },
  {
    name: 'Scorpius',
    stars: [
      [250, -30, -200],
      [260, -15, -205],
      [265, -5, -210],
      [255, -45, -195],
      [248, -55, -190],
      [270, 5, -215],
      [275, 15, -220],
    ],
    lines: [[5, 2], [2, 1], [1, 0], [0, 3], [3, 4], [2, 6]],
    color: '#FFB0B0',
  },
  {
    name: 'Crux',
    stars: [
      [0, -100, -350],
      [5, -75, -355],
      [-5, -70, -360],
      [10, -90, -350],
    ],
    lines: [[0, 2], [1, 3]],
    color: '#C0FFC0',
  },
]

function ConstellationGroup({ data }: { data: ConstellationData }) {
  const lineGeometry = useMemo(() => {
    const positions: number[] = []
    for (const [a, b] of data.lines) {
      const starA = data.stars[a]
      const starB = data.stars[b]
      positions.push(starA[0], starA[1], starA[2])
      positions.push(starB[0], starB[1], starB[2])
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [data])

  const centerPosition = useMemo(() => {
    const cx = data.stars.reduce((s, p) => s + p[0], 0) / data.stars.length
    const cy = data.stars.reduce((s, p) => s + p[1], 0) / data.stars.length
    const cz = data.stars.reduce((s, p) => s + p[2], 0) / data.stars.length
    return [cx, cy + 10, cz] as [number, number, number]
  }, [data])

  return (
    <group>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial
          color={data.color}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </lineSegments>
      {/* Star points */}
      {data.stars.map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={data.color} transparent opacity={0.85} />
        </mesh>
      ))}
      {/* Label */}
      <Html
        position={centerPosition}
        center
        distanceFactor={200}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="text-[10px] font-medium tracking-wider uppercase whitespace-nowrap"
          style={{ color: data.color, textShadow: `0 0 8px ${data.color}80, 0 0 16px ${data.color}40` }}
        >
          {data.name}
        </div>
      </Html>
    </group>
  )
}

export default function Constellations() {
  const showConstellations = useSolarSystemStore((s) => s.showConstellations)

  if (!showConstellations) return null

  return (
    <group>
      {CONSTELLATIONS.map((c) => (
        <ConstellationGroup key={c.name} data={c} />
      ))}
    </group>
  )
}
