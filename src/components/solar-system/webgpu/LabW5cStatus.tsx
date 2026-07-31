'use client'

import {
  LAB_POST_BLOOM_PASS_COUNT,
  LAB_POST_RADIUS,
  LAB_POST_STRENGTH,
  LAB_POST_THRESHOLD,
} from './LabPostProcessing'

export default function LabW5cStatus() {
  return (
    <aside className="pointer-events-none fixed bottom-3 right-3 z-30 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-fuchsia-200/10 bg-[#04070d]/86 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-fuchsia-100/45">
            W5c parity scope
          </p>
          <h2 className="mt-1 text-[11px] font-semibold text-white/80">
            TSL render pipeline
          </h2>
        </div>
        <span className="rounded-full border border-fuchsia-200/10 bg-fuchsia-200/[0.06] px-2 py-1 font-mono text-[8px] font-semibold text-fuchsia-100/65">
          Material TSL · Nebula TSL · Gravity TSL · Post FX TSL
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5 font-mono text-[8px] text-white/38">
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">bloom</span>
          <span className="mt-0.5 block text-white/65">{LAB_POST_BLOOM_PASS_COUNT}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">strength</span>
          <span className="mt-0.5 block text-white/65">{LAB_POST_STRENGTH}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">radius</span>
          <span className="mt-0.5 block text-white/65">{LAB_POST_RADIUS}</span>
        </div>
        <div className="rounded-xl border border-white/6 bg-black/20 px-2 py-2">
          <span className="block text-white/25">threshold</span>
          <span className="mt-0.5 block text-white/65">{LAB_POST_THRESHOLD}</span>
        </div>
      </div>

      <p className="mt-3 text-[8px] leading-relaxed text-white/32">
        One scene pass feeds restrained threshold bloom through Three.js RenderPipeline. The in-panel toggle switches to direct rendering without remounting the renderer.
      </p>
    </aside>
  )
}
