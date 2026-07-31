import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.WEBGPU_SMOKE_PORT || 3121)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const requireRealWebGPU = process.env.WEBGPU_REQUIRE_REAL === '1'
const EXPECTED_TEXTURE_IDS = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'earth-clouds',
  'mars',
  'jupiter',
  'saturn',
  'saturn-ring',
  'uranus',
  'neptune',
]
const EXPECTED_VISUAL_SYSTEMS = [
  'tsl-star-field',
  'tsl-solar-wind',
]
const EXPECTED_STAR_COUNT = 1_600
const EXPECTED_SOLAR_WIND_COUNT = 320

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
  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < timeoutMs) {
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

function collectPageFailures(page) {
  const failures = []
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.startsWith('data:')) return
    failures.push(`request failed: ${url} (${request.failure()?.errorText ?? 'unknown'})`)
  })
  return failures
}

async function configurePage(page) {
  await page.setViewport({
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  })
}

async function diagnosticSnapshot(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    return {
      diagnostics: window.__SOLAR_WEBGPU_LAB__ ?? null,
      textureDiagnostics: window.__SOLAR_WEBGPU_LAB_TEXTURES__ ?? null,
      effectsDiagnostics: window.__SOLAR_WEBGPU_LAB_EFFECTS__ ?? null,
      canvas: canvas
        ? {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
          }
        : null,
      bodyText: (document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 1_500),
      navigatorGpu: 'gpu' in navigator,
    }
  })
}

async function probeWebGPUAdapters(page) {
  return page.evaluate(async () => {
    if (!('gpu' in navigator)) {
      return {
        apiAvailable: false,
        core: { available: false, error: 'navigator.gpu is unavailable' },
        compatibility: { available: false, error: 'navigator.gpu is unavailable' },
      }
    }

    const probe = async (featureLevel) => {
      try {
        const preferredOptions = featureLevel
          ? { powerPreference: 'high-performance', featureLevel }
          : { powerPreference: 'high-performance' }
        const fallbackOptions = featureLevel ? { featureLevel } : {}
        const adapter = await navigator.gpu.requestAdapter(preferredOptions)
          ?? await navigator.gpu.requestAdapter(fallbackOptions)

        return {
          available: Boolean(adapter),
          features: adapter ? [...adapter.features].sort() : [],
          error: null,
        }
      } catch (error) {
        return {
          available: false,
          features: [],
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    return {
      apiAvailable: true,
      core: await probe(null),
      compatibility: await probe('compatibility'),
    }
  })
}

async function waitForLabDiagnostics(page, expectedRequested, timeout = 90_000) {
  await page.waitForSelector('canvas', { timeout: 45_000 })

  try {
    await page.waitForFunction(
      (
        requested,
        expectedTextureIds,
        expectedVisualSystems,
        expectedStarCount,
        expectedSolarWindCount
      ) => {
        const diagnostics = window.__SOLAR_WEBGPU_LAB__
        const effects = window.__SOLAR_WEBGPU_LAB_EFFECTS__
        const metrics = diagnostics?.metrics
        return Boolean(
          diagnostics
          && diagnostics.requestedBackend === requested
          && (diagnostics.actualBackend === 'webgpu' || diagnostics.actualBackend === 'webgl2')
          && diagnostics.backendClass
          && diagnostics.initializationMs !== null
          && Number.isFinite(diagnostics.initializationMs)
          && diagnostics.initializationMs >= 0
          && diagnostics.textureBackend === 'ktx2'
          && diagnostics.textureFailedIds.length === 0
          && diagnostics.textureRequestedIds.length === expectedTextureIds.length
          && diagnostics.textureLoadedIds.length === expectedTextureIds.length
          && expectedTextureIds.every((id) => diagnostics.textureRequestedIds.includes(id))
          && expectedTextureIds.every((id) => diagnostics.textureLoadedIds.includes(id))
          && diagnostics.textureFormats.length > 0
          && effects
          && effects.visualSystems.length === expectedVisualSystems.length
          && expectedVisualSystems.every((id) => effects.visualSystems.includes(id))
          && effects.starCount === expectedStarCount
          && effects.solarWindCount === expectedSolarWindCount
          && effects.animationMode === 'vertex-tsl'
          && effects.cpuPositionUpdates === false
          && metrics
          && metrics.samples >= 30
          && Number.isFinite(metrics.fps)
          && metrics.fps > 0
          && Number.isFinite(metrics.averageFrameMs)
          && metrics.averageFrameMs > 0
          && Number.isFinite(metrics.p95FrameMs)
          && metrics.p95FrameMs > 0
          && Number.isFinite(metrics.longestFrameMs)
          && metrics.longestFrameMs > 0
        )
      },
      { timeout },
      expectedRequested,
      EXPECTED_TEXTURE_IDS,
      EXPECTED_VISUAL_SYSTEMS,
      EXPECTED_STAR_COUNT,
      EXPECTED_SOLAR_WIND_COUNT
    )
  } catch (error) {
    const snapshot = await diagnosticSnapshot(page)
    throw new Error(
      `Timed out waiting for ${expectedRequested} W3 diagnostics: ${JSON.stringify(snapshot)}`,
      { cause: error }
    )
  }

  return page.evaluate(() => window.__SOLAR_WEBGPU_LAB__)
}

async function assertCanvasHealthy(page, label) {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const bodyText = document.body.textContent ?? ''
    return {
      canvasWidth: canvas?.clientWidth ?? 0,
      canvasHeight: canvas?.clientHeight ?? 0,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      errorBoundaryVisible: bodyText.includes('The laboratory could not start this backend.'),
    }
  })

  if (
    result.canvasWidth <= 0
    || result.canvasHeight <= 0
    || result.horizontalOverflow > 2
    || result.errorBoundaryVisible
  ) {
    throw new Error(`${label} canvas/layout failed: ${JSON.stringify(result)}`)
  }
}

function assertTextureDiagnostics(diagnostics) {
  if (diagnostics.textureBackend !== 'ktx2') {
    throw new Error(`Expected KTX2 texture backend, received ${diagnostics.textureBackend}`)
  }
  if (diagnostics.textureFailedIds.length > 0) {
    throw new Error(`KTX2 texture failures: ${diagnostics.textureFailedIds.join(', ')}`)
  }

  const missingRequested = EXPECTED_TEXTURE_IDS.filter(
    (id) => !diagnostics.textureRequestedIds.includes(id)
  )
  const missingLoaded = EXPECTED_TEXTURE_IDS.filter(
    (id) => !diagnostics.textureLoadedIds.includes(id)
  )

  if (missingRequested.length || missingLoaded.length) {
    throw new Error(
      `Incomplete W3 texture set: ${JSON.stringify({ missingRequested, missingLoaded })}`
    )
  }
  if (diagnostics.textureFormats.length === 0) {
    throw new Error('KTX2 textures loaded without a reported transcode format')
  }
}

async function assertEffectsDiagnostics(page) {
  const effects = await page.evaluate(() => window.__SOLAR_WEBGPU_LAB_EFFECTS__)
  if (!effects) throw new Error('W3 TSL effect diagnostics were not published')

  const missingSystems = EXPECTED_VISUAL_SYSTEMS.filter(
    (id) => !effects.visualSystems.includes(id)
  )
  const unexpectedSystems = effects.visualSystems.filter(
    (id) => !EXPECTED_VISUAL_SYSTEMS.includes(id)
  )

  if (missingSystems.length || unexpectedSystems.length) {
    throw new Error(
      `Unexpected W3 visual systems: ${JSON.stringify({ missingSystems, unexpectedSystems })}`
    )
  }
  if (effects.starCount !== EXPECTED_STAR_COUNT) {
    throw new Error(`Expected ${EXPECTED_STAR_COUNT} TSL stars, received ${effects.starCount}`)
  }
  if (effects.solarWindCount !== EXPECTED_SOLAR_WIND_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_SOLAR_WIND_COUNT} solar-wind particles, received ${effects.solarWindCount}`
    )
  }
  if (effects.animationMode !== 'vertex-tsl' || effects.cpuPositionUpdates !== false) {
    throw new Error(`W3 particle animation contract failed: ${JSON.stringify(effects)}`)
  }

  return effects
}

function assertDiagnostics(diagnostics, requested, actual) {
  if (!diagnostics) throw new Error(`No diagnostics published for ${requested}`)
  if (diagnostics.requestedBackend !== requested) {
    throw new Error(
      `Requested backend mismatch: expected ${requested}, received ${diagnostics.requestedBackend}`
    )
  }
  if (diagnostics.actualBackend !== actual) {
    throw new Error(
      `Actual backend mismatch: expected ${actual}, received ${diagnostics.actualBackend}`
    )
  }
  assertTextureDiagnostics(diagnostics)
}

async function openLab(page, suffix = '') {
  await page.goto(`${baseUrl}/lab/webgpu${suffix}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForFunction(
    () => document.body.textContent?.includes('WebGPU / TSL laboratory'),
    { timeout: 30_000 }
  )
}

async function clickBackend(page, text) {
  const clicked = await page.evaluate((buttonText) => {
    const button = [...document.querySelectorAll('button')].find((candidate) => (
      candidate.textContent?.replace(/\s+/g, ' ').includes(buttonText)
    ))
    if (!(button instanceof HTMLButtonElement)) return false
    button.click()
    return true
  }, text)

  if (!clicked) throw new Error(`Could not click backend control containing “${text}”`)
}

async function runForcedWebGL(browser) {
  const page = await browser.newPage()
  await configurePage(page)
  const failures = collectPageFailures(page)

  await openLab(page, '?backend=webgl')
  const diagnostics = await waitForLabDiagnostics(page, 'webgl')
  const effects = await assertEffectsDiagnostics(page)
  assertDiagnostics(diagnostics, 'webgl', 'webgl2')
  await assertCanvasHealthy(page, 'forced WebGL 2')

  const text = await page.evaluate(() => document.body.textContent ?? '')
  if (
    !text.includes('W3 parity scope')
    || !text.includes('KTX2 ready')
    || !text.includes('Vertex TSL')
  ) {
    throw new Error('Forced WebGL 2 lab UI did not render the W3 controls')
  }

  if (failures.length > 0) {
    throw new Error(`Forced WebGL 2 browser failures:\n${failures.join('\n')}`)
  }

  console.log(
    `[webgpu-smoke] forced WebGL 2 W3 ${JSON.stringify({ diagnostics, effects })}`
  )
  await page.close()
}

async function runAutoSelection(browser) {
  const page = await browser.newPage()
  await configurePage(page)
  const failures = collectPageFailures(page)

  await openLab(page)
  const adapterProbe = await probeWebGPUAdapters(page)
  const expectedBackend = adapterProbe.core.available ? 'webgpu' : 'webgl2'
  const diagnostics = await waitForLabDiagnostics(page, 'auto')
  const effects = await assertEffectsDiagnostics(page)

  assertDiagnostics(diagnostics, 'auto', expectedBackend)
  await assertCanvasHealthy(page, 'automatic backend selection')

  if (expectedBackend === 'webgpu') {
    if (diagnostics.adapterStatus !== 'available') {
      throw new Error(`WebGPU initialized without a successful adapter preflight: ${JSON.stringify(diagnostics)}`)
    }
  } else {
    if (!['unavailable', 'error'].includes(diagnostics.adapterStatus)) {
      throw new Error(`WebGL fallback did not report adapter unavailability: ${JSON.stringify(diagnostics)}`)
    }
    if (!diagnostics.fallbackReason) {
      throw new Error('WebGL fallback did not publish a reason')
    }
  }

  await clickBackend(page, 'Force WebGL 2')
  const forcedDiagnostics = await waitForLabDiagnostics(page, 'webgl')
  await assertEffectsDiagnostics(page)
  assertDiagnostics(forcedDiagnostics, 'webgl', 'webgl2')

  await clickBackend(page, 'Auto WebGPU')
  const restoredDiagnostics = await waitForLabDiagnostics(page, 'auto')
  const restoredEffects = await assertEffectsDiagnostics(page)
  assertDiagnostics(restoredDiagnostics, 'auto', expectedBackend)
  await assertCanvasHealthy(page, 'restored automatic backend selection')

  if (failures.length > 0) {
    throw new Error(`Automatic backend browser failures:\n${failures.join('\n')}`)
  }

  console.log(`[webgpu-smoke] auto adapter probe ${JSON.stringify(adapterProbe)}`)
  console.log(
    `[webgpu-smoke] auto W3 selected ${JSON.stringify({ diagnostics, effects })}`
  )
  console.log(
    `[webgpu-smoke] auto W3 restored ${JSON.stringify({ diagnostics: restoredDiagnostics, effects: restoredEffects })}`
  )
  await page.close()
}

async function runOptionalRealWebGPU(browser) {
  const page = await browser.newPage()
  await configurePage(page)
  const failures = collectPageFailures(page)

  await openLab(page)
  const adapterProbe = await probeWebGPUAdapters(page)
  console.log(`[webgpu-smoke] software WebGPU adapter probe ${JSON.stringify(adapterProbe)}`)

  if (!adapterProbe.core.available) {
    await page.close()
    const message = 'This Chromium build exposes navigator.gpu but no usable Dawn adapter; real WebGPU validation was skipped.'
    if (requireRealWebGPU) throw new Error(message)
    console.log(`[webgpu-smoke] ${message}`)
    return
  }

  const diagnostics = await waitForLabDiagnostics(page, 'auto')
  const effects = await assertEffectsDiagnostics(page)
  assertDiagnostics(diagnostics, 'auto', 'webgpu')
  await assertCanvasHealthy(page, 'real WebGPU')

  if (diagnostics.adapterStatus !== 'available') {
    throw new Error(`Real WebGPU did not report a successful adapter preflight: ${JSON.stringify(diagnostics)}`)
  }
  if (!diagnostics.webgpuApiAvailable) {
    throw new Error('WebGPU backend initialized while navigator.gpu was reported unavailable')
  }
  if (failures.length > 0) {
    throw new Error(`WebGPU browser failures:\n${failures.join('\n')}`)
  }

  console.log(`[webgpu-smoke] real WebGPU W3 ${JSON.stringify({ diagnostics, effects })}`)
  await page.close()
}

function launchForcedWebGLBrowser() {
  return puppeteer.launch({
    headless: 'new',
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
}

function launchWebGPUBrowser() {
  // Use Chromium's Linux software-WebGPU path when this packaged browser
  // includes a Dawn SwiftShader adapter. Not every distribution ships it, so
  // the mandatory gate remains capability-aware and WEBGPU_REQUIRE_REAL=1 can
  // be used on a self-hosted runner or real device.
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu-sandbox',
      '--enable-unsafe-webgpu',
      '--enable-webgpu-developer-features',
      '--enable-blink-features=WebGPUCompatibilityMode',
      '--enable-features=Vulkan',
      '--use-angle=vulkan',
      '--use-vulkan=swiftshader',
      '--use-webgpu-adapter=swiftshader',
      '--disable-vulkan-surface',
      '--ignore-gpu-blocklist',
      '--use-gpu-in-tests',
      '--enable-dawn-features=allow_unsafe_apis',
      '--enable-accelerated-2d-canvas',
      '--window-size=1280,720',
    ],
  })
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

  let webglBrowser
  let webgpuBrowser
  try {
    await waitForServer(server)

    webglBrowser = await launchForcedWebGLBrowser()
    await runForcedWebGL(webglBrowser)
    await runAutoSelection(webglBrowser)
    await webglBrowser.close()
    webglBrowser = undefined

    webgpuBrowser = await launchWebGPUBrowser()
    await runOptionalRealWebGPU(webgpuBrowser)
  } catch (error) {
    console.error('[webgpu-smoke] failed')
    if (serverOutput.trim()) console.error(serverOutput.trim())
    throw error
  } finally {
    if (webglBrowser) await webglBrowser.close()
    if (webgpuBrowser) await webgpuBrowser.close()
    server.kill('SIGTERM')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
