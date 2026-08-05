import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.TEXTURE_LIFECYCLE_SMOKE_PORT || 3123)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const CATALOGUE_IDS = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'earth-clouds',
  'saturn-ring',
]

const QUALITY_WIDTHS = {
  eco: 512,
  balanced: 1024,
  ultra: 2048,
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
    window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'true')
  })
}

async function waitForCore(page) {
  await page.goto(`${baseUrl}/?diagnostics=1&textures=ktx2`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  await page.waitForSelector('canvas', { timeout: 45_000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas')
    return Boolean(canvas?.getContext('webgl2'))
  }, { timeout: 30_000 })
  await page.waitForSelector('[aria-label="Open rendering quality controls"]', {
    timeout: 45_000,
  })
}

async function waitForSceneLoading(page, minimumRunId = 0) {
  await page.waitForFunction((previousRunId) => {
    const loading = window.__SOLAR_SCENE_LOADING__
    return Boolean(
      loading
      && loading.runId > previousRunId
      && loading.complete
      && loading.stage === 6
      && loading.transitions.length === 6
    )
  }, { timeout: 75_000 }, minimumRunId)

  const loading = await page.evaluate(() => window.__SOLAR_SCENE_LOADING__)
  if (!loading) throw new Error('Scene-loading diagnostics were unavailable')
  return loading
}

function assertTierIsolation(lifecycle, quality, width) {
  const expectedFallbackFragment = `-${width}.webp`
  const expectedKtx2Fragment = `/ktx2/${width}/`

  if (lifecycle.activeQuality !== quality || lifecycle.activeTierWidth !== width) {
    throw new Error(
      `Lifecycle reported ${lifecycle.activeQuality}/${lifecycle.activeTierWidth}; expected ${quality}/${width}`
    )
  }
  if (lifecycle.rendererResourceCount !== 1) {
    throw new Error(
      `Expected one active renderer texture resource set; received ${lifecycle.rendererResourceCount}`
    )
  }
  if (lifecycle.ktx2PendingKeys.length !== 0) {
    throw new Error(`KTX2 loads remained pending: ${lifecycle.ktx2PendingKeys.join(', ')}`)
  }
  if (lifecycle.fallbackCacheKeys.length !== CATALOGUE_IDS.length) {
    throw new Error(
      `Expected ${CATALOGUE_IDS.length} WebP cache entries; received ${lifecycle.fallbackCacheKeys.length}`
    )
  }
  if (lifecycle.ktx2ResidentKeys.length !== CATALOGUE_IDS.length) {
    throw new Error(
      `Expected ${CATALOGUE_IDS.length} resident KTX2 entries; received ${lifecycle.ktx2ResidentKeys.length}`
    )
  }

  const wrongFallbackTiers = lifecycle.fallbackCacheKeys.filter(
    (key) => !key.includes(expectedFallbackFragment)
  )
  if (wrongFallbackTiers.length > 0) {
    throw new Error(
      `${quality} retained fallback tiers from another profile: ${wrongFallbackTiers.join(', ')}`
    )
  }

  const wrongKtx2Tiers = lifecycle.ktx2ResidentKeys.filter(
    (key) => !key.includes(expectedKtx2Fragment)
  )
  if (wrongKtx2Tiers.length > 0) {
    throw new Error(
      `${quality} retained compressed tiers from another profile: ${wrongKtx2Tiers.join(', ')}`
    )
  }

  if (lifecycle.fallbackGpuResidentKeys.length !== 0) {
    throw new Error(
      `Compressed ${quality} session retained WebP GPU allocations: ${lifecycle.fallbackGpuResidentKeys.join(', ')}`
    )
  }
  if (lifecycle.fallbackGpuReleasedKeys.length !== CATALOGUE_IDS.length) {
    throw new Error(
      `Expected every active fallback to be GPU-released; received ${lifecycle.fallbackGpuReleasedKeys.length}`
    )
  }
}

async function waitForTextureTier(page, quality) {
  const width = QUALITY_WIDTHS[quality]

  await page.waitForFunction((expectedIds, expectedQuality, expectedWidth) => {
    const runtime = window.__SOLAR_TEXTURE_DIAGNOSTICS__
    const lifecycle = window.__SOLAR_TEXTURE_LIFECYCLE__
    return Boolean(
      runtime
      && lifecycle
      && runtime.enabled
      && runtime.backend === 'ktx2'
      && runtime.quality === expectedQuality
      && runtime.tierWidth === expectedWidth
      && runtime.failedIds.length === 0
      && expectedIds.every((id) => runtime.requestedIds.includes(id))
      && expectedIds.every((id) => runtime.loadedIds.includes(id))
      && lifecycle.activeQuality === expectedQuality
      && lifecycle.activeTierWidth === expectedWidth
      && lifecycle.rendererResourceCount === 1
      && lifecycle.ktx2PendingKeys.length === 0
      && lifecycle.ktx2ResidentKeys.length === expectedIds.length
      && lifecycle.fallbackCacheKeys.length === expectedIds.length
    )
  }, { timeout: 90_000 }, CATALOGUE_IDS, quality, width)

  const result = await page.evaluate(() => ({
    runtime: window.__SOLAR_TEXTURE_DIAGNOSTICS__,
    lifecycle: window.__SOLAR_TEXTURE_LIFECYCLE__,
  }))
  if (!result.runtime || !result.lifecycle) {
    throw new Error(`Texture diagnostics were unavailable for ${quality}`)
  }

  assertTierIsolation(result.lifecycle, quality, width)
  return result
}

async function waitForRendererDiagnostics(page, previousTimestamp = 0) {
  await page.waitForFunction((timestamp) => {
    const diagnostics = window.__SOLAR_EXPLORER_DIAGNOSTICS__
    return Boolean(diagnostics?.timestamp && diagnostics.timestamp > timestamp)
  }, { timeout: 20_000 }, previousTimestamp)

  const diagnostics = await page.evaluate(() => window.__SOLAR_EXPLORER_DIAGNOSTICS__)
  if (!diagnostics) throw new Error('Renderer diagnostics were unavailable')
  return diagnostics
}

async function selectQuality(page, label, quality) {
  const selected = await page.evaluate((buttonLabel) => {
    const dock = document.querySelector('[data-texture-backend]')
    const button = [...(dock?.querySelectorAll('button') ?? [])].find((candidate) => {
      const text = candidate.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      return !candidate.disabled && text.startsWith(buttonLabel)
    })
    if (!(button instanceof HTMLButtonElement)) return false
    button.click()
    return true
  }, label)

  if (!selected) throw new Error(`Could not select ${label}`)

  await page.waitForFunction((expected) => (
    window.localStorage.getItem('solar-explorer-quality-preset-v1') === expected
  ), { timeout: 10_000 }, quality)
}

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((buttonText) => {
    const button = [...document.querySelectorAll('button')].find((candidate) => {
      const label = candidate.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      return !candidate.disabled && label.includes(buttonText)
    })
    if (!(button instanceof HTMLButtonElement)) return false
    button.click()
    return true
  }, text)

  if (!clicked) throw new Error(`Could not find enabled button containing “${text}”`)
}

async function runTextureLifecycle(browser) {
  const page = await browser.newPage()
  await configurePage(page)
  const pageErrors = collectPageErrors(page)

  await waitForCore(page)
  const initialLoading = await waitForSceneLoading(page)
  await waitForTextureTier(page, 'eco')
  const baselineRenderer = await waitForRendererDiagnostics(page)

  await page.click('[aria-label="Open rendering quality controls"]')

  await selectQuality(page, 'Balanced', 'balanced')
  await waitForTextureTier(page, 'balanced')

  await selectQuality(page, 'Ultra', 'ultra')
  await waitForTextureTier(page, 'ultra')

  await selectQuality(page, 'Eco', 'eco')
  const finalTier = await waitForTextureTier(page, 'eco')
  const finalRenderer = await waitForRendererDiagnostics(
    page,
    baselineRenderer.timestamp
  )

  if (finalRenderer.textures !== baselineRenderer.textures) {
    throw new Error(
      `Texture residency did not return to baseline: ${baselineRenderer.textures} → ${finalRenderer.textures}`
    )
  }
  if (finalTier.lifecycle.counters.fallbackCacheEvictions < 20) {
    throw new Error(
      `Only ${finalTier.lifecycle.counters.fallbackCacheEvictions} fallback cache entries were evicted during tier cycling`
    )
  }
  if (finalTier.lifecycle.counters.ktx2Disposals < 20) {
    throw new Error(
      `Only ${finalTier.lifecycle.counters.ktx2Disposals} compressed textures were disposed during tier cycling`
    )
  }

  await page.click('[aria-label="Close rendering quality controls"]')

  const loaderDisposalsBeforeRecovery = finalTier.lifecycle.counters.loaderDisposals
  await page.evaluate(() => {
    window.dispatchEvent(new Event('solar-explorer:webgl-context-lost'))
  })
  await page.waitForFunction(() => (
    document.body.textContent?.includes('The WebGL context was lost')
  ))
  await clickButtonByText(page, 'Rebuild in Eco')

  await page.waitForFunction((previousRunId) => {
    const canvas = document.querySelector('canvas')
    const loading = window.__SOLAR_SCENE_LOADING__
    return Boolean(
      canvas?.getContext('webgl2')
      && loading
      && loading.runId > previousRunId
    )
  }, { timeout: 30_000 }, initialLoading.runId)

  await waitForSceneLoading(page, initialLoading.runId)
  const recoveredTier = await waitForTextureTier(page, 'eco')
  const recoveredRenderer = await waitForRendererDiagnostics(
    page,
    finalRenderer.timestamp
  )

  if (recoveredTier.lifecycle.counters.loaderDisposals <= loaderDisposalsBeforeRecovery) {
    throw new Error('Renderer reconstruction did not dispose the previous KTX2 loader')
  }
  if (recoveredRenderer.textures !== baselineRenderer.textures) {
    throw new Error(
      `Recovered renderer texture residency was ${recoveredRenderer.textures}; expected baseline ${baselineRenderer.textures}`
    )
  }

  if (pageErrors.length > 0) {
    throw new Error(`Texture lifecycle page errors:\n${pageErrors.join('\n')}`)
  }

  console.log(
    `[texture-lifecycle-smoke] Eco → Balanced → Ultra → Eco returned to ${baselineRenderer.textures} textures`
  )
  console.log(
    `[texture-lifecycle-smoke] evictions=${recoveredTier.lifecycle.counters.fallbackCacheEvictions} ktx2Disposals=${recoveredTier.lifecycle.counters.ktx2Disposals} loaderDisposals=${recoveredTier.lifecycle.counters.loaderDisposals}`
  )

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

    await runTextureLifecycle(browser)
  } catch (error) {
    console.error('[texture-lifecycle-smoke] failed')
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
