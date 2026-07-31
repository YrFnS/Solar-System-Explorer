import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.WEBGPU_SMOKE_PORT || 3121)
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
      canvas: canvas
        ? {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
          }
        : null,
      bodyText: (document.body.textContent ?? '').replace(/\s+/g, ' ').slice(0, 1_200),
      navigatorGpu: 'gpu' in navigator,
    }
  })
}

async function waitForLabDiagnostics(page, expectedRequested, timeout = 60_000) {
  await page.waitForSelector('canvas', { timeout: 45_000 })

  try {
    await page.waitForFunction(
      (requested) => {
        const diagnostics = window.__SOLAR_WEBGPU_LAB__
        const metrics = diagnostics?.metrics
        return Boolean(
          diagnostics
          && diagnostics.requestedBackend === requested
          && (diagnostics.actualBackend === 'webgpu' || diagnostics.actualBackend === 'webgl2')
          && diagnostics.backendClass
          && diagnostics.initializationMs !== null
          && Number.isFinite(diagnostics.initializationMs)
          && diagnostics.initializationMs >= 0
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
      expectedRequested
    )
  } catch (error) {
    const snapshot = await diagnosticSnapshot(page)
    throw new Error(
      `Timed out waiting for ${expectedRequested} lab diagnostics: ${JSON.stringify(snapshot)}`,
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

function assertDiagnostics(diagnostics, requested, actual) {
  if (!diagnostics) throw new Error(`No diagnostics published for ${requested}`)
  if (diagnostics.requestedBackend !== requested) {
    throw new Error(
      `Requested backend mismatch: expected ${requested}, received ${diagnostics.requestedBackend}`
    )
  }
  if (actual && diagnostics.actualBackend !== actual) {
    throw new Error(
      `Actual backend mismatch: expected ${actual}, received ${diagnostics.actualBackend}`
    )
  }
  if (!['webgpu', 'webgl2'].includes(diagnostics.actualBackend)) {
    throw new Error(`Unexpected actual backend: ${diagnostics.actualBackend}`)
  }
}

async function runForcedWebGL(browser) {
  const page = await browser.newPage()
  await configurePage(page)
  const failures = collectPageFailures(page)

  await page.goto(`${baseUrl}/lab/webgpu?backend=webgl`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  const diagnostics = await waitForLabDiagnostics(page, 'webgl')
  assertDiagnostics(diagnostics, 'webgl', 'webgl2')
  await assertCanvasHealthy(page, 'forced WebGL 2')

  const text = await page.evaluate(() => document.body.textContent ?? '')
  if (!text.includes('WebGPU / TSL laboratory') || !text.includes('W1 parity scope')) {
    throw new Error('Forced WebGL 2 lab UI did not render the expected controls')
  }

  if (failures.length > 0) {
    throw new Error(`Forced WebGL 2 browser failures:\n${failures.join('\n')}`)
  }

  console.log(`[webgpu-smoke] forced WebGL 2 ${JSON.stringify(diagnostics)}`)
  await page.close()
}

async function runAutoAndSwitch(browser) {
  const page = await browser.newPage()
  await configurePage(page)
  const failures = collectPageFailures(page)

  await page.goto(`${baseUrl}/lab/webgpu`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  const autoDiagnostics = await waitForLabDiagnostics(page, 'auto')
  assertDiagnostics(autoDiagnostics, 'auto')
  await assertCanvasHealthy(page, 'auto backend')

  if (!autoDiagnostics.webgpuApiAvailable && autoDiagnostics.actualBackend !== 'webgl2') {
    throw new Error(
      'Auto mode reported WebGPU without navigator.gpu being available in the browser'
    )
  }

  await clickBackend(page, 'Force WebGL 2')
  const forcedDiagnostics = await waitForLabDiagnostics(page, 'webgl')
  assertDiagnostics(forcedDiagnostics, 'webgl', 'webgl2')
  await assertCanvasHealthy(page, 'auto-to-WebGL switch')

  await clickBackend(page, 'Auto WebGPU')
  const restoredDiagnostics = await waitForLabDiagnostics(page, 'auto')
  assertDiagnostics(restoredDiagnostics, 'auto')
  await assertCanvasHealthy(page, 'WebGL-to-auto switch')

  if (failures.length > 0) {
    throw new Error(`Auto backend browser failures:\n${failures.join('\n')}`)
  }

  console.log(`[webgpu-smoke] auto initial ${JSON.stringify(autoDiagnostics)}`)
  console.log(`[webgpu-smoke] auto restored ${JSON.stringify(restoredDiagnostics)}`)
  await page.close()
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
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-webgl',
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--use-angle=vulkan',
        '--enable-features=Vulkan',
        '--disable-vulkan-surface',
        '--window-size=1280,720',
      ],
    })

    await runForcedWebGL(browser)
    await runAutoAndSwitch(browser)
  } catch (error) {
    console.error('[webgpu-smoke] failed')
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
