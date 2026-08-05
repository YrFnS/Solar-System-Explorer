'use client'

import { useMemo } from 'react'
import EphemerisOrbitLine from '../EphemerisOrbitLine'
import EphemerisSmallBody from '../EphemerisSmallBody'
import InstancedSmallBodies from '../InstancedSmallBodies'
import SmallBodyOrbitBatch, {
  type SmallBodyOrbitEntry,
} from '../SmallBodyOrbitBatch'
import {
  centaurs,
  comets,
  dwarfPlanets,
  interstellarObjects,
  scatteredDiscObjects,
} from '../data'
import { useSceneSystemActive } from '../scene-workload-policy'
import { useSolarSystemStore } from '../store'

export default function SmallBodiesScene() {
  const showCentaurs = useSceneSystemActive('centaurs')
  const showScatteredDisc = useSceneSystemActive('scattered-disc')
  const selectedBody = useSolarSystemStore((state) => state.selectedBody)
  const showOrbitLines = useSolarSystemStore((state) => state.showOrbitLines)
  const dwarfIds = useMemo(
    () => new Set(dwarfPlanets.map((body) => body.id)),
    []
  )
  const uniqueScatteredObjects = useMemo(
    () => scatteredDiscObjects.filter((body) => !dwarfIds.has(body.id)),
    [dwarfIds]
  )

  const entries = useMemo<SmallBodyOrbitEntry[]>(() => [
    ...dwarfPlanets.map((body) => ({
      body,
      color: body.color,
      opacity: 0.045,
    })),
    ...comets.map((body) => ({
      body,
      color: body.tailColor,
      opacity: 0.045,
    })),
    ...interstellarObjects.map((body) => ({
      body,
      color: body.tailColor ?? body.color,
      opacity: 0.04,
    })),
    ...(showCentaurs ? centaurs.map((body) => ({
      body,
      color: body.color,
      opacity: 0.035,
    })) : []),
    ...(showScatteredDisc ? uniqueScatteredObjects.map((body) => ({
      body,
      color: body.color,
      opacity: 0.03,
    })) : []),
  ], [showCentaurs, showScatteredDisc, uniqueScatteredObjects])

  const bodies = useMemo(
    () => entries.map((entry) => entry.body),
    [entries]
  )
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.body.id === selectedBody) ?? null,
    [entries, selectedBody]
  )
  const batchedOrbitPaths = showOrbitLines
    ? entries.length - (selectedEntry ? 1 : 0)
    : 0
  const individualOrbitPaths = showOrbitLines && selectedEntry ? 1 : 0
  const orbitBatchDraws = batchedOrbitPaths > 0 ? 1 : 0

  return (
    <>
      <InstancedSmallBodies
        bodies={bodies}
        batchedOrbitPaths={batchedOrbitPaths}
        individualOrbitPaths={individualOrbitPaths}
        orbitBatchDraws={orbitBatchDraws}
      />
      <SmallBodyOrbitBatch entries={entries} />

      {selectedEntry ? (
        <>
          <EphemerisOrbitLine
            bodyId={selectedEntry.body.id}
            color={selectedEntry.color}
            opacity={selectedEntry.opacity}
          />
          <EphemerisSmallBody body={selectedEntry.body} />
        </>
      ) : null}
    </>
  )
}
