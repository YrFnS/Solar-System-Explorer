import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.ADAPTIVE_LOD_SMOKE_PORT || 3133)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const LEGACY_TRAVERSAL_INTERVAL_MS = 240

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
  await page.waitForSelector('[aria-label="Open rendering quality controls"]', {
    timeout: 45_000,
  })
  await page.waitForFunction(() => {
    const lod = window.__SOLAR_ADAPTIVE_LOD__
    const loading = window.__SOLAR_SCENE_LOADING__
    return Boolean(
      lod
      && lod.registeredMeshes >= 8
      && lod.initialSceneWalks === 1
      && lod.registryEvaluations >= 1
      && !lod.dirty
      && loading?.complete
    )
  }, { timeout: 75_000 })
}

async function readLod(page) {
  const diagnostics = await page.evaluate(() => window.__SOLAR_ADAPTIVE_LOD__)
  if (!diagnostics) throw new Error('Adaptive LOD diagnostics were unavailable')
  return diagnostics
}

async function readRenderer(page) {
  const diagnostics = await page.evaluate(() => window.__SOLAR_EXPLORER_DIAGNOSTICS__)
  if (!diagnostics) throw new Error('Renderer diagnostics were unavailable')
  return diagnostics
}

async function waitForCleanLod(page) {
  await page.waitForFunction(() => {
    const lod = window.__SOLAR_ADAPTIVE_LOD__
    return Boolean(lod && !lod.dirty && lod.registryEvaluations >= 1)
  }, { timeout: 20_000 })
  return readLod(page)
}

async function assertStationaryRegistry(page) {
  await page.keyboard.press('Space')
  await page.waitForFunction(() => window.__SOLAR_SIMULATION_TIMING__?.paused === true, {
    timeout: 10_000,
  })
  await waitForCleanLod(page)

  const before = await readLod(page)
  const renderer = await readRenderer(page)
  const durationMs = 2_600
  await delay(durationMs)
  const after = await readLod(page)

  if (after.initialSceneWalks !== 1 || after.periodicSceneWalks !== 0) {
    throw new Error(
      `Stationary LOD repeated a scene walk: ${JSON.stringify({ before, after })}`
    )
  }

  const evaluationDelta = after.registryEvaluations - before.registryEvaluations
  if (evaluationDelta > 1) {
    throw new Error(
      `Stationary LOD evaluated the registry ${evaluationDelta} times in ${durationMs}ms`
    )
  }

  const stationaryDelta = after.stationaryFrames - before.stationaryFrames
  if (stationaryDelta < 2) {
    throw new Error(
      `Stationary frame evidence was too small: ${stationaryDelta}`
    )
  }

  const legacyEstimatedObjectVisits = Math.floor(
    renderer.sceneObjects * (durationMs / LEGACY_TRAVERSAL_INTERVAL_MS)
  )
  const newMeshVisits = after.meshEvaluations - before.meshEvaluations

  console.log(
    `[adaptive-lod-smoke] stationary ${durationMs}ms legacy-estimate=${legacyEstimatedObjectVisits} object visits new=${newMeshVisits} registered-mesh visits`
  )

  return { before, after, renderer, legacyEstimatedObjectVisits, newMeshVisits }
}

async function assertCameraInvalidation(page) {
  const before = await readLod(page)
  const canvas = await page.$('canvas')
  if (!canvas) throw new Error('Canvas was unavailable for camera interaction')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds were unavailable')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel({ deltaY: -620 })

  await page.waitForFunction((cameraInvalidations, evaluations) => {
    const lod = window.__SOLAR_ADAPTIVE_LOD__
    return Boolean(
      lod
      && lod.cameraInvalidations > cameraInvalidations
      && lod.registryEvaluations > evaluations
      && !lod.dirty
    )
  }, { timeout: 20_000 }, before.cameraInvalidations, before.registryEvaluations)

  const after = await readLod(page)
  if (after.initialSceneWalks !== 1 || after.periodicSceneWalks !== 0) {
    throw new Error('Camera invalidation reintroduced a scene traversal')
  }

  console.log(
    `[adaptive-lod-smoke] camera invalidation evaluation=${after.lastEvaluationMs?.toFixed(2) ?? 'n/a'}ms`
  )
  return after
}

async function assertViewportInvalidation(page) {
  const before = await readLod(page)
  await page.setViewport({
    width: 1100,
    height: 760,
    deviceScaleFactor: 1,
  })

  await page.waitForFunction((viewportInvalidations, evaluations) => {
    const lod = window.__SOLAR_ADAPTIVE_LOD__
    return Boolean(
      lod
      && lod.viewportInvalidations > viewportInvalidations
      && lod.registryEvaluations > evaluations
      && !lod.dirty
    )
  }, { timeout: 20_000 }, before.viewportInvalidations, before.registryEvaluations)

  const after = await readLod(page)
  console.log(
    `[adaptive-lod-smoke] viewport invalidation registered=${after.registeredMeshes} pooled=${after.pooledGeometries}`
  )
  return after
}

async function selectBalanced(page) {
  const trigger = await page.waitForSelector(
    '[aria-label="Open rendering quality controls"]',
    { timeout: 15_000 }
  )
  const expanded = await trigger.evaluate((element) => element.getAttribute('aria-expanded'))
  if (expanded !== 'true') await trigger.click()

  const clicked = await page.evaluate(() => {
    const dock = document.querySelector('[data-texture-backend]')
    const button = [...(dock?.querySelectorAll('button') ?? [])].find((candidate) => {
      const text = candidate.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      return !candidate.disabled && text.startsWith('Balanced')
    })
    if (!(button instanceof HTMLButtonElement)) return false
    button.click()
    return true
  })

  if (!clicked) throw new Error('Could not select the Balanced quality profile')
}

async function assertQualityInvalidation(page) {
  const before = await readLod(page)
  await selectBalanced(page)

  await page.waitForFunction((qualityInvalidations, evaluations) => {
    const lod = window.__SOLAR_ADAPTIVE_LOD__
    return Boolean(
      lod
      && lod.quality === 'balanced'
      && lod.qualityInvalidations > qualityInvalidations
      && lod.registryEvaluations > evaluations
      && !lod.dirty
      && window.localStorage.getItem('solar-explorer-quality-preset-v1') === 'balanced'
    )
  }, { timeout: 30_000 }, before.qualityInvalidations, before.registryEvaluations)

  const after = await readLod(page)
  console.log(
    `[adaptive-lod-smoke] quality invalidation low=${after.lowMeshes} medium=${after.mediumMeshes} high=${after.highMeshes}`
  )
  return after
}

function assertFinalDiagnostics(diagnostics) {
  const failures = []

  if (diagnostics.initialSceneWalks !== 1) {
    failures.push(`initialSceneWalks=${diagnostics.initialSceneWalks}; expected 1`)
  }
  if (diagnostics.periodicSceneWalks !== 0) {
    failures.push(`periodicSceneWalks=${diagnostics.periodicSceneWalks}; expected 0`)
  }
  if (diagnostics.registeredMeshes < 8) {
    failures.push(`registeredMeshes=${diagnostics.registeredMeshes}; expected at least 8`)
  }
  if (diagnostics.pooledGeometries <= 0 || diagnostics.poolMisses <= 0) {
    failures.push('generated geometry pool never became resident')
  }
  if (diagnostics.poolHits <= 0) {
    failures.push('generated sphere geometry was never reused')
  }
  if (diagnostics.pooledGeometryUsers > diagnostics.registeredMeshes) {
    failures.push(
      `pooled users=${diagnostics.pooledGeometryUsers} exceeded registered meshes=${diagnostics.registeredMeshes}`
    )
  }
  if (
    diagnostics.averageEvaluationMs === null
    || diagnostics.averageEvaluationMs <= 0
    || diagnostics.averageEvaluationMs > 25
  ) {
    failures.push(
      `averageEvaluationMs=${diagnostics.averageEvaluationMs}; expected 0-25ms`
    )
  }
  if (diagnostics.maxEvaluationMs > 75) {
    failures.push(`maxEvaluationMs=${diagnostics.maxEvaluationMs}; expected <=75ms`)
  }
  if (
    diagnostics.cameraInvalidations <= 0
    || diagnostics.viewportInvalidations <= 0
    || diagnostics.qualityInvalidations <= 0
  ) {
    failures.push(
      `missing invalidation evidence camera=${diagnostics.cameraInvalidations} viewport=${diagnostics.viewportInvalidations} quality=${diagnostics.qualityInvalidations}`
    )
  }

  if (failures.length > 0) {
    throw new Error(`Adaptive LOD diagnostics failed:\n${failures.join('\n')}`)
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

    const initial = await readLod(page)
    if (initial.initialSceneWalks !== 1 || initial.periodicSceneWalks !== 0) {
      throw new Error(`Initial registry contract failed: ${JSON.stringify(initial)}`)
    }

    await assertStationaryRegistry(page)
    await assertCameraInvalidation(page)
    await assertViewportInvalidation(page)
    const finalDiagnostics = await assertQualityInvalidation(page)
    assertFinalDiagnostics(finalDiagnostics)

    if (pageErrors.length > 0) {
      throw new Error(`Adaptive LOD page errors:\n${pageErrors.join('\n')}`)
    }

    console.log(
      `[adaptive-lod-smoke] final ${JSON.stringify(finalDiagnostics)}`
    )
    console.log(
      '[adaptive-lod-smoke] one scene walk, zero periodic traversals, stationary skip, camera/viewport/quality invalidation, and shared geometry reuse passed'
    )

    await page.close()
  } catch (error) {
    console.error('[adaptive-lod-smoke] failed')
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
