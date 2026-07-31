'use client'

import {
  LAB_BLACK_HOLE_COUNT,
  LAB_GRAVITY_OBJECT_COUNT,
  LAB_WORMHOLE_COUNT,
  LAB_WORMHOLE_MOUTH_COUNT,
} from './LabGravitationalObjects'
import { LAB_NEBULA_SHELL_COUNT } from './LabNebulaHaze'

export default function LabW5bStatus() {
  return (
    <aside className="pointer-events-none fixed bottom-3 right-3 z-30 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-violet-200/10 bg-[#04070d]/86 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-violet-100/45">
            W5b parity scope
          </p>
          <h2 className="mt-1 text-[11px] font-semibold text-white/80">
            TSL gravitational presentation
          </h2>
        </div>
        <span className="rounded-full border border-violet-200/10 bg-violet-200/[0.06] px-2 py-1 font-mono text-[8px] font-semibold text-violet-100/65">
          Material TSL · Nebula TSL · Gravity TSL
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5 font-mono text-[8px] text-white/38">
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">objects</span>
          <span className="mt-0.5 block text-white/65">{LAB_GRAVITY_OBJECT_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">black hole</span>
          <span className="mt-0.5 block text-white/65">{LAB_BLACK_HOLE_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">wormhole</span>
          <span className="mt-0.5 block text-white/65">{LAB_WORMHOLE_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">mouths</span>
          <span className="mt-0.5 block text-white/65">{LAB_WORMHOLE_MOUTH_COUNT}</span>
        </div>
      </div>

      <p className="mt-3 text-[8px] leading-relaxed text-white/32">
        The {LAB_NEBULA_SHELL_COUNT}-shell W5a haze now shares the parity scene with a node-material black hole and wormhole. No screen-space distortion or post-processing is active.
      </p>
    </aside>
  )
}
