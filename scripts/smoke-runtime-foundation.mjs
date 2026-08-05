import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.RUNTIME_SMOKE_PORT || 3121)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const EXPECTED_SCENE_STAGES = [1, 2, 3, 4, 5, 6]
const PRESERVED_EXPLORE_SYSTEMS = [
  'nebula',
  'near-earth-objects',
  'kuiper-belt',
  'oort-cloud',
  'trojans',
  'centaurs',
  'scattered-disc',
  'phenomena',
  'solar-wind',
  'meteor-shower',
  'zodiacal-light',
]
const BALANCED_ACTIVE_SYSTEMS = [
  'nebula',
  'asteroid-belt',
  'near-earth-objects',
  'kuiper-belt',
  'trojans',
  'centaurs',
  'phenomena',
  'solar-wind',
  'meteor-shower',
]
const BALANCED_SUPPRESSED_SYSTEMS = [
  'oort-cloud',
  'scattered-disc',
  'zodiacal-light',
]
const ECO_SUPPRESSED_SYSTEMS = [...PRESERVED_EXPLORE_SYSTEMS]
const ULTRA_ACTIVE_SYSTEMS = [
  'asteroid-belt',
  ...PRESERVED_EXPLORE_SYSTEMS,
]

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

async function configureDesktopAutoPage(page) {
  await page.setViewport({
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  })
  await page.evaluateOnNewDocument(() => {
    Object.defineProperties(Navigator.prototype, {
      hardwareConcurrency: {
        configurable: true,
        get: () => 8,
      },
      deviceMemory: {
        configurable: true,
        get: () => 8,
      },
      connection: {
        configurable: true,
        get: () => ({ saveData: false, effectiveType: '4g' }),
      },
    })

    window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
    window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
    window.localStorage.removeItem('solar-explorer-quality-preset-v1')
    window.localStorage.removeItem('solar-explorer-performance-defaults-v1')
    window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'false')
  })
}

async function configureDesktopPage(page) {
  await page.setViewport({
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  })
  await page.evaluateOnNewDocument(() => {
    if (!window.sessionStorage.getItem('runtime-smoke-desktop-initialized')) {
      window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
      window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
      window.localStorage.setItem('solar-explorer-quality-preset-v1', 'ultra')
      window.localStorage.removeItem('solar-explorer-performance-defaults-v1')
      window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'false')
      window.sessionStorage.setItem('runtime-smoke-desktop-initialized', 'true')
    }
  })
}

async function configurePhonePage(page) {
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })
  await page.evaluateOnNewDocument(() => {
    window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
    window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
    window.localStorage.removeItem('solar-explorer-quality-preset-v1')
    window.localStorage.removeItem('solar-explorer-performance-defaults-v1')
    window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'false')
  })
}

async function waitForCore(page) {
  await page.goto(`${baseUrl}/?diagnostics=1&textures=webp`, {
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
  await page.waitForFunction(() => Boolean(window.__SOLAR_PERFORMANCE_POLICY__), {
    timeout: 20_000,
  })
}

async function waitForMeasuredSceneLoading(page, minimumRunId = 0) {
  await page.waitForFunction((previousRunId) => {
    const diagnostics = window.__SOLAR_SCENE_LOADING__
    return Boolean(
      diagnostics
      && diagnostics.runId > previousRunId
      && diagnostics.firstFrameMs !== null
      && diagnostics.complete
      && diagnostics.stage === 6
      && diagnostics.waitingFor === 'complete'
      && diagnostics.transitions.length === 6
    )
  }, { timeout: 45_000 }, minimumRunId)

  const diagnostics = await page.evaluate(() => window.__SOLAR_SCENE_LOADING__)
  if (!diagnostics) throw new Error('Measured scene-loading diagnostics were unavailable')

  const stages = diagnostics.transitions.map((transition) => transition.stage)
  if (JSON.stringify(stages) !== JSON.stringify(EXPECTED_SCENE_STAGES)) {
    throw new Error(`Scene scheduler advanced out of order: ${JSON.stringify(stages)}`)
  }

  for (const [index, transition] of diagnostics.transitions.entries()) {
    if (transition.sampleCount < 6) {
      throw new Error(
        `Scene stage ${transition.stage} used only ${transition.sampleCount} fresh frames`
      )
    }
    if (!Number.isFinite(transition.averageFrameMs) || transition.averageFrameMs <= 0) {
      throw new Error(`Scene stage ${transition.stage} recorded an invalid average frame time`)
    }
    if (!Number.isFinite(transition.p95FrameMs) || transition.p95FrameMs <= 0) {
      throw new Error(`Scene stage ${transition.stage} recorded an invalid P95 frame time`)
    }

    const previous = diagnostics.transitions[index - 1]
    if (previous && transition.atMs - previous.atMs < 40) {
      throw new Error(
        `Scene stages ${previous.stage} and ${transition.stage} were admitted only ${(
          transition.atMs - previous.atMs
        ).toFixed(1)}ms apart`
      )
    }
  }

  console.log(`[runtime-smoke] measured scene loading ${JSON.stringify(diagnostics)}`)
  return diagnostics
}

async function getPerformancePolicy(page) {
  await page.waitForFunction(() => Boolean(window.__SOLAR_PERFORMANCE_POLICY__), {
    timeout: 15_000,
  })
  const policy = await page.evaluate(() => window.__SOLAR_PERFORMANCE_POLICY__)
  if (!policy) throw new Error('Performance policy diagnostics were unavailable')
  return policy
}

async function waitForQualityPolicy(page, quality) {
  await page.waitForFunction((expectedQuality) => {
    const policy = window.__SOLAR_PERFORMANCE_POLICY__
    return policy?.effectiveQuality === expectedQuality
  }, { timeout: 15_000 }, quality)
  return getPerformancePolicy(page)
}

async function waitForFreshRendererDiagnostics(page, previousTimestamp = 0) {
  await page.waitForFunction((timestamp) => (
    Boolean(
      window.__SOLAR_EXPLORER_DIAGNOSTICS__?.timestamp
      && window.__SOLAR_EXPLORER_DIAGNOSTICS__.timestamp > timestamp
    )
  ), { timeout: 20_000 }, previousTimestamp)

  const diagnostics = await page.evaluate(() => window.__SOLAR_EXPLORER_DIAGNOSTICS__)
  if (!diagnostics) throw new Error('Renderer diagnostics were unavailable')
  return diagnostics
}

function assertContainsAll(actual, expected, label) {
  const missing = expected.filter((entry) => !actual.includes(entry))
  if (missing.length > 0) {
    throw new Error(`${label} is missing: ${missing.join(', ')}`)
  }
}

function assertContainsNone(actual, blocked, label) {
  const present = blocked.filter((entry) => actual.includes(entry))
  if (present.length > 0) {
    throw new Error(`${label} unexpectedly contains: ${present.join(', ')}`)
  }
}

async function assertDesktopAutoBaseline(page) {
  const policy = await getPerformancePolicy(page)
  if (policy.preset !== 'auto') {
    throw new Error(`Desktop baseline did not start in Auto; received ${policy.preset}`)
  }
  if (policy.autoBaseline !== 'balanced') {
    throw new Error(`Desktop Auto baseline was ${policy.autoBaseline}; expected balanced`)
  }
  if (policy.autoCeiling !== 'ultra') {
    throw new Error(`Desktop Auto ceiling was ${policy.autoCeiling}; expected ultra`)
  }
  if (!policy.schedulerComplete && policy.effectiveQuality === 'ultra') {
    throw new Error('Auto promoted to Ultra before measured scene loading completed')
  }

  console.log(`[runtime-smoke] conservative desktop Auto policy ${JSON.stringify(policy)}`)
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

async function selectQuality(page, label) {
  const selected = await page.evaluate((qualityLabel) => {
    const dock = document.querySelector('[data-texture-backend]')
    const button = [...(dock?.querySelectorAll('button') ?? [])].find((candidate) => {
      const text = candidate.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      return !candidate.disabled && text.startsWith(qualityLabel)
    })
    if (!(button instanceof HTMLButtonElement)) return false
    button.click()
    return true
  }, label)

  if (!selected) throw new Error(`Could not select the ${label} quality profile`)

  await page.waitForFunction((expected) => {
    const trigger = document.querySelector('[aria-label="Open rendering quality controls"]')
    return window.localStorage.getItem('solar-explorer-quality-preset-v1') === expected.toLowerCase()
      && trigger?.textContent?.includes(expected.toUpperCase())
  }, { timeout: 10_000 }, label)
}

async function assertQualityTransitions(page) {
  await page.click('[aria-label="Open rendering quality controls"]')

  await selectQuality(page, 'Balanced')
  const balancedPolicy = await waitForQualityPolicy(page, 'balanced')
  assertContainsAll(
    balancedPolicy.activeSystems,
    BALANCED_ACTIVE_SYSTEMS,
    'Balanced active systems'
  )
  assertContainsAll(
    balancedPolicy.suppressedSystems,
    BALANCED_SUPPRESSED_SYSTEMS,
    'Balanced suppressed systems'
  )
  assertContainsAll(
    balancedPolicy.requestedSystems,
    PRESERVED_EXPLORE_SYSTEMS,
    'Balanced requested preferences'
  )

  const beforeUltra = await waitForFreshRendererDiagnostics(page)
  await selectQuality(page, 'Ultra')
  const ultraPolicy = await waitForQualityPolicy(page, 'ultra')
  assertContainsAll(ultraPolicy.activeSystems, ULTRA_ACTIVE_SYSTEMS, 'Ultra active systems')
  assertContainsNone(
    ultraPolicy.suppressedSystems,
    PRESERVED_EXPLORE_SYSTEMS,
    'Ultra suppressed systems'
  )
  const ultraDiagnostics = await waitForFreshRendererDiagnostics(
    page,
    beforeUltra.timestamp
  )

  await selectQuality(page, 'Eco')
  const ecoPolicy = await waitForQualityPolicy(page, 'eco')
  assertContainsAll(
    ecoPolicy.requestedSystems,
    PRESERVED_EXPLORE_SYSTEMS,
    'Eco preserved requested preferences'
  )
  assertContainsAll(
    ecoPolicy.suppressedSystems,
    ECO_SUPPRESSED_SYSTEMS,
    'Eco suppressed systems'
  )
  assertContainsNone(
    ecoPolicy.activeSystems,
    ECO_SUPPRESSED_SYSTEMS,
    'Eco active systems'
  )
  assertContainsAll(ecoPolicy.activeSystems, ['asteroid-belt'], 'Eco safe systems')
  const ecoDiagnostics = await waitForFreshRendererDiagnostics(
    page,
    ultraDiagnostics.timestamp
  )

  if (ecoDiagnostics.sceneObjects >= ultraDiagnostics.sceneObjects) {
    throw new Error(
      `Eco retained ${ecoDiagnostics.sceneObjects} scene objects; Ultra had ${ultraDiagnostics.sceneObjects}`
    )
  }
  if (ecoDiagnostics.drawCalls >= ultraDiagnostics.drawCalls) {
    throw new Error(
      `Eco retained ${ecoDiagnostics.drawCalls} draw calls; Ultra had ${ultraDiagnostics.drawCalls}`
    )
  }

  await page.click('[aria-label="Close rendering quality controls"]')

  const preset = await page.evaluate(() => (
    window.localStorage.getItem('solar-explorer-quality-preset-v1')
  ))
  if (preset !== 'eco') {
    throw new Error(`Explicit quality transition did not persist Eco; received ${preset}`)
  }

  console.log(
    `[runtime-smoke] workload ceiling Ultra ${ultraDiagnostics.sceneObjects}/${ultraDiagnostics.drawCalls} → Eco ${ecoDiagnostics.sceneObjects}/${ecoDiagnostics.drawCalls}`
  )
}

async function assertEcoWorkloadPolicy(page) {
  const policy = await waitForQualityPolicy(page, 'eco')
  assertContainsAll(
    policy.requestedSystems,
    PRESERVED_EXPLORE_SYSTEMS,
    'Eco requested preferences after recovery'
  )
  assertContainsAll(
    policy.suppressedSystems,
    ECO_SUPPRESSED_SYSTEMS,
    'Eco suppression after recovery'
  )
  assertContainsNone(
    policy.activeSystems,
    ECO_SUPPRESSED_SYSTEMS,
    'Eco active workload after recovery'
  )
}

async function assertEcoRecovery(page, previousSchedulerRunId) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('solar-explorer:webgl-context-lost'))
  })
  await page.waitForFunction(() => document.body.textContent?.includes('The WebGL context was lost'))
  await clickButtonByText(page, 'Rebuild in Eco')

  await page.waitForFunction((previousRunId) => {
    const canvas = document.querySelector('canvas')
    const trigger = document.querySelector('[aria-label="Open rendering quality controls"]')
    const loading = window.__SOLAR_SCENE_LOADING__
    return !document.body.textContent?.includes('The WebGL context was lost')
      && Boolean(canvas?.getContext('webgl2'))
      && window.localStorage.getItem('solar-explorer-quality-preset-v1') === 'eco'
      && trigger?.textContent?.includes('ECO')
      && Boolean(loading && loading.runId > previousRunId)
  }, { timeout: 30_000 }, previousSchedulerRunId)

  const recoveryLoading = await waitForMeasuredSceneLoading(page, previousSchedulerRunId)
  await assertEcoWorkloadPolicy(page)

  const diagnostics = await waitForFreshRendererDiagnostics(page)
  if (diagnostics.textures > 22) {
    throw new Error(`Eco recovery retained ${diagnostics.textures} textures; expected no more than 22`)
  }
  if (diagnostics.sceneObjects > 6_000) {
    throw new Error(`Eco recovery retained ${diagnostics.sceneObjects} scene objects; expected no more than 6000`)
  }

  return recoveryLoading
}

async function assertEcoPersistsAcrossReload(page) {
  await page.reload({ waitUntil: 'networkidle2', timeout: 75_000 })
  await page.waitForSelector('[aria-label="Open rendering quality controls"]', {
    timeout: 45_000,
  })
  await page.waitForFunction(() => {
    const trigger = document.querySelector('[aria-label="Open rendering quality controls"]')
    return window.localStorage.getItem('solar-explorer-quality-preset-v1') === 'eco'
      && trigger?.textContent?.includes('ECO')
  }, { timeout: 15_000 })
  await waitForMeasuredSceneLoading(page)
  await assertEcoWorkloadPolicy(page)
}

async function runDesktopAutoBaseline(browser) {
  const page = await browser.newPage()
  await configureDesktopAutoPage(page)
  const pageErrors = collectPageErrors(page)

  await waitForCore(page)
  await assertDesktopAutoBaseline(page)

  if (pageErrors.length > 0) {
    throw new Error(`Desktop Auto baseline page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
}

async function runDesktopTransitions(browser) {
  const page = await browser.newPage()
  await configureDesktopPage(page)
  const pageErrors = collectPageErrors(page)

  await waitForCore(page)
  const initialLoading = await waitForMeasuredSceneLoading(page)
  await assertQualityTransitions(page)
  await assertEcoRecovery(page, initialLoading.runId)
  await assertEcoPersistsAcrossReload(page)

  if (pageErrors.length > 0) {
    throw new Error(`Runtime transition page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[runtime-smoke] measured loading, workload ceilings, Eco recovery, and reload persistence passed')
}

async function runPhoneAutoBaseline(browser) {
  const page = await browser.newPage()
  await configurePhonePage(page)
  const pageErrors = collectPageErrors(page)

  await waitForCore(page)
  await page.waitForFunction(() => {
    const trigger = document.querySelector('[aria-label="Open rendering quality controls"]')
    const policy = window.__SOLAR_PERFORMANCE_POLICY__
    const label = trigger?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    return label.includes('AUTO')
      && label.includes('ECO')
      && policy?.autoBaseline === 'eco'
      && policy.autoCeiling === 'balanced'
  }, { timeout: 15_000 })
  await waitForMeasuredSceneLoading(page)
  await assertEcoWorkloadPolicy(page)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 2) {
    throw new Error(`Phone Auto baseline introduced ${overflow}px of horizontal overflow`)
  }

  if (pageErrors.length > 0) {
    throw new Error(`Phone Auto baseline page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[runtime-smoke] phone Auto began in Eco, respected its ceiling, and suppressed heavy workload')
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

    await runDesktopAutoBaseline(browser)
    await runDesktopTransitions(browser)
    await runPhoneAutoBaseline(browser)
  } catch (error) {
    console.error('[runtime-smoke] failed')
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
