'use client'

import BlackHole from '../BlackHole'
import EphemerisCollisionDetector from '../EphemerisCollisionDetector'
import EphemerisSpawnedObjects from '../EphemerisSpawnedObjects'
import ExplosionsRenderer from '../ExplosionsRenderer'
import Wormhole from '../Wormhole'
import { blackHoles, wormholes } from '../data'
import { useSceneSystemActive } from '../scene-workload-policy'

export default function SandboxScene() {
  const showBlackHole = useSceneSystemActive('black-hole')
  const showWormhole = useSceneSystemActive('wormhole')

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
