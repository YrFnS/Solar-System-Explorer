import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.SMOKE_PORT || 3117)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')

const RENDER_BUDGETS = {
  drawCalls: 700,
  triangles: 10_000_000,
  geometries: 1_000,
  textures: 250,
  programs: 180,
  sceneObjects: 6_000,
}

const KTX2_PILOT_IDS = ['earth', 'moon', 'earth-clouds', 'saturn-ring']
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function prepareStandaloneAssets() {
  await rm(path.join(standaloneRoot, 'public'), { recursive: true, force: true })
  await rm(path.join(standaloneNextRoot, 'static'), { recursive: true, force: true })
  await mkdir(standaloneNextRoot, { recursive: true })
  await cp(path.resolve('public'), path.join(standaloneRoot, 'public'), { recursive: true })
  await cp(path.resolve('.next', 'static'), path.join(standaloneNextRoot, 'static'), { recursive: true })
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

async function configurePage(page, viewport) {
  await page.setViewport(viewport)
  await page.evaluateOnNewDocument(() => {
    window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
    window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
    window.localStorage.setItem('solar-explorer-quality-preset-v1', 'eco')
    window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'true')
    window.sessionStorage.setItem('solar-explorer-scene-warmup-v1', 'complete')
  })
}

function collectPageErrors(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function waitForCore(page, route = '/?diagnostics=1&textures=ktx2') {
  await page.goto(`${baseUrl}${route}`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  await page.waitForSelector('canvas', { timeout: 45_000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas')
    return Boolean(canvas?.getContext('webgl2'))
  }, { timeout: 30_000 })
  await page.waitForSelector('[aria-label="Search celestial bodies"]', { timeout: 45_000 })
  await page.waitForSelector('[aria-label="Navigate to Earth"]', { timeout: 45_000 })
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

async function assertAccessibleSurface(page, label) {
  const issues = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.visibility !== 'hidden'
        && style.display !== 'none'
        && rect.width > 0
        && rect.height > 0
    }

    const unnamedButtons = [...document.querySelectorAll('button')]
      .filter(isVisible)
      .filter((button) => {
        const text = button.textContent?.trim()
        return !text
          && !button.getAttribute('aria-label')
          && !button.getAttribute('title')
      })
      .map((button) => button.outerHTML.slice(0, 180))

    const unnamedDialogs = [...document.querySelectorAll('[role="dialog"]')]
      .filter(isVisible)
      .filter((dialog) => (
        !dialog.getAttribute('aria-label')
        && !dialog.getAttribute('aria-labelledby')
      ))
      .map((dialog) => dialog.outerHTML.slice(0, 180))

    return { unnamedButtons, unnamedDialogs }
  })

  if (issues.unnamedButtons.length || issues.unnamedDialogs.length) {
    throw new Error(
      `${label} accessibility names failed:\n${JSON.stringify(issues, null, 2)}`
    )
  }
}

async function assertRendererBudget(page) {
  await delay(1_700)
  await page.waitForFunction(() => (
    Boolean(window.__SOLAR_EXPLORER_DIAGNOSTICS__?.timestamp)
  ), { timeout: 20_000 })

  const metrics = await page.evaluate(() => window.__SOLAR_EXPLORER_DIAGNOSTICS__)
  if (!metrics) throw new Error('Renderer diagnostics were not published')

  const failures = Object.entries(RENDER_BUDGETS)
    .filter(([metric, limit]) => metrics[metric] > limit)
    .map(([metric, limit]) => `${metric}=${metrics[metric]} exceeds ${limit}`)

  console.log(`[ui-smoke] renderer diagnostics ${JSON.stringify(metrics)}`)
  if (failures.length) {
    throw new Error(`Renderer budget failed:\n${failures.join('\n')}`)
  }
}

async function assertKtx2Pilot(page) {
  await page.waitForFunction((expectedIds) => {
    const diagnostics = window.__SOLAR_TEXTURE_DIAGNOSTICS__
    return Boolean(
      diagnostics?.enabled
      && diagnostics.backend === 'ktx2'
      && diagnostics.failedIds.length === 0
      && expectedIds.every((id) => diagnostics.loadedIds.includes(id))
      && diagnostics.formats.length > 0
    )
  }, { timeout: 45_000 }, KTX2_PILOT_IDS)

  const diagnostics = await page.evaluate(() => window.__SOLAR_TEXTURE_DIAGNOSTICS__)
  console.log(`[ui-smoke] KTX2 diagnostics ${JSON.stringify(diagnostics)}`)
}

async function assertTextureBackendToggle(page) {
  await page.click('[aria-label="Open rendering quality controls"]')
  const toggle = await page.waitForSelector(
    '[aria-label="Use KTX2 GPU-compressed textures"]',
    { timeout: 15_000 }
  )

  const initiallyChecked = await toggle.evaluate((element) => element.checked)
  if (!initiallyChecked) throw new Error('KTX2 toggle was not enabled after a successful pilot load')

  await toggle.click()
  await page.waitForFunction(() => {
    const diagnostics = window.__SOLAR_TEXTURE_DIAGNOSTICS__
    const dock = document.querySelector('[data-texture-backend]')
    return diagnostics?.enabled === false
      && diagnostics.backend === 'webp'
      && dock?.getAttribute('data-texture-backend') === 'webp'
  }, { timeout: 10_000 })

  await toggle.click()
  await page.waitForFunction(() => {
    const diagnostics = window.__SOLAR_TEXTURE_DIAGNOSTICS__
    const dock = document.querySelector('[data-texture-backend]')
    return diagnostics?.enabled === true
      && diagnostics.backend === 'ktx2'
      && dock?.getAttribute('data-texture-backend') === 'ktx2'
  }, { timeout: 10_000 })

  await page.click('[aria-label="Close rendering quality controls"]')
}

async function runDesktop(browser) {
  const page = await browser.newPage()
  await configurePage(page, {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  })
  const pageErrors = collectPageErrors(page)

  await waitForCore(page)
  await assertKtx2Pilot(page)
  await assertRendererBudget(page)
  await assertAccessibleSurface(page, 'desktop overview')

  await page.click('[aria-label="Search celestial bodies"]')
  const searchInput = await page.waitForSelector(
    'input[placeholder*="Search planets"]',
    { timeout: 15_000 }
  )
  await searchInput.type('Earth')
  await page.waitForFunction(() => document.body.textContent?.includes('Terrestrial Planet'))
  await assertAccessibleSurface(page, 'search dialog')
  await page.keyboard.press('Escape')

  await page.click('[aria-label="Navigate to Earth"]')
  await page.waitForFunction(() => {
    const text = document.body.textContent || ''
    return text.includes('Selected object')
      && text.includes('Earth')
      && text.includes('Sun distance')
  }, { timeout: 20_000 })

  await assertTextureBackendToggle(page)

  await page.keyboard.press('2')
  await page.waitForFunction(() => document.body.textContent?.includes('Scientific'))
  await page.keyboard.press('3')
  await page.waitForFunction(() => document.body.textContent?.includes('Sandbox'))
  await page.keyboard.press('1')
  await page.waitForFunction(() => document.body.textContent?.includes('Explore'))

  await page.click('[aria-label="Enter screenshot mode"]')
  await page.waitForFunction(() => document.body.textContent?.includes('Clean capture mode'))
  await clickButtonByText(page, 'Capture')
  await page.waitForFunction(() => document.body.textContent?.includes('Saved'), {
    timeout: 20_000,
  })
  await page.click('[aria-label="Exit screenshot mode"]')
  await page.waitForSelector('[aria-label^="Open screenshot gallery"]', {
    timeout: 20_000,
  })

  await page.evaluate(() => {
    window.dispatchEvent(new Event('solar-explorer:webgl-context-lost'))
  })
  await page.waitForFunction(() => document.body.textContent?.includes('The WebGL context was lost'))
  await clickButtonByText(page, 'Rebuild in Eco')
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas')
    return !document.body.textContent?.includes('The WebGL context was lost')
      && Boolean(canvas?.getContext('webgl2'))
  }, { timeout: 30_000 })

  await assertAccessibleSurface(page, 'desktop final state')

  if (pageErrors.length > 0) {
    throw new Error(`Desktop page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[ui-smoke] desktop KTX2, search, modes, screenshots, recovery, and accessibility passed')
}

async function runWebpFallback(browser) {
  const page = await browser.newPage()
  await configurePage(page, {
    width: 1024,
    height: 640,
    deviceScaleFactor: 1,
  })
  const pageErrors = collectPageErrors(page)

  await waitForCore(page, '/?diagnostics=1&textures=webp')
  await page.waitForFunction(() => {
    const diagnostics = window.__SOLAR_TEXTURE_DIAGNOSTICS__
    return diagnostics?.enabled === false
      && diagnostics.backend === 'webp'
      && diagnostics.loadedIds.length === 0
  }, { timeout: 15_000 })

  await page.click('[aria-label="Navigate to Earth"]')
  await page.waitForFunction(() => {
    const text = document.body.textContent || ''
    return text.includes('Selected object') && text.includes('Earth')
  }, { timeout: 20_000 })

  if (pageErrors.length > 0) {
    throw new Error(`WebP fallback page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[ui-smoke] explicit WebP fallback passed')
}

async function runMobile(browser) {
  const page = await browser.newPage()
  await configurePage(page, {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })
  const pageErrors = collectPageErrors(page)

  await waitForCore(page)
  await page.click('[aria-label="Search celestial bodies"]')
  const searchInput = await page.waitForSelector(
    'input[placeholder*="Search planets"]',
    { timeout: 15_000 }
  )
  await searchInput.type('Mars')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => {
    const text = document.body.textContent || ''
    return text.includes('Selected object') && text.includes('Mars')
  }, { timeout: 20_000 })

  const mobileLayout = await page.evaluate(() => {
    const inspector = [...document.querySelectorAll('aside')]
      .find((element) => element.textContent?.includes('Selected object'))
    const navigator = document.querySelector('[aria-label="Primary celestial navigation"]')
    const inspectorRect = inspector?.getBoundingClientRect()
    const navigatorRect = navigator?.getBoundingClientRect()

    return {
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      inspectorVisible: Boolean(
        inspectorRect
        && inspectorRect.left >= -1
        && inspectorRect.right <= window.innerWidth + 1
        && inspectorRect.bottom <= window.innerHeight + 1
      ),
      navigatorVisible: Boolean(
        navigatorRect
        && navigatorRect.left >= -1
        && navigatorRect.right <= window.innerWidth + 1
        && navigatorRect.bottom <= window.innerHeight + 1
      ),
    }
  })

  if (
    mobileLayout.horizontalOverflow > 2
    || !mobileLayout.inspectorVisible
    || !mobileLayout.navigatorVisible
  ) {
    throw new Error(`Mobile layout failed: ${JSON.stringify(mobileLayout)}`)
  }

  const openedMissionControl = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((candidate) => (
      candidate.hasAttribute('aria-expanded')
      && /Explore|Scientific|Sandbox/.test(candidate.textContent ?? '')
    ))
    if (!(button instanceof HTMLButtonElement)) return false
    button.click()
    return true
  })
  if (!openedMissionControl) throw new Error('Mission control trigger was not found on mobile')
  await page.waitForFunction(() => document.body.textContent?.includes('Mission control'))
  await assertAccessibleSurface(page, 'mobile mission control')

  await page.setViewport({
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })
  await delay(350)
  const landscapeHealthy = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    return Boolean(
      canvas
      && canvas.clientWidth > 0
      && canvas.clientHeight > 0
      && document.documentElement.scrollWidth <= window.innerWidth + 2
    )
  })
  if (!landscapeHealthy) throw new Error('Mobile landscape resize produced an invalid layout')

  if (pageErrors.length > 0) {
    throw new Error(`Mobile page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[ui-smoke] mobile touch, inspector, mission control, rotation, and accessibility passed')
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

    await runDesktop(browser)
    await runWebpFallback(browser)
    await runMobile(browser)
  } catch (error) {
    console.error('[ui-smoke] failed')
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
