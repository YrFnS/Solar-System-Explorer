'use client'

import { useEffect, useRef } from 'react'
import { useSolarSystemStore } from './store'

// Global collision sound callback
declare global {
  interface Window {
    __collisionSound?: () => void
  }
}

// Ambient drone state
interface AmbientDrone {
  oscillators: OscillatorNode[]
  lfo: OscillatorNode
  masterGain: GainNode
}

export default function SoundManager() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const ambientDroneRef = useRef<AmbientDrone | null>(null)
  const explosions = useSolarSystemStore((s) => s.explosions)
  const isPaused = useSolarSystemStore((s) => s.isPaused)

  // Create ambient drone with oscillators and LFO modulation
  const createAmbientDrone = (ctx: AudioContext) => {
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0, ctx.currentTime)
    masterGain.connect(ctx.destination)

    // LFO for space-like hum modulation
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(0.15, ctx.currentTime) // Very slow modulation
    lfo.connect(masterGain.gain)
    lfo.start()

    // Create layered drone oscillators for rich ambient sound
    const droneFreqs = [40, 60, 80] // Low fundamental with harmonics
    const oscillators: OscillatorNode[] = []

    droneFreqs.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      osc.type = index === 0 ? 'sawtooth' : 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)

      // Individual gain for each oscillator
      const oscGain = ctx.createGain()
      oscGain.gain.setValueAtTime(index === 0 ? 0.08 : 0.04, ctx.currentTime)

      // Connect through a lowpass filter for warmth
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(200, ctx.currentTime)
      filter.Q.setValueAtTime(1, ctx.currentTime)

      osc.connect(filter)
      filter.connect(oscGain)
      oscGain.connect(masterGain)
      osc.start()

      oscillators.push(osc)
    })

    // Sub-bass rumble
    const subOsc = ctx.createOscillator()
    subOsc.type = 'sine'
    subOsc.frequency.setValueAtTime(25, ctx.currentTime)
    const subGain = ctx.createGain()
    subGain.gain.setValueAtTime(0.1, ctx.currentTime)
    subOsc.connect(subGain)
    subGain.connect(masterGain)
    subOsc.start()
    oscillators.push(subOsc)

    return { oscillators, lfo, masterGain }
  }

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = audioContextRef.current

      // Create and start ambient drone
      if (!ambientDroneRef.current) {
        ambientDroneRef.current = createAmbientDrone(ctx)

        // Fade in ambient drone
        ambientDroneRef.current.masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
      }

      document.removeEventListener('click', initAudio)
      document.removeEventListener('keydown', initAudio)
    }
    document.addEventListener('click', initAudio)
    document.addEventListener('keydown', initAudio)
    return () => {
      document.removeEventListener('click', initAudio)
      document.removeEventListener('keydown', initAudio)
    }
  }, [])

  // Handle pause state for ambient drone
  useEffect(() => {
    if (!audioContextRef.current || !ambientDroneRef.current) return
    const ctx = audioContextRef.current

    if (isPaused) {
      ambientDroneRef.current.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
    } else {
      ctx.resume()
      ambientDroneRef.current.masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.5)
    }
  }, [isPaused])

  // Play collision sound when explosion occurs
  useEffect(() => {
    if (explosions.length === 0 || isPaused) return
    if (!audioContextRef.current) return

    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    // Create a simple explosion sound using Web Audio API
    const playExplosionSound = () => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      // Low frequency rumble
      oscillator.frequency.setValueAtTime(80, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3)

      // Quick attack, medium decay
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)

      // Add a noise burst for impact feel
      const bufferSize = ctx.sampleRate * 0.1
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1
      }

      const noiseSource = ctx.createBufferSource()
      noiseSource.buffer = noiseBuffer

      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.15, ctx.currentTime)
      noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

      noiseSource.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noiseSource.start(ctx.currentTime)
    }

    playExplosionSound()

    // Register global collision sound callback
    window.__collisionSound = playExplosionSound
  }, [explosions, isPaused])

  return null // This component doesn't render anything
}
