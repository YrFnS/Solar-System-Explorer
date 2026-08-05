'use client'

import { useMemo } from 'react'
import EphemerisOrbitLine from '../EphemerisOrbitLine'
import EphemerisSmallBody from '../EphemerisSmallBody'
import {
  centaurs,
  comets,
  dwarfPlanets,
  interstellarObjects,
  scatteredDiscObjects,
} from '../data'
import { useSceneSystemActive } from '../scene-workload-policy'

export default function SmallBodiesScene() {
  const showCentaurs = useSceneSystemActive('centaurs')
  const showScatteredDisc = useSceneSystemActive('scattered-disc')
  const dwarfIds = useMemo(
    () => new Set(dwarfPlanets.map((body) => body.id)),
    []
  )
  const uniqueScatteredObjects = useMemo(
    () => scatteredDiscObjects.filter((body) => !dwarfIds.has(body.id)),
    [dwarfIds]
  )

  return (
    <>
      {dwarfPlanets.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.color}
          opacity={0.045}
        />
      ))}
      {dwarfPlanets.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      ))}

      {comets.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.tailColor}
          opacity={0.045}
        />
      ))}
      {comets.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      ))}

      {interstellarObjects.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.tailColor ?? body.color}
          opacity={0.04}
        />
      ))}
      {interstellarObjects.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      ))}

      {showCentaurs ? centaurs.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.color}
          opacity={0.035}
        />
      )) : null}
      {showCentaurs ? centaurs.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      )) : null}

      {showScatteredDisc ? uniqueScatteredObjects.map((body) => (
        <EphemerisOrbitLine
          key={`orbit-${body.id}`}
          bodyId={body.id}
          color={body.color}
          opacity={0.03}
        />
      )) : null}
      {showScatteredDisc ? uniqueScatteredObjects.map((body) => (
        <EphemerisSmallBody key={body.id} body={body} />
      )) : null}
    </>
  )
}
