import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.FRAME_PACING_SMOKE_PORT || 3131)
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

async function configurePage(page, preset = 'eco') {
  await page.setViewport({
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  })

  await page.evaluateOnNewDocument((initialPreset) => {
    window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
    window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
    window.localStorage.setItem('solar-explorer-quality-preset-v1', initialPreset)
    window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'false')
    window.localStorage.setItem('solar-explorer-reduced-motion-v1', 'false')

    window.__SOLAR_CONTEXT_REQUESTS__ = []
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, options) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        window.__SOLAR_CONTEXT_REQUESTS__.push({
          type,
          powerPreference: options?.powerPreference ?? null,
          at: Date.now(),
        })
      }
      return originalGetContext.call(this, type, options)
    }
  }, preset)
}

async function waitForCore(page) {
  await page.goto(`${baseUrl}/?diagnostics=1&textures=webp`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  await page.waitForSelector('canvas', { timeout: 45_000 })
  await page.waitForFunction(() => {
    const pacing = window.__SOLAR_FRAME_PACING__
    const timing = window.__SOLAR_SIMULATION_TIMING__
    return Boolean(
      pacing
      && pacing.renderedFrames >= 8
      && timing
      && timing.renderFrames >= 8
    )
  }, { timeout: 45_000 })
}

async function readPacing(page) {
  const diagnostics = await page.evaluate(() => window.__SOLAR_FRAME_PACING__)
  if (!diagnostics) throw new Error('Frame pacing diagnostics were unavailable')
  return diagnostics
}

async function readTiming(page) {
  const diagnostics = await page.evaluate(() => window.__SOLAR_SIMULATION_TIMING__)
  if (!diagnostics) throw new Error('Simulation timing diagnostics were unavailable')
  return diagnostics
}

async function waitForPacing(page, quality, mode, targetFps, timeout = 75_000) {
  await page.waitForFunction((expectedQuality, expectedMode, expectedTarget) => {
    const pacing = window.__SOLAR_FRAME_PACING__
    return pacing?.quality === expectedQuality
      && pacing.mode === expectedMode
      && pacing.targetFps === expectedTarget
  }, { timeout }, quality, mode, targetFps)
  return readPacing(page)
}

async function assertContextPreference(page, expectedPreference) {
  await page.waitForFunction((expected) => {
    const requests = window.__SOLAR_CONTEXT_REQUESTS__ ?? []
    return requests.some((request) => request.powerPreference === expected)
  }, { timeout: 20_000 }, expectedPreference)

  const requests = await page.evaluate(() => window.__SOLAR_CONTEXT_REQUESTS__ ?? [])
  const lastRequested = [...requests]
    .reverse()
    .find((request) => request.powerPreference)

  if (lastRequested?.powerPreference !== expectedPreference) {
    throw new Error(
      `Expected latest WebGL power preference ${expectedPreference}, received ${JSON.stringify(lastRequested)}`
    )
  }
}

async function assertCadence(page, quality, mode, targetFps, durationMs = 1_800) {
  await waitForPacing(page, quality, mode, targetFps)
  const before = await readPacing(page)
  await delay(durationMs)
  const after = await readPacing(page)
  const elapsedSeconds = durationMs / 1_000
  const rendered = after.renderedFrames - before.renderedFrames
  const measuredFps = rendered / elapsedSeconds
  const maximumFrames = Math.ceil(targetFps * elapsedSeconds * 1.3) + 3

  if (rendered <= 0) {
    throw new Error(`${quality}/${mode} did not render during the cadence sample`)
  }
  if (rendered > maximumFrames) {
    throw new Error(
      `${quality}/${mode} rendered ${rendered} frames in ${durationMs}ms; cap ${targetFps} allowed at most ${maximumFrames}`
    )
  }
  if (
    after.actualFps !== null
    && after.actualFps > targetFps + Math.max(4, targetFps * 0.18)
  ) {
    throw new Error(
      `${quality}/${mode} diagnostic FPS ${after.actualFps.toFixed(2)} exceeded target ${targetFps}`
    )
  }

  console.log(
    `[frame-pacing-smoke] ${quality}/${mode} target=${targetFps} sampled=${measuredFps.toFixed(1)} diagnostic=${after.actualFps?.toFixed(1) ?? 'n/a'}`
  )
  return { before, after, measuredFps }
}

async function assertSimulationRate(page, label, durationMs = 2_000) {
  const beforeTiming = await readTiming(page)
  const startedAt = performance.now()
  await delay(durationMs)
  const endedAt = performance.now()
  const afterTiming = await readTiming(page)

  const wallDelta = afterTiming.activeWallSeconds - beforeTiming.activeWallSeconds
  const simulatedDelta = afterTiming.simulatedMinutes - beforeTiming.simulatedMinutes
  const expectedRate = Math.abs(afterTiming.timeSpeed)
  const internalRate = wallDelta > 0 ? Math.abs(simulatedDelta / wallDelta) : 0
  const realSeconds = (endedAt - startedAt) / 1_000
  const realRate = realSeconds > 0 ? Math.abs(simulatedDelta / realSeconds) : 0
  const internalError = expectedRate > 0
    ? Math.abs(internalRate - expectedRate) / expectedRate
    : Number.POSITIVE_INFINITY
  const realError = expectedRate > 0
    ? Math.abs(realRate - expectedRate) / expectedRate
    : Number.POSITIVE_INFINITY

  if (expectedRate <= 0 || wallDelta < 0.5) {
    throw new Error(
      `${label} simulation sample was not running: ${JSON.stringify({ beforeTiming, afterTiming })}`
    )
  }
  if (internalError > 0.04) {
    throw new Error(
      `${label} internal simulation rate ${internalRate.toFixed(3)} differed from ${expectedRate} by ${(internalError * 100).toFixed(1)}%`
    )
  }
  if (realError > 0.28) {
    throw new Error(
      `${label} real-time simulation rate ${realRate.toFixed(3)} differed from ${expectedRate} by ${(realError * 100).toFixed(1)}%`
    )
  }

  console.log(
    `[frame-pacing-smoke] ${label} simulation rate internal=${internalRate.toFixed(2)} real=${realRate.toFixed(2)} expected=${expectedRate}`
  )
  return { internalRate, realRate, expectedRate }
}

async function requestActivity(page, durationMs = 3_000) {
  await page.evaluate((duration) => {
    window.dispatchEvent(new CustomEvent('solar-explorer:frame-activity', {
      detail: { reason: 'browser-smoke', durationMs: duration },
    }))
  }, durationMs)
}

async function selectPreset(page, label) {
  const dock = await page.waitForSelector(
    '[aria-label="Open rendering quality controls"]',
    { timeout: 15_000 }
  )
  const expanded = await dock.evaluate((element) => element.getAttribute('aria-expanded'))
  if (expanded !== 'true') await dock.click()

  const clicked = await page.evaluate((expected) => {
    const button = [...document.querySelectorAll('button')].find((candidate) => {
      const text = candidate.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      return text.startsWith(expected)
        && text.includes(expected === 'Ultra' ? '60 FPS' : expected === 'Balanced' ? '30–45 FPS' : expected)
    })
    if (!(button instanceof HTMLButtonElement)) return false
    button.click()
    return true
  }, label)

  if (!clicked) throw new Error(`Could not select ${label} quality preset`)
}

async function assertVisibilitySuspension(browser, page) {
  const before = await readPacing(page)
  let lifecycleSession = null
  let coverPage = null

  try {
    coverPage = await browser.newPage()
    await coverPage.goto('about:blank')
    await coverPage.bringToFront()
    await delay(500)

    const hiddenByBackgrounding = await page.evaluate(() => document.hidden)
    if (hiddenByBackgrounding) {
      await delay(1_200)
      await page.bringToFront()
      await page.waitForFunction(() => !document.hidden, { timeout: 10_000 })
    } else {
      await coverPage.close()
      coverPage = null
      lifecycleSession = await page.createCDPSession()
      await lifecycleSession.send('Page.setWebLifecycleState', { state: 'frozen' })
      await delay(1_200)
      await lifecycleSession.send('Page.setWebLifecycleState', { state: 'active' })
      await page.bringToFront()
    }

    await page.waitForFunction((previousSuspensions) => (
      (window.__SOLAR_FRAME_PACING__?.suspensions ?? 0) > previousSuspensions
    ), { timeout: 15_000 }, before.suspensions)

    const after = await readPacing(page)
    const hiddenFrames = after.renderedWhileHidden - before.renderedWhileHidden
    if (hiddenFrames > 1) {
      throw new Error(`Renderer advanced ${hiddenFrames} times while the page was hidden`)
    }

    console.log(
      `[frame-pacing-smoke] hidden lifecycle suspended with ${hiddenFrames} hidden frame(s)`
    )
  } finally {
    if (coverPage && !coverPage.isClosed()) await coverPage.close()
    if (lifecycleSession) await lifecycleSession.detach()
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
    await configurePage(page, 'eco')
    const pageErrors = collectPageErrors(page)
    await waitForCore(page)
    await assertContextPreference(page, 'low-power')

    await page.waitForFunction(() => window.__SOLAR_SCENE_LOADING__?.complete === true, {
      timeout: 75_000,
    })
    await waitForPacing(page, 'eco', 'idle', 24, 20_000)
    await assertCadence(page, 'eco', 'idle', 24)
    const ecoRate = await assertSimulationRate(page, 'Eco idle')

    await requestActivity(page)
    await assertCadence(page, 'eco', 'active', 30, 1_500)

    await page.keyboard.press('Space')
    await page.waitForFunction(() => window.__SOLAR_SIMULATION_TIMING__?.paused === true)
    await waitForPacing(page, 'eco', 'static', 2, 10_000)
    await assertCadence(page, 'eco', 'static', 2, 2_200)

    await page.keyboard.press('Space')
    await page.waitForFunction(() => window.__SOLAR_SIMULATION_TIMING__?.paused === false)
    await assertVisibilitySuspension(browser, page)

    await selectPreset(page, 'Ultra')
    await waitForPacing(page, 'ultra', 'active', 60, 30_000)
    await assertContextPreference(page, 'high-performance')
    await requestActivity(page)
    await assertCadence(page, 'ultra', 'active', 60, 1_500)
    const ultraRate = await assertSimulationRate(page, 'Ultra active')

    const rateDifference = Math.abs(
      ecoRate.internalRate - ultraRate.internalRate
    ) / Math.max(1, ecoRate.expectedRate)
    if (rateDifference > 0.05) {
      throw new Error(
        `Simulation rate changed across paced profiles by ${(rateDifference * 100).toFixed(1)}%`
      )
    }

    await selectPreset(page, 'Balanced')
    await waitForPacing(page, 'balanced', 'active', 45, 30_000)
    await assertContextPreference(page, 'low-power')
    await requestActivity(page)
    await assertCadence(page, 'balanced', 'active', 45, 1_500)

    if (pageErrors.length > 0) {
      throw new Error(`Frame pacing page errors:\n${pageErrors.join('\n')}`)
    }

    const finalPacing = await readPacing(page)
    console.log(`[frame-pacing-smoke] final diagnostics ${JSON.stringify(finalPacing)}`)
    console.log('[frame-pacing-smoke] Eco, Balanced, Ultra, static rest, visibility suspension, power hints, and wall-time simulation passed')

    await page.close()
  } catch (error) {
    console.error('[frame-pacing-smoke] failed')
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
