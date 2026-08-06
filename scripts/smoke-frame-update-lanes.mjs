import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.FRAME_LANES_SMOKE_PORT || 3135)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
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

function collectPageErrors(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function configurePage(page) {
  await page.setViewport({
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  })

  await page.evaluateOnNewDocument(() => {
    window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
    window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
    window.localStorage.setItem('solar-explorer-quality-preset-v1', 'eco')
    window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'false')
    window.localStorage.setItem('solar-explorer-reduced-motion-v1', 'false')
  })
}

async function waitForReady(page) {
  await page.goto(`${baseUrl}/?diagnostics=1&textures=webp`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  await page.waitForSelector('canvas', { timeout: 45_000 })
  await page.waitForSelector('[aria-label="Search celestial bodies"]', {
    timeout: 45_000,
  })
  await page.waitForFunction(() => {
    const lanes = window.__SOLAR_FRAME_LANES__
    const loading = window.__SOLAR_SCENE_LOADING__
    return Boolean(
      lanes
      && lanes.dispatcherCallbacks === 1
      && lanes.registeredCallbacks >= 20
      && lanes.lanes.critical.labels.includes('camera-controller')
      && lanes.lanes.ephemeris.labels.includes('planet:earth')
      && lanes.lanes.ephemeris.labels.includes('small-body-overview')
      && lanes.lanes.ephemeris.labels.includes('human-artifacts')
      && lanes.lanes.decorative.labels.includes('star-field')
      && lanes.lanes.decorative.labels.includes('sun-corona')
      && loading?.complete
    )
  }, { timeout: 75_000 })
}

async function readLanes(page) {
  const diagnostics = await page.evaluate(() => window.__SOLAR_FRAME_LANES__)
  if (!diagnostics) throw new Error('Frame-lane diagnostics were unavailable')
  return diagnostics
}

function assertInitialContract(diagnostics) {
  const failures = []
  const registeredSum = diagnostics.lanes.critical.registered
    + diagnostics.lanes.ephemeris.registered
    + diagnostics.lanes.decorative.registered
  const enabledSum = diagnostics.lanes.critical.enabled
    + diagnostics.lanes.ephemeris.enabled
    + diagnostics.lanes.decorative.enabled

  if (diagnostics.dispatcherCallbacks !== 1) {
    failures.push(`dispatcherCallbacks=${diagnostics.dispatcherCallbacks}; expected 1`)
  }
  if (registeredSum !== diagnostics.registeredCallbacks) {
    failures.push(
      `registered callback sum ${registeredSum} did not match ${diagnostics.registeredCallbacks}`
    )
  }
  if (enabledSum !== diagnostics.enabledCallbacks) {
    failures.push(
      `enabled callback sum ${enabledSum} did not match ${diagnostics.enabledCallbacks}`
    )
  }
  if (diagnostics.decorativeTargetHz !== 10) {
    failures.push(
      `Eco decorative target was ${diagnostics.decorativeTargetHz}Hz; expected 10Hz`
    )
  }
  if (diagnostics.sharedClockReads !== diagnostics.renderFrames) {
    failures.push(
      `shared clock reads ${diagnostics.sharedClockReads} differed from rendered frames ${diagnostics.renderFrames}`
    )
  }
  if (!diagnostics.lanes.ephemeris.labels.includes('human-artifacts')) {
    failures.push('Human artifacts were not centralized in the ephemeris lane')
  }
  if (!diagnostics.lanes.decorative.labels.includes('sun-corona')) {
    failures.push('Sun corona was not centralized in the decorative lane')
  }

  if (failures.length > 0) {
    throw new Error(`Initial frame-lane contract failed:\n${failures.join('\n')}`)
  }
}

async function assertPausedLaneBehavior(page) {
  await page.keyboard.press('Space')
  await page.waitForFunction(() => (
    window.__SOLAR_SIMULATION_TIMING__?.paused === true
    && window.__SOLAR_FRAME_PACING__?.mode === 'static'
  ), { timeout: 15_000 })

  await delay(700)
  const before = await readLanes(page)
  const durationMs = 2_600
  await delay(durationMs)
  const after = await readLanes(page)

  const renderDelta = after.renderFrames - before.renderFrames
  const clockDelta = after.sharedClockReads - before.sharedClockReads
  const criticalDelta = after.lanes.critical.ticks - before.lanes.critical.ticks
  const ephemerisDelta = after.lanes.ephemeris.ticks - before.lanes.ephemeris.ticks
  const dateChangeDelta = after.ephemerisDateChanges - before.ephemerisDateChanges
  const decorativeDelta = after.lanes.decorative.ticks - before.lanes.decorative.ticks

  if (renderDelta <= 0 || renderDelta > 10) {
    throw new Error(
      `Paused static sample rendered ${renderDelta} frame(s) in ${durationMs}ms`
    )
  }
  if (clockDelta !== renderDelta || criticalDelta !== renderDelta) {
    throw new Error(
      `Paused shared dispatch diverged render=${renderDelta} clock=${clockDelta} critical=${criticalDelta}`
    )
  }
  if (ephemerisDelta > 1 || dateChangeDelta !== 0) {
    throw new Error(
      `Paused ephemeris lane kept running ticks=${ephemerisDelta} dateChanges=${dateChangeDelta}`
    )
  }
  if (decorativeDelta > 8) {
    throw new Error(
      `Paused decorative lane ran ${decorativeDelta} times in ${durationMs}ms`
    )
  }

  console.log(
    `[frame-lanes-smoke] paused ${durationMs}ms render=${renderDelta} ephemeris=${ephemerisDelta} decorative=${decorativeDelta}`
  )
  return after
}

async function assertResumedEphemeris(page, pausedSnapshot) {
  await page.keyboard.press('Space')
  await page.waitForFunction(() => (
    window.__SOLAR_SIMULATION_TIMING__?.paused === false
    && window.__SOLAR_FRAME_PACING__?.mode !== 'static'
  ), { timeout: 15_000 })

  await page.waitForFunction((ticks, dateChanges, simulationDateMs) => {
    const lanes = window.__SOLAR_FRAME_LANES__
    return Boolean(
      lanes
      && lanes.lanes.ephemeris.ticks >= ticks + 2
      && lanes.ephemerisDateChanges > dateChanges
      && lanes.lastSimulationDateMs !== simulationDateMs
    )
  }, { timeout: 20_000 },
  pausedSnapshot.lanes.ephemeris.ticks,
  pausedSnapshot.ephemerisDateChanges,
  pausedSnapshot.lastSimulationDateMs)

  const after = await readLanes(page)
  console.log(
    `[frame-lanes-smoke] resumed ephemeris ticks=${after.lanes.ephemeris.ticks - pausedSnapshot.lanes.ephemeris.ticks}`
  )
  return after
}

async function assertCameraInvalidation(page) {
  const before = await readLanes(page)
  const canvas = await page.$('canvas')
  if (!canvas) throw new Error('Canvas was unavailable for camera interaction')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds were unavailable')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel({ deltaY: -620 })

  await page.waitForFunction((cameraInvalidations, decorativeTicks) => {
    const lanes = window.__SOLAR_FRAME_LANES__
    return Boolean(
      lanes
      && lanes.cameraInvalidations > cameraInvalidations
      && lanes.lanes.decorative.ticks > decorativeTicks
    )
  }, { timeout: 20_000 },
  before.cameraInvalidations,
  before.lanes.decorative.ticks)

  const after = await readLanes(page)
  console.log(
    `[frame-lanes-smoke] camera invalidations ${before.cameraInvalidations} → ${after.cameraInvalidations}`
  )
  return after
}

async function selectBodyThroughSearch(page, query) {
  await page.click('[aria-label="Search celestial bodies"]')
  const input = await page.waitForSelector(
    'input[placeholder*="Search planets"]',
    { timeout: 15_000 }
  )
  await input.type(query)
  await page.keyboard.press('Enter')
}

async function assertSelectedBodyPromotion(page) {
  const before = await readLanes(page)
  if (!before.lanes.ephemeris.labels.includes('planet:mars')) {
    throw new Error('Mars did not begin in the ephemeris lane')
  }

  await selectBodyThroughSearch(page, 'Mars')
  await page.waitForFunction(() => {
    const lanes = window.__SOLAR_FRAME_LANES__
    return Boolean(
      lanes
      && lanes.lanes.critical.labels.includes('planet:mars')
      && !lanes.lanes.ephemeris.labels.includes('planet:mars')
      && lanes.lanes.critical.labels.includes('label:mars')
    )
  }, { timeout: 20_000 })

  const after = await readLanes(page)
  console.log(
    `[frame-lanes-smoke] Mars promoted ephemeris → critical; critical callbacks=${after.criticalCallbacks}`
  )
  return after
}

function assertTimingBounds(diagnostics) {
  if (
    diagnostics.averageDispatchMs <= 0
    || diagnostics.averageDispatchMs > 25
  ) {
    throw new Error(
      `Average lane dispatch ${diagnostics.averageDispatchMs.toFixed(2)}ms was outside 0-25ms`
    )
  }
  if (diagnostics.maxDispatchMs > 140) {
    throw new Error(
      `Maximum lane dispatch ${diagnostics.maxDispatchMs.toFixed(2)}ms exceeded 140ms`
    )
  }
  if (diagnostics.sharedClockReads !== diagnostics.renderFrames) {
    throw new Error(
      `Final shared clock reads ${diagnostics.sharedClockReads} differed from render frames ${diagnostics.renderFrames}`
    )
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
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString()
  })
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString()
  })

  let browser
  try {
    await waitForServer(server)
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu-sandbox',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--window-size=1280,720',
      ],
    })

    const page = await browser.newPage()
    await configurePage(page)
    const pageErrors = collectPageErrors(page)
    await waitForReady(page)

    const initial = await readLanes(page)
    assertInitialContract(initial)
    const paused = await assertPausedLaneBehavior(page)
    await assertResumedEphemeris(page, paused)
    await assertCameraInvalidation(page)
    const selected = await assertSelectedBodyPromotion(page)
    assertTimingBounds(selected)

    if (pageErrors.length > 0) {
      throw new Error(`Frame-lane page errors:\n${pageErrors.join('\n')}`)
    }

    console.log(`[frame-lanes-smoke] final ${JSON.stringify(selected)}`)
    console.log(
      '[frame-lanes-smoke] one dispatcher, shared clock, paused ephemeris stop, decorative cap, camera invalidation, selected promotion, and CPU bounds passed'
    )

    await page.close()
  } catch (error) {
    console.error('[frame-lanes-smoke] failed')
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
