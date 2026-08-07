'use client'

import Link from 'next/link'
import {
  Check,
  Clipboard,
  ExternalLink,
  Laptop,
  Link2,
  Monitor,
  Network,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  ACCEPTANCE_LAUNCH_DEVICE_CONFIGS,
  buildAcceptanceLaunchUrl,
  createAcceptanceCampaignId,
  DEVICE_ACCEPTANCE_CAMPAIGN_STORAGE_KEY,
  DEVICE_ACCEPTANCE_CAPTURE_BACKUP_STORAGE_KEY,
  DEVICE_ACCEPTANCE_CAPTURE_STORAGE_KEY,
  DEVICE_ACCEPTANCE_QUALITY_STORAGE_KEY,
  parseAcceptanceLaunchSearch,
  prepareAcceptanceLaunch,
  sanitizeAcceptanceCampaignId,
  type AcceptanceLaunchDeviceClass,
} from './device-acceptance-launch'

interface AcceptanceLaunchDiagnostics {
  ready: boolean
  mode: 'controller' | 'bootstrap'
  campaignId: string | null
  generatedLinkCount: number
  freshWorkspace: boolean | null
  selectedDeviceClass: AcceptanceLaunchDeviceClass | null
  selectedQuality: string | null
  updatedAt: number
}

declare global {
  interface Window {
    __SOLAR_DEVICE_ACCEPTANCE_LAUNCH__?: AcceptanceLaunchDiagnostics
  }
}

const INITIAL_LABELS: Record<AcceptanceLaunchDeviceClass, string> = {
  'integrated-laptop': 'Integrated laptop model · GPU',
  'discrete-desktop': 'Desktop model · discrete GPU',
  'android-phone': 'Android phone model · GPU',
}

function DeviceGlyph({ deviceClass }: { deviceClass: AcceptanceLaunchDeviceClass }) {
  if (deviceClass === 'integrated-laptop') return <Laptop className="h-5 w-5" />
  if (deviceClass === 'discrete-desktop') return <Monitor className="h-5 w-5" />
  return <Smartphone className="h-5 w-5" />
}

function readJsonStorage(key: string) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as unknown : null
  } catch {
    return null
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  }
}

export default function DeviceAcceptanceLaunch() {
  const launchSelection = useMemo(() => {
    if (typeof window === 'undefined') return null
    return parseAcceptanceLaunchSearch(new URLSearchParams(window.location.search))
  }, [])
  const [campaignId, setCampaignId] = useState(() => {
    if (typeof window === 'undefined') return ''
    const requested = sanitizeAcceptanceCampaignId(
      new URLSearchParams(window.location.search).get('campaign') ?? ''
    )
    return requested || createAcceptanceCampaignId()
  })
  const [baseUrl, setBaseUrl] = useState(() => (
    typeof window === 'undefined' ? '' : window.location.origin
  ))
  const [freshWorkspace, setFreshWorkspace] = useState(true)
  const [labels, setLabels] = useState(INITIAL_LABELS)
  const [message, setMessage] = useState(
    'Generate one launch link per physical device, then combine the exported bundles in the review workspace.'
  )
  const [copiedDevice, setCopiedDevice] = useState<AcceptanceLaunchDeviceClass | null>(null)

  useEffect(() => {
    if (!launchSelection) return

    const prepared = prepareAcceptanceLaunch({
      existingWorkspace: readJsonStorage(DEVICE_ACCEPTANCE_CAPTURE_STORAGE_KEY),
      selection: launchSelection,
      sourceUrl: window.location.href,
    })

    if (prepared.backup) {
      window.localStorage.setItem(
        DEVICE_ACCEPTANCE_CAPTURE_BACKUP_STORAGE_KEY,
        JSON.stringify({
          backedUpAt: new Date().toISOString(),
          campaignId: launchSelection.campaignId,
          workspace: prepared.backup,
        })
      )
    }
    window.localStorage.setItem(
      DEVICE_ACCEPTANCE_CAPTURE_STORAGE_KEY,
      JSON.stringify(prepared.workspace)
    )
    window.localStorage.setItem(
      DEVICE_ACCEPTANCE_CAMPAIGN_STORAGE_KEY,
      JSON.stringify(prepared.metadata)
    )
    window.localStorage.setItem(
      DEVICE_ACCEPTANCE_QUALITY_STORAGE_KEY,
      launchSelection.quality
    )
    window.__SOLAR_DEVICE_ACCEPTANCE_LAUNCH__ = {
      ready: true,
      mode: 'bootstrap',
      campaignId: launchSelection.campaignId,
      generatedLinkCount: 0,
      freshWorkspace: launchSelection.fresh,
      selectedDeviceClass: launchSelection.deviceClass,
      selectedQuality: launchSelection.quality,
      updatedAt: Date.now(),
    }

    const destination = new URL('/lab/device-acceptance', window.location.origin)
    destination.searchParams.set('campaign', launchSelection.campaignId)
    destination.searchParams.set('launched', '1')
    window.location.replace(destination.toString())
  }, [launchSelection])

  const launchLinks = useMemo(() => {
    const sanitizedCampaign = sanitizeAcceptanceCampaignId(campaignId)
    if (!baseUrl || !sanitizedCampaign) return []

    try {
      return ACCEPTANCE_LAUNCH_DEVICE_CONFIGS.map((config) => ({
        ...config,
        url: buildAcceptanceLaunchUrl({
          baseUrl,
          campaignId: sanitizedCampaign,
          deviceClass: config.deviceClass,
          deviceLabel: labels[config.deviceClass],
          quality: config.recommendedQuality,
          fresh: freshWorkspace,
        }),
      }))
    } catch {
      return []
    }
  }, [baseUrl, campaignId, freshWorkspace, labels])

  const localOnlyOrigin = useMemo(() => {
    try {
      const hostname = new URL(baseUrl).hostname
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    } catch {
      return false
    }
  }, [baseUrl])

  useEffect(() => {
    if (launchSelection) return
    const diagnostics: AcceptanceLaunchDiagnostics = {
      ready: launchLinks.length === ACCEPTANCE_LAUNCH_DEVICE_CONFIGS.length,
      mode: 'controller',
      campaignId: sanitizeAcceptanceCampaignId(campaignId) || null,
      generatedLinkCount: launchLinks.length,
      freshWorkspace,
      selectedDeviceClass: null,
      selectedQuality: null,
      updatedAt: Date.now(),
    }
    window.__SOLAR_DEVICE_ACCEPTANCE_LAUNCH__ = diagnostics
    return () => {
      if (window.__SOLAR_DEVICE_ACCEPTANCE_LAUNCH__ === diagnostics) {
        delete window.__SOLAR_DEVICE_ACCEPTANCE_LAUNCH__
      }
    }
  }, [campaignId, freshWorkspace, launchLinks.length, launchSelection])

  if (launchSelection) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-[#02030a] px-4 text-white"
        data-device-acceptance-launch-bootstrap
      >
        <section className="w-full max-w-md rounded-3xl border border-amber-200/15 bg-white/[0.035] p-6 text-center shadow-2xl backdrop-blur-xl">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-amber-200/75" />
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100/65">
            Campaign {launchSelection.campaignId}
          </p>
          <h1 className="mt-2 text-lg font-semibold">Preparing this device</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Applying {launchSelection.quality} quality, device identity, and a clean evidence workspace before opening the production capture lab.
          </p>
        </section>
      </main>
    )
  }

  async function copyLink(deviceClass: AcceptanceLaunchDeviceClass, url: string) {
    const copied = await copyToClipboard(url)
    setCopiedDevice(copied ? deviceClass : null)
    setMessage(copied ? 'Launch link copied.' : 'The browser could not copy this link.')
    window.setTimeout(() => setCopiedDevice(null), 1_500)
  }

  async function shareLink(label: string, url: string) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Solar System Explorer · ${label}`,
          text: 'Open this link on the assigned physical device to start its acceptance campaign.',
          url,
        })
        setMessage('Launch link shared.')
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    const copied = await copyToClipboard(url)
    setMessage(copied ? 'Sharing is unavailable, so the link was copied.' : 'Sharing and clipboard access are unavailable.')
  }

  async function copyAllLinks() {
    const text = launchLinks
      .map(({ label, recommendedQuality, url }) => (
        `${label} · ${recommendedQuality.toUpperCase()}\n${url}`
      ))
      .join('\n\n')
    const copied = await copyToClipboard(text)
    setMessage(copied ? 'All three launch links copied.' : 'The browser could not copy the campaign links.')
  }

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[#02030a] px-4 py-5 text-white sm:px-6 sm:py-8"
      data-device-acceptance-launch
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/65">
              P2.3 · Physical-device campaign
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Launch the same acceptance run on every device
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/45">
              Create traceable links for the integrated laptop, discrete desktop, and Android phone. Each link preloads the correct primary quality and device class before opening the production scene.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/lab/device-acceptance/results"
              className="rounded-full border border-cyan-200/15 bg-cyan-200/[0.06] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100/75"
            >
              Review evidence
            </Link>
            <Link
              href="/lab/device-acceptance"
              className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55"
            >
              Open capture lab
            </Link>
          </div>
        </header>

        <section className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/9 bg-white/[0.025] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-amber-200/15 bg-amber-200/[0.07] text-amber-100/75">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/38">Campaign identity</p>
                <p className="mt-1 text-sm text-white/72">One campaign and one deployed commit</p>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-[9px] uppercase tracking-[0.16em] text-white/35">Campaign ID</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={campaignId}
                  onChange={(event) => setCampaignId(sanitizeAcceptanceCampaignId(event.target.value))}
                  className="min-w-0 flex-1 rounded-2xl border border-white/9 bg-black/25 px-3 py-3 font-mono text-[11px] text-white/75 outline-none focus:border-amber-200/30"
                  aria-label="Acceptance campaign ID"
                />
                <button
                  type="button"
                  onClick={() => setCampaignId(createAcceptanceCampaignId())}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/9 bg-white/[0.035] text-white/48"
                  aria-label="Generate a new campaign ID"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </label>

            <label className="mt-3 block">
              <span className="text-[9px] uppercase tracking-[0.16em] text-white/35">Reachable base URL</span>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/9 bg-black/25 px-3 py-3 font-mono text-[11px] text-white/75 outline-none focus:border-cyan-200/30"
                aria-label="Acceptance server base URL"
              />
            </label>

            <label className="mt-3 flex items-start gap-3 rounded-2xl border border-white/7 bg-black/20 px-3 py-3">
              <input
                type="checkbox"
                checked={freshWorkspace}
                onChange={(event) => setFreshWorkspace(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-300"
              />
              <span>
                <span className="block text-[11px] font-medium text-white/72">Start a clean workspace on each device</span>
                <span className="mt-1 block text-[9px] leading-relaxed text-white/35">
                  Existing local evidence is backed up before the new campaign is initialized.
                </span>
              </span>
            </label>
          </div>

          <div className="rounded-3xl border border-white/9 bg-gradient-to-br from-cyan-200/[0.055] to-transparent p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.07] text-cyan-100/75">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/38">Operator status</p>
                <p className="mt-1 text-sm text-white/72">{launchLinks.length === 3 ? 'Three launch links ready' : 'Complete the campaign settings'}</p>
              </div>
            </div>
            <p className="mt-4 rounded-2xl border border-white/7 bg-black/20 px-3 py-3 text-[10px] leading-relaxed text-white/42">
              {message}
            </p>
            {localOnlyOrigin ? (
              <p className="mt-3 rounded-2xl border border-amber-200/15 bg-amber-200/[0.055] px-3 py-3 text-[10px] leading-relaxed text-amber-100/68">
                This origin is local-only. Run <code className="font-mono text-amber-100">bun run acceptance:serve</code> and use one of the printed LAN addresses before sending links to another device.
              </p>
            ) : (
              <p className="mt-3 rounded-2xl border border-emerald-200/12 bg-emerald-200/[0.045] px-3 py-3 text-[10px] leading-relaxed text-emerald-100/62">
                The base URL appears shareable. Keep every device on this exact deployed build so commit provenance remains consistent.
              </p>
            )}
            <button
              type="button"
              disabled={launchLinks.length !== 3}
              onClick={copyAllLinks}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-200 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-40"
            >
              <Clipboard className="h-4 w-4" /> Copy all launch links
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-3 lg:grid-cols-3">
          {launchLinks.map((entry) => (
            <article
              key={entry.deviceClass}
              className="min-w-0 rounded-3xl border border-white/9 bg-white/[0.025] p-4 shadow-2xl"
              data-launch-device={entry.deviceClass}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25 text-white/60">
                    <DeviceGlyph deviceClass={entry.deviceClass} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-white/85">{entry.label}</h2>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-amber-100/55">
                      Primary · {entry.recommendedQuality}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-white/8 bg-black/20 px-2 py-1 font-mono text-[8px] text-white/35">
                  {entry.deviceClass}
                </span>
              </div>

              <p className="mt-3 min-h-12 text-[10px] leading-relaxed text-white/38">
                {entry.description}
              </p>

              <label className="mt-3 block">
                <span className="text-[8px] uppercase tracking-[0.16em] text-white/30">Model and GPU label</span>
                <input
                  value={labels[entry.deviceClass]}
                  onChange={(event) => setLabels((current) => ({
                    ...current,
                    [entry.deviceClass]: event.target.value,
                  }))}
                  className="mt-1.5 w-full rounded-xl border border-white/8 bg-black/25 px-3 py-2.5 text-[10px] text-white/65 outline-none"
                />
              </label>

              <div className="mt-3 min-w-0 rounded-xl border border-white/6 bg-black/25 px-3 py-2.5">
                <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.14em] text-white/28">
                  <Link2 className="h-3 w-3" /> Launch URL
                </div>
                <p className="mt-1.5 break-all font-mono text-[8px] leading-relaxed text-white/38">
                  {entry.url}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => copyLink(entry.deviceClass, entry.url)}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.035] px-2 text-[9px] text-white/55"
                >
                  {copiedDevice === entry.deviceClass ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => shareLink(entry.label, entry.url)}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.035] px-2 text-[9px] text-white/55"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
                <a
                  href={entry.url}
                  data-testid={`launch-open-${entry.deviceClass}`}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-amber-300 px-2 text-[9px] font-semibold text-black"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              </div>
            </article>
          ))}
        </section>

        <footer className="mt-5 rounded-3xl border border-white/8 bg-white/[0.02] px-4 py-4 text-[10px] leading-relaxed text-white/38 sm:px-5">
          <p className="font-medium text-white/58">Recommended order</p>
          <p className="mt-1">
            Open the assigned link on each device, complete its capture checklist, export JSON and screenshots, then import all three bundles into the review workspace. A synthetic CI result never replaces this physical-device evidence.
          </p>
        </footer>
      </div>
    </main>
  )
}
