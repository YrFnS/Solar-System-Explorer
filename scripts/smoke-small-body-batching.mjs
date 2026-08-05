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

async function waitForCore(page) {
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
      loading?.complete
      && loading.stage === 6
      && runtime
      && runtime.frameSamples >= 8
      && runtime.totalBodies >= 15
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

function assertOverviewBatching(runtime, renderer) {
  const failures = []

  if (runtime.totalBodies < 15) {
    failures.push(`totalBodies=${runtime.totalBodies}; expected the complete Eco catalogue`)
  }
  if (runtime.instancedBodies !== runtime.totalBodies || runtime.detailedBodies !== 0) {
    failures.push(
      `overview promotion mismatch instanced=${runtime.instancedBodies} detailed=${runtime.detailedBodies} total=${runtime.totalBodies}`
    )
  }
  if (runtime.overviewFrameManagers !== 1) {
    failures.push(`overviewFrameManagers=${runtime.overviewFrameManagers}; expected exactly 1`)
  }
  if (runtime.bodyBatchDraws > 3 || runtime.bodyBatchDraws < 2) {
    failures.push(`bodyBatchDraws=${runtime.bodyBatchDraws}; expected 2-3 shared batches`)
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
  if (runtime.positionEvaluationsPerFrame !== runtime.instancedBodies) {
    failures.push(
      `position evaluations=${runtime.positionEvaluationsPerFrame}; expected ${runtime.instancedBodies}`
    )
  }
  if (runtime.matrixWritesPerFrame !== runtime.instancedBodies * 2) {
    failures.push(
      `matrix writes=${runtime.matrixWritesPerFrame}; expected ${runtime.instancedBodies * 2}`
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

  if (runtime.selectedBody !== 'halley') {
    failures.push(`selectedBody=${runtime.selectedBody}; expected halley`)
  }
  if (runtime.detailedBodies !== 1 || runtime.instancedBodies !== runtime.totalBodies - 1) {
    failures.push(
      `detail promotion mismatch detailed=${runtime.detailedBodies} instanced=${runtime.instancedBodies} total=${runtime.totalBodies}`
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
  if (runtime.positionEvaluationsPerFrame !== runtime.instancedBodies) {
    failures.push(
      `selected body was still evaluated by overview manager: ${runtime.positionEvaluationsPerFrame} versus ${runtime.instancedBodies}`
    )
  }
  if (renderer.drawCalls > overviewRenderer.drawCalls + 16) {
    failures.push(
      `one detailed comet added ${renderer.drawCalls - overviewRenderer.drawCalls} draw calls`
    )
  }
  if (renderer.sceneObjects > overviewRenderer.sceneObjects + 28) {
    failures.push(
      `one detailed comet added ${renderer.sceneObjects - overviewRenderer.sceneObjects} scene objects`
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
      && runtime.instancedBodies === runtime.totalBodies
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
    await waitForCore(page)

    const overviewRuntime = await readRuntime(page)
    const overviewRenderer = await waitForFreshRenderer(page)
    assertOverviewBatching(overviewRuntime, overviewRenderer)

    await selectBodyThroughSearch(page, 'Halley')
    const selectedRuntime = await readRuntime(page)
    const selectedRenderer = await waitForFreshRenderer(
      page,
      overviewRenderer.timestamp
    )
    assertSelectedDetail(
      selectedRuntime,
      overviewRuntime,
      selectedRenderer,
      overviewRenderer
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
