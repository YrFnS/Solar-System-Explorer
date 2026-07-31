'use client'

import dynamic from 'next/dynamic'
import LabW5aStatus from '../../../components/solar-system/webgpu/LabW5aStatus'

const WebGPULab = dynamic(
  () => import('../../../components/solar-system/webgpu/WebGPULab'),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-[#02030a] px-4 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-5 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/65">
            Renderer laboratory
          </p>
          <p className="mt-2 text-sm text-white/55">Initializing the isolated WebGPU scene…</p>
        </div>
      </main>
    ),
  }
)

export default function WebGPULabPage() {
  return (
    <>
      <WebGPULab />
      <LabW5aStatus />
    </>
  )
}
