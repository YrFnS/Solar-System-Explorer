import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.MOBILE_OVERLAY_SMOKE_PORT || 3125)
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

async function configurePage(page, { guideComplete }) {
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })

  await page.evaluateOnNewDocument((completeGuide) => {
    if (completeGuide) {
      window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
    } else {
      window.localStorage.removeItem('solar-explorer-interface-guide-v4')
    }
    window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
    window.localStorage.setItem('solar-explorer-quality-preset-v1', 'eco')
    window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'false')
  }, guideComplete)
}

async function waitForCore(page) {
  await page.goto(`${baseUrl}/?diagnostics=1&textures=webp`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  await page.waitForSelector('canvas', { timeout: 45_000 })
  await page.waitForSelector('[data-mobile-header="explorer"]', { timeout: 45_000 })
  await page.waitForFunction(() => Boolean(window.__SOLAR_MOBILE_OVERLAY__), {
    timeout: 20_000,
  })
}

async function readSurfaceState(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0
    }

    const surfaces = [...document.querySelectorAll('[data-mobile-bottom-surface]')]
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          id: element.getAttribute('data-mobile-bottom-surface'),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        }
      })

    const activeElement = surfaces.length === 1
      ? document.querySelector(`[data-mobile-bottom-surface="${surfaces[0].id}"]`)
      : null

    const undersizedControls = activeElement
      ? [...activeElement.querySelectorAll('button, input, label')]
          .filter(isVisible)
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              label: element.getAttribute('aria-label')
                ?? element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60)
                ?? element.tagName,
              width: rect.width,
              height: rect.height,
            }
          })
          .filter((control) => control.width < 42 || control.height < 42)
      : []

    const tinyText = activeElement
      ? [...activeElement.querySelectorAll('p, span, label, button')]
          .filter(isVisible)
          .filter((element) => (element.textContent?.trim().length ?? 0) > 0)
          .map((element) => ({
            text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60) ?? '',
            size: Number.parseFloat(getComputedStyle(element).fontSize),
          }))
          .filter((entry) => Number.isFinite(entry.size) && entry.size < 9.9)
      : []

    return {
      diagnostics: window.__SOLAR_MOBILE_OVERLAY__,
      surfaces,
      undersizedControls,
      tinyText,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })
}

async function assertSingleSurface(page, expectedSurface) {
  await page.waitForFunction((expected) => {
    const diagnostics = window.__SOLAR_MOBILE_OVERLAY__
    if (!diagnostics || diagnostics.activeSurface !== expected) return false

    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0
    }

    const visible = [...document.querySelectorAll('[data-mobile-bottom-surface]')]
      .filter(isVisible)
    return visible.length === 1
      && visible[0].getAttribute('data-mobile-bottom-surface') === expected
  }, { timeout: 20_000 }, expectedSurface)

  const state = await readSurfaceState(page)
  const surface = state.surfaces[0]
  const bottomGap = state.viewportHeight - surface.bottom

  const failures = []
  if (state.surfaces.length !== 1 || surface.id !== expectedSurface) {
    failures.push(`visible surfaces=${JSON.stringify(state.surfaces)}`)
  }
  if (state.horizontalOverflow > 2) {
    failures.push(`horizontal overflow=${state.horizontalOverflow}px`)
  }
  if (
    surface.left < -1
    || surface.right > state.viewportWidth + 1
    || surface.top < -1
    || surface.bottom > state.viewportHeight + 1
  ) {
    failures.push(`surface outside viewport=${JSON.stringify(surface)}`)
  }
  if (bottomGap < -1 || bottomGap > 34) {
    failures.push(`safe-area bottom gap=${bottomGap.toFixed(1)}px`)
  }
  if (state.undersizedControls.length > 0) {
    failures.push(`undersized controls=${JSON.stringify(state.undersizedControls.slice(0, 8))}`)
  }
  if (state.tinyText.length > 0) {
    failures.push(`sub-10px readable text=${JSON.stringify(state.tinyText.slice(0, 8))}`)
  }

  if (failures.length > 0) {
    throw new Error(`${expectedSurface} mobile surface failed:\n${failures.join('\n')}`)
  }

  return state
}

async function clickButton(page, selector) {
  const button = await page.waitForSelector(selector, { timeout: 15_000 })
  await button.click()
}

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((expected) => {
    const button = [...document.querySelectorAll('button')].find((candidate) => (
      candidate.textContent?.replace(/\s+/g, ' ').trim().startsWith(expected)
    ))
    if (!(button instanceof HTMLButtonElement)) return false
    button.click()
    return true
  }, text)

  if (!clicked) throw new Error(`Could not find button beginning with “${text}”`)
}

async function runCoordinatedSurfaces(browser) {
  const page = await browser.newPage()
  await configurePage(page, { guideComplete: true })
  const pageErrors = collectPageErrors(page)
  await waitForCore(page)

  await assertSingleSurface(page, 'navigator')

  await clickButton(
    page,
    '[data-mobile-bottom-surface="navigator"] [aria-label="Navigate to Mars"]'
  )
  await assertSingleSurface(page, 'inspector')

  await clickButton(
    page,
    '[data-mobile-bottom-surface="inspector"] [aria-label="Open mission control"]'
  )
  await assertSingleSurface(page, 'mission-control')

  await clickButton(
    page,
    '[data-mobile-bottom-surface="mission-control"] [aria-label="Close mission control"]'
  )
  await assertSingleSurface(page, 'inspector')

  await clickButton(
    page,
    '[data-mobile-bottom-surface="inspector"] [aria-label="Close body inspector"]'
  )
  await assertSingleSurface(page, 'navigator')

  await clickButton(
    page,
    '[data-mobile-bottom-surface="navigator"] [aria-label="Open mission control"]'
  )
  await assertSingleSurface(page, 'mission-control')

  await page.setViewport({
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })
  await delay(400)
  const landscapeState = await assertSingleSurface(page, 'mission-control')
  if (landscapeState.diagnostics?.orientation !== 'landscape') {
    throw new Error(`Mobile overlay diagnostics did not report landscape: ${JSON.stringify(landscapeState.diagnostics)}`)
  }

  if (pageErrors.length > 0) {
    throw new Error(`Coordinated mobile surfaces raised page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[mobile-overlay-smoke] navigator, inspector, mission control, touch targets, and rotation passed')
}

async function runTourSurface(browser) {
  const page = await browser.newPage()
  await configurePage(page, { guideComplete: false })
  const pageErrors = collectPageErrors(page)
  await waitForCore(page)

  await page.waitForFunction(() => document.body.textContent?.includes('Start with a world'), {
    timeout: 15_000,
  })
  await clickButtonByText(page, 'Next')
  await page.waitForFunction(() => document.body.textContent?.includes('Search the whole catalogue'))
  await clickButtonByText(page, 'Next')
  await page.waitForFunction(() => document.body.textContent?.includes('Three experiences, one system'))
  await clickButtonByText(page, 'Start tour')

  await assertSingleSurface(page, 'tour')
  await clickButton(page, '[data-mobile-bottom-surface="tour"] [aria-label="End guided tour"]')
  await assertSingleSurface(page, 'inspector')

  if (pageErrors.length > 0) {
    throw new Error(`Tour mobile surface raised page errors:\n${pageErrors.join('\n')}`)
  }

  await page.close()
  console.log('[mobile-overlay-smoke] guided tour replaced the inspector and restored it cleanly')
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

    await runCoordinatedSurfaces(browser)
    await runTourSurface(browser)
  } catch (error) {
    console.error('[mobile-overlay-smoke] failed')
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
