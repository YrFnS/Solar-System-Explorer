'use client'

import { useState, useEffect, useCallback } from 'react'

/* ──────────────────────── WelcomeSplash ──────────────────────── */
/* Session-only splash screen — shows once per browser session      */
/* Uses a module-level state variable (not localStorage)            */

let _sessionShown = false

export default function WelcomeSplash() {
  const [visible, setVisible] = useState(() => !_sessionShown)
  const [fading, setFading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleDismiss = useCallback(() => {
    setFading((prev) => {
      if (prev) return prev
      setTimeout(() => {
        _sessionShown = true
        setVisible(false)
      }, 400) // wait for fade-out animation to complete
      return true
    })
  }, [])

  useEffect(() => {
    if (!visible) return

    // Progress bar fills over ~1.0 seconds
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 100))
    }, 100)

    // Auto-dismiss after 1.2 seconds
    const timer = setTimeout(() => {
      handleDismiss()
    }, 1200)

    return () => {
      clearTimeout(timer)
      clearInterval(progressInterval)
    }
  }, [visible, handleDismiss])

  if (!visible) return null

  // Pre-computed star positions for the background starfield
  const stars = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: (i * 37 + 13) % 100,
    y: (i * 53 + 7) % 100,
    size: (i % 4 === 0) ? 2 : (i % 3 === 0) ? 1.5 : 1,
    opacity: 0.1 + (i % 7) * 0.05,
    delay: (i % 10) * 0.3,
    duration: 1.5 + (i % 4) * 0.8,
  }))

  // Floating sparkle particles around the title area
  const sparkles = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    x: 30 + (i * 13) % 40,
    y: 30 + (i * 19) % 40,
    delay: i * 0.25,
    size: 1 + (i % 4),
  }))

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center overflow-hidden ${
        fading ? 'animate-welcome-fade-out' : ''
      }`}
      onClick={handleDismiss}
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, #0d0d3b 0%, #070720 35%, #020210 60%, #000000 100%)',
      }}
    >
      {/* Animated conic gradient overlay — subtle cosmic rotation */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(251,191,36,0.06) 50deg, transparent 100deg, rgba(52,211,153,0.04) 160deg, transparent 220deg, rgba(251,146,60,0.05) 300deg, transparent 360deg)',
          animation: 'orbit-diagram-spin 15s linear infinite',
        }}
      />

      {/* Deep space star field */}
      <div className="absolute inset-0 overflow-hidden">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Floating sparkle particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {sparkles.map((sp) => (
          <div
            key={sp.id}
            className="absolute rounded-full bg-amber-300/30"
            style={{
              left: `${sp.x}%`,
              top: `${sp.y}%`,
              width: `${sp.size}px`,
              height: `${sp.size}px`,
              animation: `float 3.5s ease-in-out infinite, glow-pulse 2.5s ease-in-out infinite`,
              animationDelay: `${sp.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Nebula glow behind the content — warm amber/gold */}
      <div
        className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, rgba(251,146,60,0.15) 35%, rgba(239,68,68,0.05) 60%, transparent 75%)',
        }}
      />
      {/* Secondary nebula — cool teal for contrast */}
      <div
        className="absolute top-[65%] left-[35%] -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-8 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(52,211,153,0.2) 0%, rgba(34,211,238,0.08) 50%, transparent 70%)',
        }}
      />

      {/* Main content */}
      <div className="text-center px-6 max-w-lg relative z-10">
        {/* Orbiting planets diagram */}
        <div className="relative w-36 h-36 mx-auto mb-8">
          {/* Outer orbit ring */}
          <div className="absolute inset-0 border border-white/[0.06] rounded-full" />
          {/* Middle orbit ring */}
          <div className="absolute inset-6 border border-white/[0.08] rounded-full" />
          {/* Inner orbit ring */}
          <div className="absolute inset-12 border border-white/[0.04] rounded-full" />

          {/* Orbiting planet 1 — emerald (Earth-like) on outer ring */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
          </div>
          {/* Orbiting planet 2 — amber (Saturn-like) on middle ring */}
          <div className="absolute inset-6 animate-spin" style={{ animationDuration: '5s' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50" />
          </div>
          {/* Orbiting planet 3 — red (Mars-like) on inner ring, reverse */}
          <div className="absolute inset-12 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-400 shadow-lg shadow-red-400/50" />
          </div>

          {/* Sun at center with pulsing glow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 shadow-xl shadow-yellow-400/50 animate-pulse" />
          </div>
          {/* Sun corona glow */}
          <div className="absolute inset-4 rounded-full bg-yellow-400/10 blur-lg animate-pulse" />

          {/* Comet tail streak */}
          <div
            className="absolute -top-6 -right-6 w-20 h-0.5 bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent animate-pulse"
            style={{ animationDuration: '2s', transform: 'rotate(-30deg)' }}
          />
        </div>

        {/* Title with glowing animation */}
        <h2
          className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight animate-glow-text"
          style={{
            background: 'linear-gradient(90deg, #FDE68A, #F59E0B, #F97316, #F59E0B, #FDE68A)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'glow-text 3s ease-in-out infinite, header-gradient-shift 4s ease infinite',
          }}
        >
          Solar System Explorer
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-white/50 leading-relaxed mb-6 tracking-wide">
          Explore the cosmos
        </p>

        {/* Keyboard hints */}
        <div className="flex flex-wrap justify-center gap-2 text-[10px] text-white/25 mb-6">
          <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/[0.06] hover:border-amber-400/20 transition-colors">
            <kbd className="bg-white/10 text-white/50 px-1.5 py-0.5 rounded border border-white/10 font-mono text-[9px]">&larr; &rarr;</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/[0.06] hover:border-amber-400/20 transition-colors">
            <kbd className="bg-white/10 text-white/50 px-1.5 py-0.5 rounded border border-white/10 font-mono text-[9px]">T</kbd>
            <span>Guided Tour</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/[0.06] hover:border-amber-400/20 transition-colors">
            <kbd className="bg-white/10 text-white/50 px-1.5 py-0.5 rounded border border-white/10 font-mono text-[9px]">Click</kbd>
            <span>Select Body</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/[0.06] hover:border-amber-400/20 transition-colors">
            <kbd className="bg-white/10 text-white/50 px-1.5 py-0.5 rounded border border-white/10 font-mono text-[9px]">Space</kbd>
            <span>Pause</span>
          </div>
        </div>

        {/* Loading progress bar */}
        <div className="w-48 mx-auto mb-4">
          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #F59E0B, #F97316, #EF4444)',
                boxShadow: '0 0 8px rgba(251,191,36,0.4)',
              }}
            />
          </div>
          <p className="text-[8px] text-white/15 mt-1.5 font-mono">
            {progress < 30 ? 'Initializing star charts...' : progress < 70 ? 'Loading planetary data...' : progress < 100 ? 'Calibrating telescope...' : 'Ready!'}
          </p>
        </div>

        <p className="text-[10px] text-white/20 animate-pulse">
          Click anywhere to start exploring
        </p>
      </div>
    </div>
  )
}
