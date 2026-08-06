import { spawn } from 'node:child_process'
import { access, cp, mkdir, rm } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import path from 'node:path'

const root = process.cwd()
const standaloneRoot = path.resolve(root, '.next', 'standalone')
const standaloneServer = path.join(standaloneRoot, 'server.js')
const standaloneNextRoot = path.join(standaloneRoot, '.next')
const host = process.env.ACCEPTANCE_HOST || process.env.HOSTNAME || '0.0.0.0'
const port = Number(process.env.ACCEPTANCE_PORT || process.env.PORT || 3000)

if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  console.error('[acceptance-serve] ACCEPTANCE_PORT must be a valid TCP port.')
  process.exit(1)
}

async function ensureProductionBuild() {
  try {
    await access(standaloneServer)
    await access(path.resolve(root, '.next', 'static'))
    await access(path.resolve(root, 'public'))
  } catch {
    console.error('[acceptance-serve] No complete standalone build was found.')
    console.error('[acceptance-serve] Run `bun run build` first, then retry `bun run acceptance:serve`.')
    process.exit(1)
  }
}

async function prepareStandaloneAssets() {
  await rm(path.join(standaloneRoot, 'public'), { recursive: true, force: true })
  await rm(path.join(standaloneNextRoot, 'static'), { recursive: true, force: true })
  await mkdir(standaloneNextRoot, { recursive: true })
  await cp(path.resolve(root, 'public'), path.join(standaloneRoot, 'public'), {
    recursive: true,
  })
  await cp(
    path.resolve(root, '.next', 'static'),
    path.join(standaloneNextRoot, 'static'),
    { recursive: true }
  )
}

function localAddresses() {
  const addresses = new Set()
  const interfaces = networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      addresses.add(entry.address)
    }
  }
  return [...addresses].sort()
}

function route(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).toString()
}

await ensureProductionBuild()
await prepareStandaloneAssets()

const browserHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host
const localBase = `http://${browserHost}:${port}`
const networkBases = localAddresses().map((address) => `http://${address}:${port}`)

console.log('')
console.log('[acceptance-serve] Solar System Explorer physical-device campaign')
console.log(`[acceptance-serve] Local launcher: ${route(localBase, '/lab/device-acceptance/launch')}`)
console.log(`[acceptance-serve] Local review:   ${route(localBase, '/lab/device-acceptance/results')}`)
for (const baseUrl of networkBases) {
  console.log(`[acceptance-serve] LAN launcher:   ${route(baseUrl, '/lab/device-acceptance/launch')}`)
  console.log(`[acceptance-serve] LAN review:     ${route(baseUrl, '/lab/device-acceptance/results')}`)
}
if (networkBases.length === 0) {
  console.log('[acceptance-serve] No non-loopback IPv4 address was detected. Check Wi-Fi/Ethernet and firewall settings.')
}
console.log('[acceptance-serve] Keep all devices on this same build and network address for consistent commit provenance.')
console.log('[acceptance-serve] Press Ctrl+C to stop the server.')
console.log('')

const server = spawn('bun', ['server.js'], {
  cwd: standaloneRoot,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: host,
    PORT: String(port),
  },
  stdio: 'inherit',
})

let shuttingDown = false
function stop(signal) {
  if (shuttingDown) return
  shuttingDown = true
  server.kill(signal)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
server.on('exit', (code, signal) => {
  if (signal) process.exit(0)
  process.exit(code ?? 0)
})
