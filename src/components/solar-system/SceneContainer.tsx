'use client'

import { Canvas } from '@react-three/fiber'
import SolarSystem from './SolarSystem'
import UIOverlay from './UIOverlay'
import { useSolarSystemStore } from './store'

export default function SceneContainer() {
  const setSelectedBody = useSolarSystemStore((s) => s.setSelectedBody)

  return (
    <>
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{
            position: [80, 60, 80],
            fov: 45,
            near: 0.1,
            far: 10000,
          }}
          onPointerMissed={() => setSelectedBody(null)}
        >
          <SolarSystem />
        </Canvas>
      </div>
      <UIOverlay />
    </>
  )
}


