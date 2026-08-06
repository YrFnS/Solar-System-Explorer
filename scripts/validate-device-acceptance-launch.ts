import assert from 'node:assert/strict'
import {
  ACCEPTANCE_LAUNCH_DEVICE_CONFIGS,
  buildAcceptanceLaunchUrl,
  createAcceptanceCampaignId,
  parseAcceptanceLaunchSearch,
  prepareAcceptanceLaunch,
  sanitizeAcceptanceCampaignId,
} from '../src/components/solar-system/device-acceptance/device-acceptance-launch'

const campaignId = createAcceptanceCampaignId(
  new Date('2026-08-06T12:34:00.000Z'),
  0.5
)
assert.match(campaignId, /^solar-202608061234-[a-z0-9]{4}$/)
assert.equal(
  sanitizeAcceptanceCampaignId('  Device Run / Baghdad  '),
  'device-run-baghdad'
)
assert.equal(ACCEPTANCE_LAUNCH_DEVICE_CONFIGS.length, 3)

const launchUrl = buildAcceptanceLaunchUrl({
  baseUrl: 'http://192.168.1.10:3000',
  campaignId: 'Baghdad Lab 01',
  deviceClass: 'integrated-laptop',
  deviceLabel: 'Latitude 7420 · Intel Iris Xe',
  fresh: true,
})
const parsedUrl = new URL(launchUrl)
assert.equal(parsedUrl.pathname, '/lab/device-acceptance/launch')
assert.equal(parsedUrl.searchParams.get('campaign'), 'baghdad-lab-01')
assert.equal(parsedUrl.searchParams.get('device'), 'integrated-laptop')
assert.equal(parsedUrl.searchParams.get('profile'), 'balanced')
assert.equal(parsedUrl.searchParams.get('fresh'), '1')
assert.match(parsedUrl.searchParams.get('label') ?? '', /baghdad-lab-01/i)

const selection = parseAcceptanceLaunchSearch(parsedUrl.searchParams)
assert.ok(selection)
assert.equal(selection.deviceClass, 'integrated-laptop')
assert.equal(selection.quality, 'balanced')
assert.equal(selection.fresh, true)

const existingWorkspace = {
  deviceClass: 'other',
  deviceLabel: 'Old device',
  manualChecks: {
    interactionResponsive: true,
    notes: 'Previous campaign',
  },
  screenshots: [{ id: 'old-shot' }],
  sessions: [{ id: 'old-session' }],
}
const fresh = prepareAcceptanceLaunch({
  existingWorkspace,
  selection,
  sourceUrl: launchUrl,
  launchedAt: '2026-08-06T12:35:00.000Z',
})
assert.equal(fresh.workspace.deviceClass, 'integrated-laptop')
assert.equal(fresh.workspace.sessions.length, 0)
assert.equal(fresh.workspace.screenshots.length, 0)
assert.equal(fresh.workspace.manualChecks.interactionResponsive, false)
assert.equal(fresh.backup?.sessions.length, 1)
assert.equal(fresh.metadata.campaignId, 'baghdad-lab-01')
assert.equal(fresh.metadata.recommendedQuality, 'balanced')

const preserveSelection = {
  ...selection,
  fresh: false,
  deviceClass: 'android-phone' as const,
  quality: 'eco' as const,
  deviceLabel: 'Pixel campaign device',
}
const preserved = prepareAcceptanceLaunch({
  existingWorkspace,
  selection: preserveSelection,
  sourceUrl: launchUrl,
})
assert.equal(preserved.backup, null)
assert.equal(preserved.workspace.sessions.length, 1)
assert.equal(preserved.workspace.screenshots.length, 1)
assert.equal(preserved.workspace.manualChecks.interactionResponsive, true)
assert.equal(preserved.workspace.deviceClass, 'android-phone')

const invalid = parseAcceptanceLaunchSearch(new URLSearchParams({
  campaign: 'valid-campaign',
  device: 'unsupported-device',
}))
assert.equal(invalid, null)

console.log('[device-acceptance-launch] campaign IDs, launch links, fresh backup, and preserved-workspace behavior passed')
