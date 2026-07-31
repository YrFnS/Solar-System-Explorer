'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Gauge, RefreshCw } from 'lucide-react'

interface RendererBoundaryProps {
  children: ReactNode
}

interface RendererBoundaryState {
  failed: boolean
  message: string
}

const QUALITY_KEY = 'solar-explorer-quality-preset-v1'

export default class RendererBoundary extends Component<
  RendererBoundaryProps,
  RendererBoundaryState
> {
  state: RendererBoundaryState = {
    failed: false,
    message: '',
  }

  static getDerivedStateFromError(error: unknown): RendererBoundaryState {
    return {
      failed: true,
      message: error instanceof Error ? error.message : 'The 3D renderer could not start.',
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[solar-explorer] renderer failed', error, info.componentStack)
  }

  private retry = () => {
    window.location.reload()
  }

  private retryEco = () => {
    try {
      window.localStorage.setItem(QUALITY_KEY, 'eco')
    } catch {
      // Reload is still useful when storage is unavailable.
    }
    window.location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="absolute inset-0 grid place-items-center overflow-hidden bg-[#02030a] px-4 text-white">
        <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_50%_35%,rgba(251,146,60,0.16),transparent_36%),radial-gradient(circle_at_15%_75%,rgba(56,189,248,0.08),transparent_28%)]" />
        <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-2xl">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-rose-300/70 to-transparent" />
          <div className="p-5 sm:p-6">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-rose-300/15 bg-rose-300/[0.07]">
              <AlertTriangle className="h-5 w-5 text-rose-200/75" />
            </div>
            <p className="mt-4 text-[8px] font-semibold uppercase tracking-[0.24em] text-rose-200/55">
              3D renderer unavailable
            </p>
            <h1 className="mt-1 text-lg font-semibold text-white/92">
              WebGL 2 could not start
            </h1>
            <p className="mt-2 text-[10px] leading-relaxed text-white/40">
              This browser, graphics driver, remote session, or privacy setting prevented the GPU canvas from being created. Your saved preferences and bookmarks are safe.
            </p>

            {this.state.message ? (
              <pre className="mt-3 max-h-20 overflow-auto rounded-xl border border-white/6 bg-black/30 px-3 py-2 font-mono text-[8px] leading-relaxed text-white/28">
                {this.state.message}
              </pre>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={this.retryEco}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-amber-300 px-3 py-2.5 text-[9px] font-semibold text-black transition hover:bg-amber-200"
              >
                <Gauge className="h-3.5 w-3.5" /> Retry in Eco
              </button>
              <button
                type="button"
                onClick={this.retry}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[9px] text-white/60 transition hover:bg-white/[0.09] hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reload
              </button>
            </div>

            <p className="mt-3 text-[8px] leading-relaxed text-white/24">
              Hardware acceleration should be enabled for the best experience. On managed or virtual machines, WebGL may be unavailable even when the browser is otherwise supported.
            </p>
          </div>
        </section>
      </div>
    )
  }
}
