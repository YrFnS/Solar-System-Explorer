'use client'

import BlackHole from '../BlackHole'
import EphemerisCollisionDetector from '../EphemerisCollisionDetector'
import EphemerisSpawnedObjects from '../EphemerisSpawnedObjects'
import ExplosionsRenderer from '../ExplosionsRenderer'
import Wormhole from '../Wormhole'
import { blackHoles, wormholes } from '../data'
import { useSolarSystemStore } from '../store'

export default function SandboxScene() {
  const showBlackHole = useSolarSystemStore((state) => state.showBlackHole)
  const showWormhole = useSolarSystemStore((state) => state.showWormhole)

  return (
    <>
      <EphemerisSpawnedObjects />
      <EphemerisCollisionDetector />
      <ExplosionsRenderer />

      {showBlackHole
        ? blackHoles.map((body) => <BlackHole key={body.id} data={body} />)
        : null}
      {showWormhole
        ? wormholes.map((body) => <Wormhole key={body.id} data={body} />)
        : null}
    </>
  )
}
