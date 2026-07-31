import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.WEBGPU_BENCHMARK_SMOKE_PORT || 3122)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const minimumSamples = 90
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

async function waitForLab(page) {
  await page.waitForSelector('canvas', { timeout: 45_000 })
  await page.waitForFunction(() => {
    const lab = window.__SOLAR_WEBGPU_LAB__
    const post = window.__SOLAR_WEBGPU_LAB_POST__
    const benchmark = window.__SOLAR_WEBGPU_LAB_BENCHMARK__
    return Boolean(
      lab
      && lab.actualBackend === 'webgl2'
      && lab.textureBackend === 'ktx2'
      && lab.textureFailedIds.length === 0
      && lab.metrics
      && lab.metrics.samples >= 30
      && post?.enabled === true
      && post.renderMode === 'render-pipeline-tsl'
      && benchmark
      && benchmark.schema === 'solar-system-explorer-webgpu-benchmark'
      && benchmark.schemaVersion === 1
      && benchmark.minimumSamples === 90
      && benchmark.recordCount === 0
    )
  }, { timeout: 90_000 })
}

async function prepareBaseline(page) {
  await page.click('[aria-label="Prepare benchmark baseline"]')
  await page.waitForFunction((requiredSamples) => {
    const benchmark = window.__SOLAR_WEBGPU_LAB_BENCHMARK__
    return Boolean(
      benchmark?.baselinePrepared
      && benchmark.ready
      && benchmark.currentConfiguration.samples >= requiredSamples
    )
  }, { timeout: 90_000 }, minimumSamples)
}

async function recordSample(page, expectedCount, expectedPostProcessing) {
  await page.click('[aria-label="Record benchmark sample"]')
  await page.waitForFunction((count, postProcessing) => {
    const benchmark = window.__SOLAR_WEBGPU_LAB_BENCHMARK__
    const lastRecord = benchmark?.lastRecord
    return Boolean(
      benchmark
      && benchmark.recordCount === count
      && lastRecord
      && lastRecord.actualBackend === 'webgl2'
      && lastRecord.postProcessingEnabled === postProcessing
      && lastRecord.frame.samples >= benchmark.minimumSamples
      && lastRecord.textureBackend === 'ktx2'
      && lastRecord.textureFormats.length > 0
    )
  }, { timeout: 20_000 }, expectedCount, expectedPostProcessing)
}

async function assertCameraInvalidation(page) {
  const canvas = await page.$('canvas')
  if (!canvas) throw new Error('Benchmark canvas was not found')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Benchmark canvas has no layout box')

  const startX = box.x + box.width * 0.75
  const startY = box.y + box.height * 0.55
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 36, startY + 18, { steps: 4 })
  await page.mouse.up()

  await page.waitForFunction(() => {
    const benchmark = window.__SOLAR_WEBGPU_LAB_BENCHMARK__
    return benchmark?.baselinePrepared === false && benchmark.ready === false
  }, { timeout: 10_000 })
}

async function runBenchmark(browser) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
  const failures = collectPageFailures(page)

  await page.goto(`${baseUrl}/lab/webgpu?backend=webgl`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForFunction(
    () => document.body.textContent?.includes('Real-device benchmark'),
    { timeout: 30_000 }
  )
  await waitForLab(page)

  await prepareBaseline(page)
  await assertCameraInvalidation(page)
  await prepareBaseline(page)
  await recordSample(page, 1, true)

  const postToggle = await page.waitForSelector(
    '[aria-label="Enable TSL bloom post-processing"]',
    { timeout: 15_000 }
  )
  await postToggle.click()
  await page.waitForFunction(() => {
    const post = window.__SOLAR_WEBGPU_LAB_POST__
    const benchmark = window.__SOLAR_WEBGPU_LAB_BENCHMARK__
    return post?.enabled === false
      && post.renderMode === 'direct-render'
      && benchmark?.currentConfiguration.postProcessingEnabled === false
      && benchmark.ready === false
  }, { timeout: 20_000 })
  await page.waitForFunction((requiredSamples) => {
    const benchmark = window.__SOLAR_WEBGPU_LAB_BENCHMARK__
    return Boolean(
      benchmark?.baselinePrepared
      && benchmark.ready
      && benchmark.currentConfiguration.postProcessingEnabled === false
      && benchmark.currentConfiguration.samples >= requiredSamples
    )
  }, { timeout: 90_000 }, minimumSamples)
  await recordSample(page, 2, false)

  const benchmark = await page.evaluate(() => window.__SOLAR_WEBGPU_LAB_BENCHMARK__)
  if (!benchmark) throw new Error('Benchmark diagnostics were not published')
  if (
    benchmark.coverage.webgl2Bloom !== 1
    || benchmark.coverage.webgl2Direct !== 1
    || benchmark.coverage.webgpuBloom !== 0
    || benchmark.coverage.webgpuDirect !== 0
  ) {
    throw new Error(`Unexpected benchmark coverage: ${JSON.stringify(benchmark.coverage)}`)
  }
  if (
    benchmark.sessionPersistence !== 'sessionStorage'
    || !benchmark.exportFormats.includes('json')
    || !benchmark.exportFormats.includes('clipboard')
    || benchmark.baselineCamera.join(',') !== '0,34,62'
    || benchmark.baselineTarget.join(',') !== '0,0,0'
  ) {
    throw new Error(`Benchmark protocol metadata failed: ${JSON.stringify(benchmark)}`)
  }
  for (const record of benchmark.records) {
    if (
      record.scene.starCount !== 1600
      || record.scene.solarWindCount !== 320
      || record.scene.sunFlareArcs !== 5
      || record.scene.nebulaShellCount !== 2
      || record.scene.gravityObjectCount !== 2
      || record.environment.viewport.width !== 1280
      || record.environment.viewport.height !== 720
    ) {
      throw new Error(`Benchmark record workload mismatch: ${JSON.stringify(record)}`)
    }
  }

  const storedCount = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw).length : 0
  }, storageKey)
  if (storedCount !== 2) {
    throw new Error(`Expected two session records before reload, received ${storedCount}`)
  }

  await postToggle.click()
  await page.waitForFunction(() => window.__SOLAR_WEBGPU_LAB_POST__?.enabled === true, {
    timeout: 20_000,
  })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForFunction(() => (
    window.__SOLAR_WEBGPU_LAB_BENCHMARK__?.recordCount === 2
  ), { timeout: 30_000 })

  const restored = await page.evaluate(() => window.__SOLAR_WEBGPU_LAB_BENCHMARK__)
  if (
    !restored
    || restored.coverage.webgl2Bloom !== 1
    || restored.coverage.webgl2Direct !== 1
  ) {
    throw new Error(`Benchmark session did not survive reload: ${JSON.stringify(restored)}`)
  }

  await page.click('[aria-label="Clear benchmark records"]')
  await page.waitForFunction(() => (
    window.__SOLAR_WEBGPU_LAB_BENCHMARK__?.recordCount === 0
  ), { timeout: 10_000 })

  if (failures.length > 0) {
    throw new Error(`Benchmark browser failures:\n${failures.join('\n')}`)
  }

  console.log(`[webgpu-benchmark-smoke] protocol passed ${JSON.stringify({
    minimumSamples: benchmark.minimumSamples,
    coverage: benchmark.coverage,
    restoredRecords: restored.recordCount,
    exportFormats: benchmark.exportFormats,
  })}`)
  await page.close()
}

function launchBrowser() {
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
    await runBenchmark(browser)
  } catch (error) {
    console.error('[webgpu-benchmark-smoke] failed')
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
