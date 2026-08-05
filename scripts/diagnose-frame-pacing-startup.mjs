import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer'

const port = 3130
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
  await cp(path.resolve('.next', 'static'), path.join(standaloneNextRoot, 'static'), { recursive: true })
}

async function waitForServer(server) {
  const started = Date.now()
  while (Date.now() - started < 45_000) {
    if (server.exitCode !== null) throw new Error(`Server exited with ${server.exitCode}`)
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {}
    await delay(300)
  }
  throw new Error('Startup diagnostic server timed out')
}

await prepareStandaloneAssets()
const server = spawn('bun', ['server.js'], {
  cwd: standaloneRoot,
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: host, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
server.stdout.on('data', (chunk) => { output += chunk.toString() })
server.stderr.on('data', (chunk) => { output += chunk.toString() })

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
    ],
  })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
  await page.evaluateOnNewDocument(() => {
    window.localStorage.setItem('solar-explorer-interface-guide-v4', 'complete')
    window.localStorage.setItem('solar-explorer-experience-mode-v1', 'explore')
    window.localStorage.setItem('solar-explorer-quality-preset-v1', 'eco')
    window.localStorage.setItem('solar-explorer-ktx2-enabled-v1', 'true')
  })
  await page.goto(`${baseUrl}/?diagnostics=1&textures=ktx2`, {
    waitUntil: 'networkidle2',
    timeout: 75_000,
  })
  await page.waitForSelector('canvas', { timeout: 30_000 })

  for (const elapsedSeconds of [3, 8, 15, 25]) {
    const previous = elapsedSeconds === 3 ? 0 : [3, 8, 15][[3, 8, 15, 25].indexOf(elapsedSeconds) - 1]
    await delay((elapsedSeconds - previous) * 1_000)
    const snapshot = await page.evaluate(() => ({
      loading: window.__SOLAR_SCENE_LOADING__,
      pacing: window.__SOLAR_FRAME_PACING__,
      textures: window.__SOLAR_TEXTURE_DIAGNOSTICS__,
      lifecycle: window.__SOLAR_TEXTURE_LIFECYCLE__,
      renderer: window.__SOLAR_EXPLORER_DIAGNOSTICS__,
      timing: window.__SOLAR_SIMULATION_TIMING__,
      bodyText: document.body.textContent?.slice(0, 500),
    }))
    console.log(`[pacing-startup-diagnostic] ${elapsedSeconds}s ${JSON.stringify(snapshot)}`)
  }

  if (pageErrors.length) {
    console.log(`[pacing-startup-diagnostic] page errors ${JSON.stringify(pageErrors)}`)
  }
  await page.close()
} catch (error) {
  console.error('[pacing-startup-diagnostic] failed', error)
  if (output.trim()) console.error(output.trim())
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
