'use client'

import {
  LAB_SUN_EFFECT_IDS,
  LAB_SUN_FLARE_ARCS,
} from './LabSunEffects'

export default function LabW4Status() {
  return (
    <aside className="pointer-events-none fixed bottom-3 right-3 z-30 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-orange-200/10 bg-[#090704]/82 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-orange-100/45">
            W4 parity scope
          </p>
          <h2 className="mt-1 text-[11px] font-semibold text-white/80">
            TSL Sun presentation
          </h2>
        </div>
        <span className="rounded-full border border-orange-200/10 bg-orange-200/[0.06] px-2 py-1 font-mono text-[8px] font-semibold text-orange-100/65">
          Material TSL
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[8px] text-white/38">
        <div className="rounded-xl border border-white/6 bg-black/20 px-2.5 py-2">
          <span className="block text-white/25">layers</span>
          <span className="mt-0.5 block text-white/65">{LAB_SUN_EFFECT_IDS.length}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2.5 py-2">
          <span className="block text-white/25">flare arcs</span>
          <span className="mt-0.5 block text-white/65">{LAB_SUN_FLARE_ARCS}</span>
        </div>
      </div>

      <p className="mt-3 text-[8px] leading-relaxed text-white/32">
        Corona, outer glow, and restrained flare arcs animate in node-material graphs. JavaScript does not rewrite Sun vertices per frame.
      </p>
    </aside>
  )
}
