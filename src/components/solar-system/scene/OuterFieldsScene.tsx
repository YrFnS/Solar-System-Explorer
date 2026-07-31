'use client'

import { AsteroidBelt, KuiperBelt } from '../AsteroidBelt'
import CentaurBelt from '../CentaurBelt'
import Heliosphere from '../Heliosphere'
import NearEarthObjects from '../NearEarthObjects'
import OortCloud from '../OortCloud'
import ScatteredDiscBelt from '../ScatteredDiscBelt'
import TrojanAsteroids from '../TrojanAsteroids'

export default function OuterFieldsScene() {
  return (
    <>
      <AsteroidBelt />
      <NearEarthObjects />
      <TrojanAsteroids />
      <KuiperBelt />
      <CentaurBelt />
      <ScatteredDiscBelt />
      <Heliosphere />
      <OortCloud />
    </>
  )
}
