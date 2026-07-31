'use client'

import {
  LAB_NEBULA_SHELL_COUNT,
  LAB_NEBULA_SYSTEM_IDS,
} from './LabNebulaHaze'
import {
  LAB_SUN_EFFECT_IDS,
  LAB_SUN_FLARE_ARCS,
} from './LabSunEffects'

export default function LabW5aStatus() {
  return (
    <aside className="pointer-events-none fixed bottom-3 right-3 z-30 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-cyan-200/10 bg-[#04070d]/84 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-cyan-100/45">
            W5a parity scope
          </p>
          <h2 className="mt-1 text-[11px] font-semibold text-white/80">
            TSL space presentation
          </h2>
        </div>
        <span className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.06] px-2 py-1 font-mono text-[8px] font-semibold text-cyan-100/65">
          Material TSL · Nebula TSL
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5 font-mono text-[8px] text-white/38">
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">sun</span>
          <span className="mt-0.5 block text-white/65">{LAB_SUN_EFFECT_IDS.length}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">flares</span>
          <span className="mt-0.5 block text-white/65">{LAB_SUN_FLARE_ARCS}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">nebula</span>
          <span className="mt-0.5 block text-white/65">{LAB_NEBULA_SHELL_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">CPU verts</span>
          <span className="mt-0.5 block text-white/65">0</span>
        </div>
      </div>

      <p className="mt-3 text-[8px] leading-relaxed text-white/32">
        {LAB_NEBULA_SYSTEM_IDS.length} restrained background shells and the W4 Sun layers animate in material-node graphs without post-processing or JavaScript vertex rewrites.
      </p>
    </aside>
  )
}
