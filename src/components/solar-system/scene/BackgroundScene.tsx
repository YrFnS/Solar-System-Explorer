'use client'

import Nebula from '../Nebula'
import Constellations from '../Constellations'
import GalacticNeighborhood from '../GalacticNeighborhood'
import { useSceneSystemActive } from '../scene-workload-policy'

export default function BackgroundScene() {
  const showNebula = useSceneSystemActive('nebula')
  const showConstellations = useSceneSystemActive('constellations')
  const showGalacticNeighborhood = useSceneSystemActive('galactic-neighborhood')

  return (
    <>
      {showNebula ? <Nebula /> : null}
      {showGalacticNeighborhood ? <GalacticNeighborhood /> : null}
      {showConstellations ? <Constellations /> : null}
    </>
  )
}
