'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  activateExperienceMode,
  useExperienceStore,
} from './experience-store'
import {
  advanceSimulationClock,
  getSimulationDateMs,
  setSimulationDateMs,
} from './simulation-clock'
import { useSolarSystemStore } from './store'

const UI_PUBLISH_INTERVAL = 0.2

/**
 * Advances the authoritative ephemeris clock before any orbital component runs.
 * Scene objects read the mutable clock directly in useFrame, while the date is
 * mirrored into Zustand at a low frequency for DOM controls and telemetry.
 */
export default function SimulationController() {
  const timeSpeed = useSolarSystemStore((state) => state.timeSpeed)
  const isPaused = useSolarSystemStore((state) => state.isPaused)
  const customDate = useSolarSystemStore((state) => state.customDate)
  const setElapsedTime = useSolarSystemStore((state) => state.setElapsedTime)
  const mode = useExperienceStore((state) => state.mode)
  const publishDate = useExperienceStore((state) => state.setSimulationDateMs)
  const invalidate = useThree((state) => state.invalidate)
  const publishElapsedRef = useRef(Number.POSITIVE_INFINITY)
  const initializedModeRef = useRef(false)

  const customDateMs = customDate?.getTime() ?? null

  useEffect(() => {
    if (initializedModeRef.current) return
    initializedModeRef.current = true
    activateExperienceMode(mode)
    invalidate()
  }, [invalidate, mode])

  useEffect(() => {
    const nextDateMs = customDateMs ?? Date.now()
    setSimulationDateMs(nextDateMs)
    publishDate(nextDateMs)
    setElapsedTime(nextDateMs)
    publishElapsedRef.current = 0
    invalidate()
  }, [customDateMs, invalidate, publishDate, setElapsedTime])

  useFrame((_, delta) => {
    const dateMs = advanceSimulationClock(delta, timeSpeed, isPaused)
    publishElapsedRef.current += delta

    if (publishElapsedRef.current < UI_PUBLISH_INTERVAL) return

    publishElapsedRef.current = 0
    publishDate(dateMs)
    setElapsedTime(dateMs)
  }, -100)

  useEffect(() => {
    const dateMs = getSimulationDateMs()
    publishDate(dateMs)
    setElapsedTime(dateMs)
  }, [publishDate, setElapsedTime])

  return null
}
