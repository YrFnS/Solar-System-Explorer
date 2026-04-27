'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSolarSystemStore, SpawnedObject } from './store'
import { planets, dwarfPlanets, comets, centaurs, scatteredDiscObjects } from './data'

const SUN_RADIUS = 2.5
const CORE_PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']

function getBodyPosition(id: string, time: number): THREE.Vector3 | null {
  const dateOffset = useSolarSystemStore.getState().customDateAngleBase

  if (id === 'sun') return new THREE.Vector3(0, 0, 0)

  const planet = planets.find((p) => p.id === id)
  if (planet) {
    const angle = time * planet.orbitSpeed * 0.05 + dateOffset * planet.orbitSpeed + planet.initialAngle
    return new THREE.Vector3(
      Math.cos(angle) * planet.orbitRadius,
      0,
      Math.sin(angle) * planet.orbitRadius
    )
  }

  const dwarfPlanet = dwarfPlanets.find((d) => d.id === id)
  if (dwarfPlanet) {
    const angle = time * dwarfPlanet.orbitSpeed * 0.05 + dateOffset * dwarfPlanet.orbitSpeed + dwarfPlanet.initialAngle
    return new THREE.Vector3(
      Math.cos(angle) * dwarfPlanet.orbitRadius,
      0,
      Math.sin(angle) * dwarfPlanet.orbitRadius
    )
  }

  const comet = comets.find((c) => c.id === id)
  if (comet) {
    const angle = time * comet.orbitSpeed * 0.05 + dateOffset * comet.orbitSpeed
    return new THREE.Vector3(
      Math.cos(angle) * comet.orbitRadius,
      0,
      Math.sin(angle) * comet.orbitRadius
    )
  }

  return null
}

function getBodyRadius(id: string): number {
  if (id === 'sun') return SUN_RADIUS
  const planet = planets.find((p) => p.id === id)
  if (planet) return planet.radius
  const dwarfPlanet = dwarfPlanets.find((d) => d.id === id)
  if (dwarfPlanet) return dwarfPlanet.radius
  const comet = comets.find((c) => c.id === id)
  if (comet) return comet.radius
  return 0.5
}

function getSpawnedObjectPosition(obj: SpawnedObject, time: number): THREE.Vector3 {
  if (obj.type === 'interstellar') {
    const angle = time * obj.orbitSpeed * 0.05 + obj.initialAngle
    const e = obj.orbitEccentricity
    const a = obj.orbitRadius
    const denom = 1 + e * Math.cos(angle)
    const r = denom > 0.1 ? Math.min(a * (e * e - 1) / denom, 100) : 100
    return new THREE.Vector3(
      Math.cos(angle) * r,
      Math.sin(angle) * Math.sin(obj.orbitInclination) * r * 0.1,
      Math.sin(angle) * r
    )
  } else {
    const angle = time * obj.orbitSpeed * 0.05 + obj.initialAngle
    const e = obj.orbitEccentricity
    const a = obj.orbitRadius
    const r = a * (1 - e * e) / (1 + e * Math.cos(angle))
    return new THREE.Vector3(
      Math.cos(angle) * r,
      Math.sin(angle) * Math.sin(obj.orbitInclination) * r * 0.1,
      Math.sin(angle) * r
    )
  }
}

export default function CollisionDetector() {
  const spawnedObjects = useSolarSystemStore((s) => s.spawnedObjects)
  const removeSpawnedObject = useSolarSystemStore((s) => s.removeSpawnedObject)
  const addExplosion = useSolarSystemStore((s) => s.addExplosion)
  const timeSpeed = useSolarSystemStore((s) => s.timeSpeed)
  const isPaused = useSolarSystemStore((s) => s.isPaused)

  const collidedIds = new Set<string>()
  const lastTimeRef = useRef(0)

  useEffect(() => {
    return () => {
      collidedIds.clear()
    }
  }, [])

  useFrame((_, delta) => {
    if (isPaused || spawnedObjects.length === 0) return

    lastTimeRef.current += delta * timeSpeed * 0.05

    spawnedObjects.forEach((obj) => {
      if (collidedIds.has(obj.id)) return

      const objPos = getSpawnedObjectPosition(obj, lastTimeRef.current)
      const objRadius = obj.radius

      // Check Sun collision
      const sunDist = objPos.length()
      if (sunDist < SUN_RADIUS + objRadius) {
        collidedIds.add(obj.id)
        addExplosion(objPos.toArray() as [number, number, number], '#ff4400')
        setTimeout(() => removeSpawnedObject(obj.id), 100)
        return
      }

      // Check planet collisions
      for (const planet of planets) {
        if (!CORE_PLANET_IDS.includes(planet.id)) continue

        const planetPos = getBodyPosition(planet.id, lastTimeRef.current)
        if (!planetPos) continue

        const planetRadius = getBodyRadius(planet.id)
        const dist = objPos.distanceTo(planetPos)

        if (dist < (objRadius + planetRadius) * 1.5) {
          collidedIds.add(obj.id)
          addExplosion(objPos.toArray() as [number, number, number], planet.color)
          setTimeout(() => removeSpawnedObject(obj.id), 100)
          return
        }
      }
    })
  })

  return null
}
