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
      window.localStorage.setItem('solar-explorer-performance-defaults-v1', 'ultra')
      window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'false')
      window.sessionStorage.setItem('runtime-smoke-desktop-initialized', 'true')
    }
    window.sessionStorage.setItem('solar-explorer-scene-warmup-v1', 'complete')
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
    window.sessionStorage.setItem('solar-explorer-scene-warmup-v1', 'complete')
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
  await selectQuality(page, 'Ultra')
  await selectQuality(page, 'Eco')
  await page.click('[aria-label="Close rendering quality controls"]')

  const preset = await page.evaluate(() => (
    window.localStorage.getItem('solar-explorer-quality-preset-v1')
  ))
  if (preset !== 'eco') {
    throw new Error(`Explicit quality transition did not persist Eco; received ${preset}`)
  }
}

async function assertEcoRecovery(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('solar-explorer:webgl-context-lost'))
  })
  await page.waitForFunction(() => document.body.textContent?.includes('The WebGL context was lost'))
  await clickButtonByText(page, 'Rebuild in Eco')

  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas')
    const trigger = document.querySelector('[aria-label="Open rendering quality controls"]')
    return !document.body.textContent?.includes('The WebGL context was lost')
      && Boolean(canvas?.getContext('webgl2'))
      && window.localStorage.getItem('solar-explorer-quality-preset-v1') === 'eco'
      && trigger?.textContent?.includes('ECO')
  }, { timeout: 30_000 })

  await page.waitForFunction(() => Boolean(window.__SOLAR_EXPLORER_DIAGNOSTICS__?.timestamp), {
    timeout: 20_000,
  })
  const diagnostics = await page.evaluate(() => window.__SOLAR_EXPLORER_DIAGNOSTICS__)
  if (!diagnostics) throw new Error('Renderer diagnostics were unavailable after Eco recovery')
  if (diagnostics.textures > 22) {
    throw new Error(`Eco recovery retained ${diagnostics.textures} textures; expected no more than 22`)
  }
  if (diagnostics.sceneObjects > 6_000) {
    throw new Error(`Eco recovery retained ${diagnostics.sceneObjects} scene objects; expected no more than 6000`)
  }
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
}

async function runDesktopTransitions(browser) {
  const page = await browser.newPage()
  await configureDesktopPage(page)
  const pageErrors = collectPageErrors(page)

  await waitForCore(page)
  await assertQualityTransitions(page)
  await assertEcoRecovery(page)
  await assertEcoPersistsAcrossReload(page)

  if (pageErrors.length > 0) {
    throw new Error(`Runtime transition page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[runtime-smoke] explicit quality transitions, Eco recovery, and reload persistence passed')
}

async function runPhoneAutoBaseline(browser) {
  const page = await browser.newPage()
  await configurePhonePage(page)
  const pageErrors = collectPageErrors(page)

  await waitForCore(page)
  await page.waitForFunction(() => {
    const trigger = document.querySelector('[aria-label="Open rendering quality controls"]')
    const label = trigger?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    return label.includes('AUTO') && label.includes('ECO')
  }, { timeout: 15_000 })

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 2) {
    throw new Error(`Phone Auto baseline introduced ${overflow}px of horizontal overflow`)
  }

  if (pageErrors.length > 0) {
    throw new Error(`Phone Auto baseline page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[runtime-smoke] phone Auto baseline selected Eco without horizontal overflow')
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
