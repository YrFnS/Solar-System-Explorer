import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.DEVICE_ACCEPTANCE_SMOKE_PORT || 3136)
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
    window.localStorage.removeItem('solar-explorer-device-acceptance-v1')
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

    await page.goto(
      `${baseUrl}/lab/device-acceptance?diagnostics=1&acceptance-fast=1&textures=webp`,
      { waitUntil: 'networkidle2', timeout: 75_000 }
    )
    await page.waitForSelector('[data-device-acceptance-lab]', { timeout: 45_000 })
    await page.waitForSelector('canvas', { timeout: 45_000 })
    await page.waitForSelector('[data-testid="acceptance-start-profile"]', {
      timeout: 45_000,
    })
    await page.waitForFunction(() => (
      window.__SOLAR_DEVICE_ACCEPTANCE__?.ready === true
      && window.__SOLAR_DEVICE_ACCEPTANCE__?.sceneComplete === true
    ), { timeout: 90_000 })

    await page.click('[data-testid="acceptance-start-profile"]')
    await page.waitForFunction(() => (
      window.__SOLAR_DEVICE_ACCEPTANCE__?.active === true
    ), { timeout: 15_000 })
    await page.waitForFunction(() => (
      window.__SOLAR_DEVICE_ACCEPTANCE__?.active === false
      && window.__SOLAR_DEVICE_ACCEPTANCE__?.sessionCount >= 1
    ), { timeout: 45_000 })

    const evidence = await page.evaluate(() => {
      const diagnostics = window.__SOLAR_DEVICE_ACCEPTANCE__
      const raw = window.localStorage.getItem('solar-explorer-device-acceptance-v1')
      return {
        diagnostics,
        workspace: raw ? JSON.parse(raw) : null,
      }
    })

    if (!evidence.diagnostics || evidence.diagnostics.sessionCount !== 1) {
      throw new Error('The acceptance lab did not publish one completed session.')
    }
    const session = evidence.workspace?.sessions?.[0]
    if (!session || session.schema !== 'solar-system-explorer-device-acceptance') {
      throw new Error('The completed capture was not persisted with the acceptance schema.')
    }
    if (!Array.isArray(session.samples) || session.samples.length < 5) {
      throw new Error(`The fast capture stored only ${session.samples?.length ?? 0} samples.`)
    }
    if (!session.summary || !['pass', 'review', 'fail'].includes(session.summary.verdict)) {
      throw new Error('The completed capture did not contain an automated verdict.')
    }
    if (session.summary.diagnosticsCoverage <= 0) {
      throw new Error('The completed capture did not collect production diagnostics.')
    }
    if (pageErrors.length > 0) {
      throw new Error(`Device acceptance page errors:\n${pageErrors.join('\n')}`)
    }

    console.log(`[device-acceptance-smoke] ${session.samples.length} samples · ${session.summary.verdict} · ${(session.summary.diagnosticsCoverage * 100).toFixed(0)}% diagnostic coverage`)
    console.log('[device-acceptance-smoke] production scene, fast profile capture, persistence, analysis, and diagnostics passed')
    await page.close()
  } catch (error) {
    console.error('[device-acceptance-smoke] failed')
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
