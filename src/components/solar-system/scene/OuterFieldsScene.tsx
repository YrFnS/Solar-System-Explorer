'use client'

import { AsteroidBelt, KuiperBelt } from '../AsteroidBelt'
import CentaurBelt from '../CentaurBelt'
import Heliosphere from '../Heliosphere'
import NearEarthObjects from '../NearEarthObjects'
import OortCloud from '../OortCloud'
import ScatteredDiscBelt from '../ScatteredDiscBelt'
import TrojanAsteroids from '../TrojanAsteroids'
import { useSceneSystemActive } from '../scene-workload-policy'

export default function OuterFieldsScene() {
  const showAsteroidBelt = useSceneSystemActive('asteroid-belt')
  const showNearEarthObjects = useSceneSystemActive('near-earth-objects')
  const showTrojans = useSceneSystemActive('trojans')
  const showKuiperBelt = useSceneSystemActive('kuiper-belt')
  const showOortCloud = useSceneSystemActive('oort-cloud')
  const showCentaurs = useSceneSystemActive('centaurs')
  const showScatteredDisc = useSceneSystemActive('scattered-disc')
  const showHeliosphere = useSceneSystemActive('heliosphere')

  return (
    <>
      {showAsteroidBelt ? <AsteroidBelt /> : null}
      {showNearEarthObjects ? <NearEarthObjects /> : null}
      {showTrojans ? <TrojanAsteroids /> : null}
      {showKuiperBelt ? <KuiperBelt /> : null}
      {showCentaurs ? <CentaurBelt /> : null}
      {showScatteredDisc ? <ScatteredDiscBelt /> : null}
      {showHeliosphere ? <Heliosphere /> : null}
      {showOortCloud ? <OortCloud /> : null}
    </>
  )
}
