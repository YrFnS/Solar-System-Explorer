'use client'

import DistanceRuler from '../DistanceRuler'
import GravityWells from '../GravityWells'
import MeteorShower from '../MeteorShower'
import SolarWind from '../SolarWind'
import ZodiacalLight from '../ZodiacalLight'
import { useExperienceStore } from '../experience-store'
import { useSceneSystemActive } from '../scene-workload-policy'

export default function PhenomenaScene() {
  const mode = useExperienceStore((state) => state.mode)
  const showSolarWind = useSceneSystemActive('solar-wind')
  const showMeteorShower = useSceneSystemActive('meteor-shower')
  const showZodiacalLight = useSceneSystemActive('zodiacal-light')
  const showGravityWells = useSceneSystemActive('gravity-wells')

  return (
    <>
      {showSolarWind ? <SolarWind /> : null}
      {showZodiacalLight ? <ZodiacalLight /> : null}
      {showMeteorShower ? <MeteorShower /> : null}
      <DistanceRuler />
      {mode === 'sandbox' && showGravityWells ? <GravityWells /> : null}
    </>
  )
}
