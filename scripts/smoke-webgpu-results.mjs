import { cp, mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.WEBGPU_RESULTS_SMOKE_PORT || 3124)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const storageKey = 'solar-system-explorer:webgpu-benchmark:v1'

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
      const response = await fetch(`${baseUrl}/lab/webgpu/results`)
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

function createRecord(device, backend, bloom) {
  const averageFrameMs = backend === 'webgpu' ? 12 : 16
  const p95FrameMs = backend === 'webgpu' ? 16 : 22
  const longestFrameMs = backend === 'webgpu' ? 30 : 35

  return {
    id: `${device}-${backend}-${bloom ? 'bloom' : 'direct'}`,
    capturedAt: '2026-07-31T12:00:00.000Z',
    requestedBackend: backend === 'webgpu' ? 'auto' : 'webgl',
    actualBackend: backend,
    backendClass: backend === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend',
    adapterStatus: backend === 'webgpu' ? 'available' : 'not-requested',
    fallbackReason: null,
    postProcessingEnabled: bloom,
    initializationMs: backend === 'webgpu' ? 70 : 95,
    textureBackend: 'ktx2',
    textureFormats: ['RGBA_ASTC_4x4', 'RGB_ETC2'],
    frame: {
      fps: 1000 / averageFrameMs,
      averageFrameMs,
      p95FrameMs,
      longestFrameMs,
      samples: 120,
      drawCalls: bloom ? 74 : 70,
      triangles: 96000,
    },
    camera: {
      position: [0, 34, 62],
      target: [0, 0, 0],
    },
    simulation: {
      epoch: '2026-01-01T00:00:00.000Z',
      daysPerSecond: 12,
    },
    scene: {
      starCount: 1600,
      solarWindCount: 320,
      sunFlareArcs: 5,
      nebulaShellCount: 2,
      gravityObjectCount: 2,
      postStrength: 0.42,
      postRadius: 0.35,
      postThreshold: 0.72,
    },
    environment: {
      userAgent: `SyntheticBrowser/1.0 (${device})`,
      platform: device,
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      reducedMotion: false,
      viewport: {
        width: 1280,
        height: 720,
        devicePixelRatio: 1,
      },
      screen: {
        width: 1920,
        height: 1080,
        colorDepth: 24,
      },
    },
  }
}

function completeDevice(device) {
  return [
    createRecord(device, 'webgpu', true),
    createRecord(device, 'webgpu', false),
    createRecord(device, 'webgl2', true),
    createRecord(device, 'webgl2', false),
  ]
}

function payloadForDevices(devices) {
  const records = devices.flatMap(completeDevice)
  return {
    schema: 'solar-system-explorer-webgpu-benchmark',
    schemaVersion: 1,
    generatedAt: '2026-07-31T12:30:00.000Z',
    recordCount: records.length,
    records,
  }
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

async function clickButtonContaining(page, label) {
  const clicked = await page.evaluate((text) => {
    const button = [...document.querySelectorAll('button')].find((candidate) => (
      candidate.textContent?.replace(/\s+/g, ' ').includes(text)
    ))
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false
    button.click()
    return true
  }, label)

  if (!clicked) throw new Error(`Could not click enabled button containing “${label}”`)
}

async function runResultsWorkspace(browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
  const failures = collectPageFailures(page)

  await page.goto(`${baseUrl}/lab/webgpu/results`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForFunction(
    () => document.body.textContent?.includes('Turn device captures into a renderer decision'),
    { timeout: 30_000 }
  )

  const twoDevicePayload = payloadForDevices(['Device-A', 'Device-B'])
  await page.evaluate((key, records) => {
    sessionStorage.setItem(key, JSON.stringify(records))
  }, storageKey, twoDevicePayload.records)
  await clickButtonContaining(page, 'Load current session')
  await page.waitForFunction(() => {
    const diagnostics = window.__SOLAR_WEBGPU_BENCHMARK_ANALYSIS__
    return diagnostics?.recordCount === 8
      && diagnostics.validRecordCount === 8
      && diagnostics.distinctDevices === 2
      && diagnostics.completeDevices === 2
      && diagnostics.matchedComparisons === 4
      && diagnostics.recommendation === 'offer-webgpu-opt-in'
      && diagnostics.confidence === 'medium'
      && diagnostics.errorCount === 0
  }, { timeout: 20_000 })

  const optInText = await page.evaluate(() => document.body.textContent ?? '')
  if (!optInText.includes('WebGPU opt-in is justified')) {
    throw new Error('The evidence workspace did not render the opt-in recommendation')
  }

  await clickButtonContaining(page, 'Clear workspace')
  await page.waitForFunction(() => (
    window.__SOLAR_WEBGPU_BENCHMARK_ANALYSIS__?.recordCount === 0
  ), { timeout: 10_000 })

  const fourDevicePayload = payloadForDevices([
    'Device-A',
    'Device-B',
    'Device-C',
    'Device-D',
  ])
  const temporaryFile = path.join(os.tmpdir(), `solar-webgpu-results-${process.pid}.json`)
  await writeFile(temporaryFile, JSON.stringify(fourDevicePayload), 'utf8')

  try {
    const input = await page.waitForSelector(
      '[aria-label="Import benchmark JSON files"]',
      { timeout: 10_000 }
    )
    await input.uploadFile(temporaryFile)
    await page.waitForFunction(() => {
      const diagnostics = window.__SOLAR_WEBGPU_BENCHMARK_ANALYSIS__
      return diagnostics?.recordCount === 16
        && diagnostics.validRecordCount === 16
        && diagnostics.distinctDevices === 4
        && diagnostics.completeDevices === 4
        && diagnostics.matchedComparisons === 8
        && diagnostics.recommendation === 'consider-webgpu-default'
        && diagnostics.confidence === 'high'
        && diagnostics.errorCount === 0
    }, { timeout: 20_000 })
  } finally {
    await unlink(temporaryFile).catch(() => undefined)
  }

  const defaultText = await page.evaluate(() => document.body.textContent ?? '')
  if (
    !defaultText.includes('Evidence supports a controlled WebGPU-default trial')
    || !defaultText.includes('four-way complete')
    || !defaultText.includes('WebGPU faster')
  ) {
    throw new Error('The evidence workspace did not render the complete decision surface')
  }

  const overflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - window.innerWidth
  ))
  if (overflow > 2) {
    throw new Error(`Evidence workspace has horizontal overflow: ${overflow}px`)
  }
  if (failures.length > 0) {
    throw new Error(`Evidence workspace browser failures:\n${failures.join('\n')}`)
  }

  console.log('[webgpu-results-smoke] session import, file import, pairing, and recommendations passed')
  await page.close()
}

function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu-sandbox',
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

  let browser
  try {
    await waitForServer(server)
    browser = await launchBrowser()
    await runResultsWorkspace(browser)
  } catch (error) {
    console.error('[webgpu-results-smoke] failed')
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
