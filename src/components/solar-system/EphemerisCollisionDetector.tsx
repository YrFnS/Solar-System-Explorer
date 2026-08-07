'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { planets, sunData } from './data'
import {
  getBodyVisualPosition,
  getSpawnedObjectVisualPosition,
} from './ephemeris'
import { useExperienceStore } from './experience-store'
import { useFrameLane } from './FrameUpdateLanes'
import { useSolarSystemStore } from './store'

export default function EphemerisCollisionDetector() {
  const spawnedObjects = useSolarSystemStore((state) => state.spawnedObjects)
  const removeSpawnedObject = useSolarSystemStore(
    (state) => state.removeSpawnedObject
  )
  const addExplosion = useSolarSystemStore((state) => state.addExplosion)
  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const mode = useExperienceStore((state) => state.mode)
  const collidedIdsRef = useRef(new Set<string>())
  const objectPosition = useMemo(() => new THREE.Vector3(), [])
  const bodyPosition = useMemo(() => new THREE.Vector3(), [])
  const enabled = !isPaused && spawnedObjects.length > 0 && mode === 'sandbox'

  useEffect(() => {
    const activeIds = new Set(spawnedObjects.map((object) => object.id))
    collidedIdsRef.current.forEach((id) => {
      if (!activeIds.has(id)) collidedIdsRef.current.delete(id)
    })
  }, [spawnedObjects])

  useFrameLane({
    id: 'sandbox-collision-detector',
    lane: 'ephemeris',
    priority: 80,
    enabled,
  }, ({ simulationDateMs }) => {
    for (const object of spawnedObjects) {
      if (collidedIdsRef.current.has(object.id)) continue

      getSpawnedObjectVisualPosition(
        object,
        simulationDateMs,
        mode,
        objectPosition
      )

      if (objectPosition.length() < sunData.radius + object.radius) {
        collidedIdsRef.current.add(object.id)
        addExplosion(
          objectPosition.toArray() as [number, number, number],
          '#ff7a18'
        )
        window.setTimeout(() => removeSpawnedObject(object.id), 80)
        continue
      }

      for (const planet of planets) {
        getBodyVisualPosition(planet.id, simulationDateMs, mode, bodyPosition)
        const collisionDistance = (object.radius + planet.radius) * 1.35

        if (objectPosition.distanceToSquared(bodyPosition) > collisionDistance * collisionDistance) {
          continue
        }

        collidedIdsRef.current.add(object.id)
        addExplosion(
          objectPosition.toArray() as [number, number, number],
          planet.color
        )
        window.setTimeout(() => removeSpawnedObject(object.id), 80)
        break
      }
    }
  })

  return null
}
