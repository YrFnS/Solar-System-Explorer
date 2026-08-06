import { spawn } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

const port = Number(process.env.DEVICE_ACCEPTANCE_LAUNCH_PORT || 3140)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const workspaceKey = 'solar-explorer-device-acceptance-v1'
const backupKey = 'solar-explorer-device-acceptance-backup-v1'
const campaignKey = 'solar-explorer-device-acceptance-campaign-v1'
const presetKey = 'solar-explorer-quality-preset-v1'
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function prepareStandaloneAssets() {
  await rm(path.join(standaloneRoot, 'public'), { recursive: true, force: true })
  await rm(path.join(standaloneNextRoot, 'static'), { recursive: true, force: true })
  await mkdir(standaloneNextRoot, { recursive: true })
  await cp(path.resolve('public'), path.join(standaloneRoot, 'public'), { recursive: true })
  await cp(path.resolve('.next', 'static'), path.join(standaloneNextRoot, 'static'), {
    recursive: true,
  })
}

async function waitForServer(server, timeoutMs = 45_000) {
  const started = Date.now()
  let lastError = null
  while (Date.now() - started < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`Standalone server exited early with code ${server.exitCode}`)
    }
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
      lastError = new Error(`Server returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await delay(350)
  }
  throw lastError instanceof Error
    ? new Error(`Timed out waiting for ${baseUrl}: ${lastError.message}`)
    : new Error(`Timed out waiting for ${baseUrl}`)
}

async function assertNoPageOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  if (overflow.page > overflow.viewport + 1 || overflow.body > overflow.viewport + 1) {
    throw new Error(`${label} overflowed horizontally: ${JSON.stringify(overflow)}`)
  }
}

async function main() {
  await prepareStandaloneAssets()
  const server = spawn('bun', ['server.js'], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOSTNAME: host,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let serverOutput = ''
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString() })
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString() })

  let browser
  try {
    await waitForServer(server)
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    })
    const page = await browser.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    await page.goto(
      `${baseUrl}/lab/device-acceptance/launch?campaign=smoke-campaign`,
      { waitUntil: 'networkidle2', timeout: 45_000 }
    )
    await page.waitForSelector('[data-device-acceptance-launch]', { timeout: 20_000 })
    await page.waitForFunction(() => (
      window.__SOLAR_DEVICE_ACCEPTANCE_LAUNCH__?.mode === 'controller'
      && window.__SOLAR_DEVICE_ACCEPTANCE_LAUNCH__?.generatedLinkCount === 3
    ), { timeout: 20_000 })

    const cards = await page.$$eval('[data-launch-device]', (nodes) => nodes.map((node) => ({
      deviceClass: node.getAttribute('data-launch-device'),
      href: node.querySelector('a[data-testid^="launch-open-"]')?.getAttribute('href') ?? null,
    })))
    if (cards.length !== 3 || cards.some(({ href }) => !href)) {
      throw new Error(`Expected three complete device launch cards, received ${JSON.stringify(cards)}`)
    }

    const expectedProfiles = {
      'integrated-laptop': 'balanced',
      'discrete-desktop': 'ultra',
      'android-phone': 'eco',
    }
    for (const card of cards) {
      const url = new URL(card.href)
      if (url.pathname !== '/lab/device-acceptance/launch') {
        throw new Error(`Unexpected launch path for ${card.deviceClass}: ${url.pathname}`)
      }
      if (url.searchParams.get('campaign') !== 'smoke-campaign') {
        throw new Error(`Campaign was not retained for ${card.deviceClass}`)
      }
      if (url.searchParams.get('profile') !== expectedProfiles[card.deviceClass]) {
        throw new Error(`Unexpected profile for ${card.deviceClass}: ${url.searchParams.get('profile')}`)
      }
      if (url.searchParams.get('fresh') !== '1') {
        throw new Error(`Fresh-workspace protection was not enabled for ${card.deviceClass}`)
      }
    }

    await assertNoPageOverflow(page, 'desktop campaign launcher')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
    await delay(250)
    await assertNoPageOverflow(page, 'mobile campaign launcher')

    await page.evaluate((key) => {
      window.localStorage.setItem(key, JSON.stringify({
        deviceClass: 'other',
        deviceLabel: 'Previous device',
        manualChecks: {
          interactionResponsive: true,
          notes: 'Previous campaign evidence',
        },
        screenshots: [{ id: 'old-screenshot' }],
        sessions: [{ id: 'old-session' }],
      }))
    }, workspaceKey)

    const integratedUrl = cards.find(({ deviceClass }) => (
      deviceClass === 'integrated-laptop'
    ))?.href
    if (!integratedUrl) throw new Error('Integrated-laptop launch URL was missing.')

    await page.goto(integratedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    })
    await page.waitForFunction(() => (
      window.location.pathname === '/lab/device-acceptance'
    ), { timeout: 30_000 })

    const bootstrapState = await page.evaluate((keys) => {
      const read = (key) => {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      }
      return {
        pathname: window.location.pathname,
        search: window.location.search,
        workspace: read(keys.workspaceKey),
        backup: read(keys.backupKey),
        campaign: read(keys.campaignKey),
        preset: window.localStorage.getItem(keys.presetKey),
      }
    }, { workspaceKey, backupKey, campaignKey, presetKey })

    if (bootstrapState.pathname !== '/lab/device-acceptance') {
      throw new Error(`Bootstrap did not reach the capture lab: ${bootstrapState.pathname}`)
    }
    if (bootstrapState.workspace?.deviceClass !== 'integrated-laptop') {
      throw new Error(`Workspace device class was not initialized: ${JSON.stringify(bootstrapState.workspace)}`)
    }
    if (bootstrapState.workspace?.sessions?.length !== 0 || bootstrapState.workspace?.screenshots?.length !== 0) {
      throw new Error('Fresh campaign workspace retained previous evidence.')
    }
    if (bootstrapState.backup?.workspace?.sessions?.length !== 1) {
      throw new Error('Previous local evidence was not backed up before campaign reset.')
    }
    if (bootstrapState.campaign?.campaignId !== 'smoke-campaign') {
      throw new Error(`Campaign metadata was not stored: ${JSON.stringify(bootstrapState.campaign)}`)
    }
    if (bootstrapState.preset !== 'balanced') {
      throw new Error(`Integrated-laptop bootstrap did not select Balanced: ${bootstrapState.preset}`)
    }
    if (!bootstrapState.search.includes('campaign=smoke-campaign')) {
      throw new Error(`Capture route did not retain campaign context: ${bootstrapState.search}`)
    }

    if (pageErrors.length > 0) {
      throw new Error(`Campaign launcher page errors:\n${pageErrors.join('\n')}`)
    }

    console.log('[device-acceptance-launch-smoke] three links, responsive layout, device bootstrap, preset selection, and evidence backup passed')
    await page.close()
  } catch (error) {
    console.error('[device-acceptance-launch-smoke] failed')
    if (serverOutput.trim()) console.error(serverOutput.trim())
    throw error
  } finally {
    if (browser) await browser.close()
    server.kill('SIGTERM')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
