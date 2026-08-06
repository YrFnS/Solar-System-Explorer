import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.DEVICE_ACCEPTANCE_REVIEW_PORT || 3138)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const storageKey = 'solar-explorer-device-acceptance-review-v1'
const commitSha = '0123456789abcdef0123456789abcdef01234567'
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

function targetFps(quality) {
  if (quality === 'eco') return 30
  if (quality === 'balanced') return 45
  return 60
}

function device(deviceClass, label) {
  const phone = deviceClass === 'android-phone'
  return {
    id: `browser-${deviceClass}`,
    label,
    deviceClass,
    capturedAt: '2026-08-06T08:00:00.000Z',
    userAgent: 'review-smoke',
    platform: phone ? 'Android' : 'Linux x86_64',
    language: 'en',
    viewport: {
      width: phone ? 390 : 1440,
      height: phone ? 844 : 900,
      devicePixelRatio: phone ? 2.75 : 1,
      orientation: phone ? 'portrait-primary' : 'landscape-primary',
    },
    screen: { width: phone ? 390 : 1440, height: phone ? 844 : 900, colorDepth: 24 },
    capabilityHints: {
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      maxTouchPoints: phone ? 5 : 0,
      coarsePointer: phone,
      saveData: false,
      effectiveConnectionType: '4g',
      standalone: false,
      batteryApi: true,
      webgpuApi: true,
    },
    graphics: {
      api: 'webgl2',
      vendor: 'Smoke GPU Vendor',
      renderer: `${label} WebGL renderer`,
      version: 'WebGL 2.0',
      shadingLanguageVersion: 'WebGL GLSL ES 3.00',
    },
  }
}

function sample(quality, elapsedMs, fps, index) {
  const frames = 120 + index
  return {
    capturedAt: new Date(Date.parse('2026-08-06T08:00:00.000Z') + elapsedMs).toISOString(),
    elapsedMs,
    quality,
    visibility: 'visible',
    orientation: 'landscape-primary',
    viewport: { width: 1440, height: 900, devicePixelRatio: 1 },
    battery: {
      level: 0.9 - index * 0.002,
      charging: false,
      chargingTimeSeconds: null,
      dischargingTimeSeconds: 18_000,
    },
    usedJsHeapBytes: 90 * 1024 * 1024 + index * 64 * 1024,
    diagnostics: {
      explorer: { drawCalls: 206, geometries: 169, textures: 15 },
      framePacing: {
        actualFps: fps,
        targetFps: targetFps(quality),
        p95FrameIntervalMs: 1_000 / fps * 1.2,
      },
      frameLanes: {
        maxDispatchMs: 3.2,
        renderFrames: frames,
        sharedClockReads: frames,
        lanes: {
          critical: { maxMs: 0.4 },
          ephemeris: { maxMs: 2.1 },
          decorative: { maxMs: 0.7 },
        },
      },
      sceneLoading: { complete: true, stage: 6 },
      performancePolicy: { effectiveQuality: quality },
      textures: { loadedIds: 13, failedIds: 0 },
      textureLifecycle: { residentTextures: 15 },
      adaptiveLod: { periodicSceneWalks: 0 },
      simulationTiming: { paused: false },
      smallBodies: { overviewBodies: 17 },
    },
  }
}

function events(startedAt, targetMs) {
  return [
    { type: 'capture-started', capturedAt: startedAt, elapsedMs: 0 },
    { type: 'sleep-marker', capturedAt: startedAt, elapsedMs: 1_000 },
    { type: 'visibility-hidden', capturedAt: startedAt, elapsedMs: 2_000 },
    { type: 'visibility-visible', capturedAt: startedAt, elapsedMs: 3_000 },
    { type: 'context-test-requested', capturedAt: startedAt, elapsedMs: 4_000 },
    { type: 'context-lost', capturedAt: startedAt, elapsedMs: 4_100 },
    { type: 'context-restored', capturedAt: startedAt, elapsedMs: 5_700 },
    { type: 'capture-completed', capturedAt: startedAt, elapsedMs: targetMs },
  ]
}

function session(profile, scenario, quality, fps) {
  const targetDurationSeconds = scenario === 'thermal' ? 600 : 60
  const targetMs = targetDurationSeconds * 1_000
  const samples = [
    sample(quality, 0, fps, 0),
    sample(quality, targetMs / 2, fps, 1),
    sample(quality, targetMs, fps, 2),
  ]
  const startedAt = samples[0].capturedAt
  return {
    id: `browser-${profile.deviceClass}-${scenario}-${quality}`,
    schema: 'solar-system-explorer-device-acceptance',
    schemaVersion: 1,
    scenario,
    completion: 'completed',
    targetDurationSeconds,
    quality,
    startedAt,
    endedAt: samples.at(-1).capturedAt,
    device: profile,
    samples,
    events: events(startedAt, targetMs),
    summary: {},
  }
}

function screenshot(deviceClass, quality, orientation) {
  return {
    id: `${deviceClass}-${quality}-${orientation}`,
    fileName: `${deviceClass}-${quality}-${orientation}.webp`,
    capturedAt: '2026-08-06T08:10:00.000Z',
    quality,
    orientation,
    width: 1280,
    height: 720,
  }
}

function bundle(deviceClass, quality, fps) {
  const profile = device(deviceClass, `Smoke ${deviceClass}`)
  const phone = deviceClass === 'android-phone'
  return {
    schema: 'solar-system-explorer-device-acceptance',
    schemaVersion: 1,
    generatedAt: '2026-08-06T08:20:00.000Z',
    source: { route: '/lab/device-acceptance', commitSha },
    device: profile,
    manualChecks: {
      interactionResponsive: true,
      visualParityEco: true,
      visualParityBalanced: true,
      visualParityUltra: true,
      portraitApproved: true,
      landscapeApproved: true,
      sleepResumeApproved: true,
      contextRecoveryApproved: true,
      thermalApproved: true,
      notes: 'Smoke device approved.',
    },
    screenshots: [
      screenshot(deviceClass, 'eco', phone ? 'portrait-primary' : 'landscape-primary'),
      screenshot(deviceClass, 'balanced', 'landscape-primary'),
      screenshot(deviceClass, 'ultra', 'landscape-primary'),
    ],
    sessions: [
      session(profile, 'profile', quality, fps),
      session(profile, 'thermal', quality, fps),
    ],
  }
}

const fixtures = [
  bundle('integrated-laptop', 'balanced', 42),
  bundle('discrete-desktop', 'ultra', 58),
  bundle('android-phone', 'eco', 28),
]

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
    await page.evaluateOnNewDocument((key, value) => {
      window.localStorage.setItem(key, JSON.stringify(value))
    }, storageKey, fixtures)

    await page.goto(`${baseUrl}/lab/device-acceptance/results`, {
      waitUntil: 'networkidle2',
      timeout: 75_000,
    })
    await page.waitForSelector('[data-device-acceptance-review]', { timeout: 30_000 })
    await page.waitForFunction(() => (
      window.__SOLAR_DEVICE_ACCEPTANCE_REVIEW__?.verdict === 'ready'
      && window.__SOLAR_DEVICE_ACCEPTANCE_REVIEW__?.readyDeviceCount === 3
      && window.__SOLAR_DEVICE_ACCEPTANCE_REVIEW__?.bundleCount === 3
    ), { timeout: 30_000 })

    const state = await page.evaluate(() => window.__SOLAR_DEVICE_ACCEPTANCE_REVIEW__)
    const deviceCards = await page.$$eval('[data-device-review]', (nodes) => (
      nodes.map((node) => ({
        device: node.getAttribute('data-device-review'),
        verdict: node.getAttribute('data-device-verdict'),
      }))
    ))
    if (deviceCards.length !== 3 || deviceCards.some(({ verdict }) => verdict !== 'ready')) {
      throw new Error(`Expected three ready device cards, received ${JSON.stringify(deviceCards)}`)
    }
    const jsonEnabled = await page.$eval(
      '[data-testid="review-export-json"]',
      (element) => !(element).disabled
    )
    const markdownEnabled = await page.$eval(
      '[data-testid="review-export-markdown"]',
      (element) => !(element).disabled
    )
    if (!jsonEnabled || !markdownEnabled) {
      throw new Error('Review exports were not enabled for a complete matrix.')
    }
    await assertNoPageOverflow(page, 'desktop review')

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
    await delay(250)
    await assertNoPageOverflow(page, 'mobile review')

    if (pageErrors.length > 0) {
      throw new Error(`Review page errors:\n${pageErrors.join('\n')}`)
    }

    console.log(`[device-acceptance-review-smoke] ${JSON.stringify(state)}`)
    console.log('[device-acceptance-review-smoke] three-device ready matrix, responsive layout, diagnostics, and exports passed')
    await page.close()
  } catch (error) {
    console.error('[device-acceptance-review-smoke] failed')
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
