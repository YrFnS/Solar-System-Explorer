'use client'

import dynamic from 'next/dynamic'

const DeviceAcceptanceLaunch = dynamic(
  () => import('../../../../components/solar-system/device-acceptance/DeviceAcceptanceLaunch'),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-[#02030a] px-4 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-5 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/65">
            P2.3 device campaign
          </p>
          <p className="mt-2 text-sm text-white/55">
            Preparing shareable physical-device launch links…
          </p>
        </div>
      </main>
    ),
  }
)

export default function DeviceAcceptanceLaunchPage() {
  return <DeviceAcceptanceLaunch />
}
