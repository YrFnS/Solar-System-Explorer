'use client'

import { useSolarSystemStore } from './store'
import Explosion from './Explosion'

export default function ExplosionsRenderer() {
  const explosions = useSolarSystemStore((s) => s.explosions)

  return (
    <>
      {explosions.map((exp) => (
        <Explosion
          key={exp.id}
          position={exp.position}
          color={exp.color}
        />
      ))}
    </>
  )
}
