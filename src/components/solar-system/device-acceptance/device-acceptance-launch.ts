import type { EffectiveQuality } from '../performance-store'
import {
  createDefaultManualChecks,
  type AcceptanceDeviceClass,
  type AcceptanceManualChecks,
} from './device-acceptance-protocol'

export const DEVICE_ACCEPTANCE_CAPTURE_STORAGE_KEY =
  'solar-explorer-device-acceptance-v1'
export const DEVICE_ACCEPTANCE_CAPTURE_BACKUP_STORAGE_KEY =
  'solar-explorer-device-acceptance-backup-v1'
export const DEVICE_ACCEPTANCE_CAMPAIGN_STORAGE_KEY =
  'solar-explorer-device-acceptance-campaign-v1'
export const DEVICE_ACCEPTANCE_QUALITY_STORAGE_KEY =
  'solar-explorer-quality-preset-v1'

export const DEVICE_ACCEPTANCE_CAMPAIGN_SCHEMA =
  'solar-system-explorer-device-acceptance-campaign'
export const DEVICE_ACCEPTANCE_CAMPAIGN_SCHEMA_VERSION = 1

export type AcceptanceLaunchDeviceClass = Extract<
  AcceptanceDeviceClass,
  'integrated-laptop' | 'discrete-desktop' | 'android-phone'
>

export interface AcceptanceLaunchDeviceConfig {
  deviceClass: AcceptanceLaunchDeviceClass
  label: string
  recommendedQuality: EffectiveQuality
  description: string
}

export const ACCEPTANCE_LAUNCH_DEVICE_CONFIGS: readonly AcceptanceLaunchDeviceConfig[] = [
  {
    deviceClass: 'integrated-laptop',
    label: 'Integrated-graphics laptop',
    recommendedQuality: 'balanced',
    description: 'Intel or AMD integrated graphics. Balanced is the primary acceptance profile.',
  },
  {
    deviceClass: 'discrete-desktop',
    label: 'Discrete-GPU desktop',
    recommendedQuality: 'ultra',
    description: 'Desktop with a dedicated NVIDIA, AMD, or Intel Arc GPU. Ultra is the primary profile.',
  },
  {
    deviceClass: 'android-phone',
    label: 'Android phone',
    recommendedQuality: 'eco',
    description: 'Run both portrait and landscape evidence. Eco is the primary profile.',
  },
] as const

export interface AcceptanceLaunchSelection {
  campaignId: string
  deviceClass: AcceptanceLaunchDeviceClass
  quality: EffectiveQuality
  deviceLabel: string
  fresh: boolean
}

export interface AcceptanceCampaignMetadata {
  schema: typeof DEVICE_ACCEPTANCE_CAMPAIGN_SCHEMA
  schemaVersion: typeof DEVICE_ACCEPTANCE_CAMPAIGN_SCHEMA_VERSION
  campaignId: string
  deviceClass: AcceptanceLaunchDeviceClass
  recommendedQuality: EffectiveQuality
  deviceLabel: string
  fresh: boolean
  launchedAt: string
  sourceUrl: string
}

export interface AcceptanceCaptureWorkspace {
  deviceClass: AcceptanceDeviceClass
  deviceLabel: string
  manualChecks: AcceptanceManualChecks
  screenshots: unknown[]
  sessions: unknown[]
}

export interface PreparedAcceptanceLaunch {
  workspace: AcceptanceCaptureWorkspace
  backup: AcceptanceCaptureWorkspace | null
  metadata: AcceptanceCampaignMetadata
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isLaunchDeviceClass(
  value: string | null
): value is AcceptanceLaunchDeviceClass {
  return ACCEPTANCE_LAUNCH_DEVICE_CONFIGS.some(
    ({ deviceClass }) => deviceClass === value
  )
}

function isEffectiveQuality(value: string | null): value is EffectiveQuality {
  return value === 'eco' || value === 'balanced' || value === 'ultra'
}

function normalizeManualChecks(value: unknown): AcceptanceManualChecks {
  const source = isRecord(value) ? value : {}
  const defaults = createDefaultManualChecks()
  return {
    interactionResponsive: source.interactionResponsive === true,
    visualParityEco: source.visualParityEco === true,
    visualParityBalanced: source.visualParityBalanced === true,
    visualParityUltra: source.visualParityUltra === true,
    portraitApproved: source.portraitApproved === true,
    landscapeApproved: source.landscapeApproved === true,
    sleepResumeApproved: source.sleepResumeApproved === true,
    contextRecoveryApproved: source.contextRecoveryApproved === true,
    thermalApproved: source.thermalApproved === true,
    notes: typeof source.notes === 'string' ? source.notes : defaults.notes,
  }
}

function normalizeWorkspace(value: unknown): AcceptanceCaptureWorkspace {
  const source = isRecord(value) ? value : {}
  const deviceClass = typeof source.deviceClass === 'string'
    && ['integrated-laptop', 'discrete-desktop', 'android-phone', 'other'].includes(
      source.deviceClass
    )
    ? source.deviceClass as AcceptanceDeviceClass
    : 'other'

  return {
    deviceClass,
    deviceLabel: typeof source.deviceLabel === 'string' ? source.deviceLabel : '',
    manualChecks: normalizeManualChecks(source.manualChecks),
    screenshots: Array.isArray(source.screenshots) ? source.screenshots : [],
    sessions: Array.isArray(source.sessions) ? source.sessions : [],
  }
}

export function getAcceptanceLaunchConfig(
  deviceClass: AcceptanceLaunchDeviceClass
): AcceptanceLaunchDeviceConfig {
  return ACCEPTANCE_LAUNCH_DEVICE_CONFIGS.find(
    (config) => config.deviceClass === deviceClass
  ) ?? ACCEPTANCE_LAUNCH_DEVICE_CONFIGS[0]
}

export function sanitizeAcceptanceCampaignId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function createAcceptanceCampaignId(
  date = new Date(),
  entropy = Math.random()
) {
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
  ].join('')
  const boundedEntropy = Math.min(0.999999, Math.max(0, entropy))
  const suffix = Math.floor(boundedEntropy * 1_679_615)
    .toString(36)
    .padStart(4, '0')
    .slice(0, 4)
  return `solar-${stamp}-${suffix}`
}

export function buildAcceptanceLaunchUrl(input: {
  baseUrl: string
  campaignId: string
  deviceClass: AcceptanceLaunchDeviceClass
  deviceLabel?: string
  quality?: EffectiveQuality
  fresh?: boolean
}) {
  const campaignId = sanitizeAcceptanceCampaignId(input.campaignId)
  if (!campaignId) throw new Error('Campaign ID is required.')

  const config = getAcceptanceLaunchConfig(input.deviceClass)
  const label = input.deviceLabel?.trim() || config.label
  const taggedLabel = label.toLowerCase().includes(campaignId)
    ? label
    : `${label} · ${campaignId}`
  const url = new URL('/lab/device-acceptance/launch', input.baseUrl)
  url.searchParams.set('campaign', campaignId)
  url.searchParams.set('device', input.deviceClass)
  url.searchParams.set('profile', input.quality ?? config.recommendedQuality)
  url.searchParams.set('label', taggedLabel)
  url.searchParams.set('fresh', input.fresh === false ? '0' : '1')
  return url.toString()
}

export function parseAcceptanceLaunchSearch(
  search: URLSearchParams
): AcceptanceLaunchSelection | null {
  const deviceClass = search.get('device')
  if (!isLaunchDeviceClass(deviceClass)) return null

  const campaignId = sanitizeAcceptanceCampaignId(search.get('campaign') ?? '')
  if (!campaignId) return null

  const config = getAcceptanceLaunchConfig(deviceClass)
  const requestedQuality = search.get('profile')
  const quality = isEffectiveQuality(requestedQuality)
    ? requestedQuality
    : config.recommendedQuality
  const rawLabel = search.get('label')?.trim()
  const fallbackLabel = `${config.label} · ${campaignId}`

  return {
    campaignId,
    deviceClass,
    quality,
    deviceLabel: rawLabel || fallbackLabel,
    fresh: search.get('fresh') !== '0',
  }
}

export function prepareAcceptanceLaunch(input: {
  existingWorkspace: unknown
  selection: AcceptanceLaunchSelection
  launchedAt?: string
  sourceUrl: string
}): PreparedAcceptanceLaunch {
  const current = normalizeWorkspace(input.existingWorkspace)
  const hasExistingEvidence = current.sessions.length > 0
    || current.screenshots.length > 0
    || Object.values(current.manualChecks).some((value) => (
      typeof value === 'boolean' ? value : value.trim().length > 0
    ))
  const backup = input.selection.fresh && hasExistingEvidence
    ? current
    : null

  const workspace: AcceptanceCaptureWorkspace = input.selection.fresh
    ? {
        deviceClass: input.selection.deviceClass,
        deviceLabel: input.selection.deviceLabel,
        manualChecks: createDefaultManualChecks(),
        screenshots: [],
        sessions: [],
      }
    : {
        ...current,
        deviceClass: input.selection.deviceClass,
        deviceLabel: input.selection.deviceLabel,
      }

  return {
    workspace,
    backup,
    metadata: {
      schema: DEVICE_ACCEPTANCE_CAMPAIGN_SCHEMA,
      schemaVersion: DEVICE_ACCEPTANCE_CAMPAIGN_SCHEMA_VERSION,
      campaignId: input.selection.campaignId,
      deviceClass: input.selection.deviceClass,
      recommendedQuality: input.selection.quality,
      deviceLabel: input.selection.deviceLabel,
      fresh: input.selection.fresh,
      launchedAt: input.launchedAt ?? new Date().toISOString(),
      sourceUrl: input.sourceUrl,
    },
  }
}
