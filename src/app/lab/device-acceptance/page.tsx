'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'

const DeviceAcceptanceLab = dynamic(
  () => import('../../../components/solar-system/device-acceptance/DeviceAcceptanceLab'),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-[#02030a] px-4 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-5 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/65">
            P2.1 acceptance lab
          </p>
          <p className="mt-2 text-sm text-white/55">
            Preparing the production scene and device evidence controls…
          </p>
        </div>
      </main>
    ),
  }
)

export default function DeviceAcceptancePage() {
  return (
    <>
      <DeviceAcceptanceLab />
      <Link
        href="/lab/device-acceptance/results"
        className="fixed left-3 top-14 z-[126] rounded-full border border-cyan-200/15 bg-black/70 px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-cyan-100/65 backdrop-blur-xl"
      >
        Review evidence
      </Link>
    </>
  )
}
