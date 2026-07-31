'use client'

import DistanceRuler from '../DistanceRuler'
import GravityWells from '../GravityWells'
import MeteorShower from '../MeteorShower'
import SolarWind from '../SolarWind'
import ZodiacalLight from '../ZodiacalLight'
import { useExperienceStore } from '../experience-store'

export default function PhenomenaScene() {
  const mode = useExperienceStore((state) => state.mode)

  return (
    <>
      <SolarWind />
      <ZodiacalLight />
      <MeteorShower />
      <DistanceRuler />
      {mode === 'sandbox' ? <GravityWells /> : null}
    </>
  )
}
