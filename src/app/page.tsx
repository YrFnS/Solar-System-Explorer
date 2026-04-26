'use client'

import { Suspense, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSolarSystemStore } from '@/components/solar-system/store'

// Dynamically import the entire 3D container to ensure NO Three.js code runs on server
const SceneContainer = dynamic(() => import('../components/solar-system/SceneContainer'), { 
  ssr: false,
  loading: () => <LoadingScreen />
})

function LoadingScreen() {
  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50">
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 shadow-lg shadow-yellow-400/30" />
        </div>
      </div>
      <p className="text-white/40 text-sm tracking-widest uppercase">Loading Solar System</p>
      <div className="mt-3 w-32 h-0.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse" style={{ width: '60%' }} />
      </div>
    </div>
  )
}

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <LoadingScreen />

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <Suspense fallback={<LoadingScreen />}>
        <SceneContainer />
      </Suspense>
    </div>
  )
}
