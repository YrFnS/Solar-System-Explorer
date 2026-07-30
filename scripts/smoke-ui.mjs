import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = Number(process.env.SMOKE_PORT || 3117)
const host = '127.0.0.1'
const baseUrl = `http://${host}:${port}`
const standaloneRoot = path.resolve('.next', 'standalone')
const standaloneNextRoot = path.join(standaloneRoot, '.next')

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

    await new Promise((resolve) => setTimeout(resolve, 350))
  }

  throw lastError instanceof Error
    ? new Error(`Timed out waiting for ${baseUrl}: ${lastError.message}`)
    : new Error(`Timed out waiting for ${baseUrl}`)
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
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
    await page.evaluateOnNewDocument(() => {
      window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
      window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
      window.localStorage.setItem('solar-explorer-quality-preset-v1', 'eco')
      window.sessionStorage.setItem('solar-explorer-scene-warmup-v1', 'complete')
    })

    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 75_000 })
    await page.waitForSelector('canvas', { timeout: 45_000 })
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas')
      return Boolean(canvas?.getContext('webgl2'))
    }, { timeout: 30_000 })
    await page.waitForSelector('[aria-label="Search celestial bodies"]', { timeout: 45_000 })
    await page.waitForSelector('[aria-label="Navigate to Earth"]', { timeout: 45_000 })

    await page.click('[aria-label="Search celestial bodies"]')
    const searchInput = await page.waitForSelector('input[placeholder*="Search planets"]', { timeout: 15_000 })
    await searchInput.type('Earth')
    await page.waitForFunction(() => document.body.textContent?.includes('Terrestrial Planet'))
    await page.keyboard.press('Escape')

    await page.click('[aria-label="Navigate to Earth"]')
    await page.waitForFunction(() => {
      const text = document.body.textContent || ''
      return text.includes('Selected object') && text.includes('Earth') && text.includes('Sun distance')
    }, { timeout: 20_000 })

    if (pageErrors.length > 0) {
      throw new Error(`Browser page errors:\n${pageErrors.join('\n')}`)
    }

    console.log('[ui-smoke] WebGL2 canvas, command palette, and Earth inspector passed')
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
