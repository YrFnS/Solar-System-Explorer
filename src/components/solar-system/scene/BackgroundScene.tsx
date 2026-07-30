'use client'

import Nebula from '../Nebula'
import Constellations from '../Constellations'
import GalacticNeighborhood from '../GalacticNeighborhood'
import { useSolarSystemStore } from '../store'

export default function BackgroundScene() {
  const showNebula = useSolarSystemStore((state) => state.showNebula)
  const showConstellations = useSolarSystemStore((state) => state.showConstellations)
  const showGalacticNeighborhood = useSolarSystemStore(
    (state) => state.showGalacticNeighborhood
  )

  return (
    <>
      {showNebula ? <Nebula /> : null}
      {showGalacticNeighborhood ? <GalacticNeighborhood /> : null}
      {showConstellations ? <Constellations /> : null}
    </>
  )
}
