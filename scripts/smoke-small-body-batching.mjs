import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.SMALL_BODY_SMOKE_PORT || 3127)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const P0_ECO_BASELINE = {
  drawCalls: 208,
  sceneObjects: 373,
  geometries: 186,
}

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
  })
}

async function waitForSmallBodyOverview(page) {
  await page.goto(`${baseUrl}/?diagnostics=1&textures=webp`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  await page.waitForSelector('canvas', { timeout: 45_000 })
  await page.waitForSelector('[aria-label="Search celestial bodies"]', {
    timeout: 45_000,
  })
  await page.waitForFunction(() => {
    const loading = window.__SOLAR_SCENE_LOADING__
    const runtime = window.__SOLAR_SMALL_BODY_RUNTIME__
    return Boolean(
      loading
      && loading.stage >= 3
      && runtime
      && runtime.frameSamples >= 8
      && runtime.totalBodies >= 15
    )
  }, { timeout: 45_000 })
}

async function waitForCompleteScene(page) {
  await page.waitForFunction(() => {
    const loading = window.__SOLAR_SCENE_LOADING__
    return Boolean(
      loading?.complete
      && loading.stage === 6
      && loading.waitingFor === 'complete'
    )
  }, { timeout: 60_000 })
}

async function readRuntime(page) {
  const runtime = await page.evaluate(() => window.__SOLAR_SMALL_BODY_RUNTIME__)
  if (!runtime) throw new Error('Small-body runtime diagnostics were unavailable')
  return runtime
}

async function waitForFreshRenderer(page, previousTimestamp = 0) {
  await page.waitForFunction((timestamp) => {
    const diagnostics = window.__SOLAR_EXPLORER_DIAGNOSTICS__
    return Boolean(diagnostics?.timestamp && diagnostics.timestamp > timestamp)
  }, { timeout: 20_000 }, previousTimestamp)

  const diagnostics = await page.evaluate(() => window.__SOLAR_EXPLORER_DIAGNOSTICS__)
  if (!diagnostics) throw new Error('Renderer diagnostics were unavailable')
  return diagnostics
}

async function waitForSettledRenderer(page, previousTimestamp = 0) {
  let timestamp = previousTimestamp
  let previous = null
  let stableTransitions = 0
  const samples = []

  for (let attempt = 0; attempt < 9; attempt += 1) {
    const sample = await waitForFreshRenderer(page, timestamp)
    timestamp = sample.timestamp
    samples.push(sample)

    const lazySceneReady = sample.drawCalls >= 100
      && sample.sceneObjects >= 190
      && sample.geometries >= 90
    const stable = previous
      && Math.abs(sample.drawCalls - previous.drawCalls) <= 5
      && Math.abs(sample.sceneObjects - previous.sceneObjects) <= 4
      && Math.abs(sample.geometries - previous.geometries) <= 4

    stableTransitions = lazySceneReady && stable ? stableTransitions + 1 : 0
    if (stableTransitions >= 2) return sample
    previous = sample
  }

  throw new Error(
    `Renderer counters did not settle after lazy scene admission: ${JSON.stringify(samples)}`
  )
}

function assertOverviewBatching(runtime, renderer) {
  const failures = []
  const overviewBodies = runtime.instancedBodies + runtime.texturedOverviewBodies

  if (runtime.totalBodies < 15) {
    failures.push(`totalBodies=${runtime.totalBodies}; expected the complete Eco catalogue`)
  }
  if (runtime.detailedBodies !== 0 || overviewBodies !== runtime.totalBodies) {
    failures.push(
      `overview promotion mismatch instanced=${runtime.instancedBodies} textured=${runtime.texturedOverviewBodies} detailed=${runtime.detailedBodies} total=${runtime.totalBodies}`
    )
  }
  if (runtime.texturedOverviewBodies < 1) {
    failures.push('authored Pluto texture was not retained in the lightweight overview')
  }
  if (runtime.overviewFrameManagers !== 1) {
    failures.push(`overviewFrameManagers=${runtime.overviewFrameManagers}; expected exactly 1`)
  }
  if (runtime.bodyBatchDraws > 4 || runtime.bodyBatchDraws < 3) {
    failures.push(`bodyBatchDraws=${runtime.bodyBatchDraws}; expected 3-4 bounded overview draws`)
  }
  if (runtime.orbitBatchDraws !== 1 || runtime.individualOrbitPaths !== 0) {
    failures.push(
      `orbit draws batch=${runtime.orbitBatchDraws} individual=${runtime.individualOrbitPaths}`
    )
  }
  if (runtime.batchedOrbitPaths !== runtime.totalBodies) {
    failures.push(
      `batchedOrbitPaths=${runtime.batchedOrbitPaths}; expected ${runtime.totalBodies}`
    )
  }
  if (runtime.positionEvaluationsPerFrame !== overviewBodies) {
    failures.push(
      `position evaluations=${runtime.positionEvaluationsPerFrame}; expected ${overviewBodies}`
    )
  }
  if (runtime.matrixWritesPerFrame !== overviewBodies * 2) {
    failures.push(
      `matrix writes=${runtime.matrixWritesPerFrame}; expected ${overviewBodies * 2}`
    )
  }
  if (!Number.isFinite(runtime.averageUpdateMs) || runtime.averageUpdateMs <= 0) {
    failures.push(`invalid average update time=${runtime.averageUpdateMs}`)
  }
  if (runtime.averageUpdateMs > 12) {
    failures.push(`average centralized update=${runtime.averageUpdateMs.toFixed(2)}ms exceeds 12ms`)
  }

  if (renderer.drawCalls >= P0_ECO_BASELINE.drawCalls - 12) {
    failures.push(
      `draw-call reduction was too small: ${renderer.drawCalls} versus P0 ${P0_ECO_BASELINE.drawCalls}`
    )
  }
  if (renderer.sceneObjects >= P0_ECO_BASELINE.sceneObjects - 24) {
    failures.push(
      `scene-object reduction was too small: ${renderer.sceneObjects} versus P0 ${P0_ECO_BASELINE.sceneObjects}`
    )
  }
  if (renderer.geometries >= P0_ECO_BASELINE.geometries - 8) {
    failures.push(
      `geometry reduction was too small: ${renderer.geometries} versus P0 ${P0_ECO_BASELINE.geometries}`
    )
  }

  if (failures.length > 0) {
    throw new Error(`Small-body overview batching failed:\n${failures.join('\n')}`)
  }
}

async function selectBodyThroughSearch(page, query) {
  await page.click('[aria-label="Search celestial bodies"]')
  const input = await page.waitForSelector(
    'input[placeholder*="Search planets"]',
    { timeout: 15_000 }
  )
  await input.type(query)
  await page.keyboard.press('Enter')
  await page.waitForFunction((expected) => (
    window.__SOLAR_SMALL_BODY_RUNTIME__?.selectedBody === expected
  ), { timeout: 20_000 }, query.toLowerCase())
}

function assertSelectedDetail(runtime, overviewRuntime, renderer, overviewRenderer) {
  const failures = []
  const overviewBodies = runtime.instancedBodies + runtime.texturedOverviewBodies

  if (runtime.selectedBody !== 'halley') {
    failures.push(`selectedBody=${runtime.selectedBody}; expected halley`)
  }
  if (runtime.detailedBodies !== 1 || overviewBodies + 1 !== runtime.totalBodies) {
    failures.push(
      `detail promotion mismatch detailed=${runtime.detailedBodies} instanced=${runtime.instancedBodies} textured=${runtime.texturedOverviewBodies} total=${runtime.totalBodies}`
    )
  }
  if (runtime.overviewFrameManagers !== 1) {
    failures.push(`overview managers changed to ${runtime.overviewFrameManagers}`)
  }
  if (runtime.bodyBatchDraws !== overviewRuntime.bodyBatchDraws) {
    failures.push(
      `body batch count changed ${overviewRuntime.bodyBatchDraws} → ${runtime.bodyBatchDraws}`
    )
  }
  if (runtime.batchedOrbitPaths !== runtime.totalBodies - 1) {
    failures.push(
      `batchedOrbitPaths=${runtime.batchedOrbitPaths}; expected ${runtime.totalBodies - 1}`
    )
  }
  if (runtime.individualOrbitPaths !== 1 || runtime.orbitBatchDraws !== 1) {
    failures.push(
      `selected orbit promotion batch=${runtime.orbitBatchDraws} individual=${runtime.individualOrbitPaths}`
    )
  }
  if (runtime.positionEvaluationsPerFrame !== overviewBodies) {
    failures.push(
      `selected body was still evaluated by overview manager: ${runtime.positionEvaluationsPerFrame} versus ${overviewBodies}`
    )
  }
  if (renderer.drawCalls > overviewRenderer.drawCalls + 18) {
    failures.push(
      `one settled detailed comet added ${renderer.drawCalls - overviewRenderer.drawCalls} draw calls; overview=${JSON.stringify(overviewRenderer)} selected=${JSON.stringify(renderer)}`
    )
  }
  if (renderer.sceneObjects > overviewRenderer.sceneObjects + 30) {
    failures.push(
      `one settled detailed comet added ${renderer.sceneObjects - overviewRenderer.sceneObjects} scene objects; overview=${JSON.stringify(overviewRenderer)} selected=${JSON.stringify(renderer)}`
    )
  }

  if (failures.length > 0) {
    throw new Error(`Selected small-body detail failed:\n${failures.join('\n')}`)
  }
}

async function clearSelection(page) {
  await page.click('[aria-label="Close body inspector"]')
  await page.waitForFunction(() => {
    const runtime = window.__SOLAR_SMALL_BODY_RUNTIME__
    return runtime?.selectedBody === null
      && runtime.detailedBodies === 0
      && runtime.instancedBodies + runtime.texturedOverviewBodies === runtime.totalBodies
  }, { timeout: 15_000 })
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
    await waitForSmallBodyOverview(page)

    await delay(1_700)
    const overviewRuntime = await readRuntime(page)
    const overviewRenderer = await waitForFreshRenderer(page)
    assertOverviewBatching(overviewRuntime, overviewRenderer)

    await waitForCompleteScene(page)
    const settledOverviewRenderer = await waitForSettledRenderer(
      page,
      overviewRenderer.timestamp
    )

    await selectBodyThroughSearch(page, 'Halley')
    await delay(2_200)
    const selectedRuntime = await readRuntime(page)
    const selectedRenderer = await waitForSettledRenderer(
      page,
      settledOverviewRenderer.timestamp
    )
    assertSelectedDetail(
      selectedRuntime,
      overviewRuntime,
      selectedRenderer,
      settledOverviewRenderer
    )

    await clearSelection(page)
    const restoredRuntime = await readRuntime(page)
    if (
      restoredRuntime.bodyBatchDraws !== overviewRuntime.bodyBatchDraws
      || restoredRuntime.batchedOrbitPaths !== overviewRuntime.batchedOrbitPaths
    ) {
      throw new Error(
        `Overview batching did not restore after detail close: ${JSON.stringify(restoredRuntime)}`
      )
    }

    if (pageErrors.length > 0) {
      throw new Error(`Small-body batching page errors:\n${pageErrors.join('\n')}`)
    }

    console.log(
      `[small-body-smoke] draw-call reduction ${P0_ECO_BASELINE.drawCalls} → ${overviewRenderer.drawCalls}`
    )
    console.log(
      `[small-body-smoke] scene-object reduction ${P0_ECO_BASELINE.sceneObjects} → ${overviewRenderer.sceneObjects}`
    )
    console.log(
      `[small-body-smoke] geometry reduction ${P0_ECO_BASELINE.geometries} → ${overviewRenderer.geometries}`
    )
    console.log(
      `[small-body-smoke] settled selected-detail delta draws=${selectedRenderer.drawCalls - settledOverviewRenderer.drawCalls} objects=${selectedRenderer.sceneObjects - settledOverviewRenderer.sceneObjects}`
    )
    console.log(
      `[small-body-smoke] ${overviewRuntime.totalBodies} overview bodies use ${overviewRuntime.bodyBatchDraws} body draws, ${overviewRuntime.orbitBatchDraws} orbit draw, and one ${overviewRuntime.averageUpdateMs.toFixed(2)}ms manager`
    )

    await page.close()
  } catch (error) {
    console.error('[small-body-smoke] failed')
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
