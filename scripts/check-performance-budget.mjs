import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const CHUNKS_ROOT = path.join(ROOT, '.next', 'static', 'chunks')
const OPTIMIZED_TEXTURE_ROOT = path.join(ROOT, 'public', 'textures', 'optimized')
const KTX2_TEXTURE_ROOT = path.join(ROOT, 'public', 'textures', 'ktx2')
const KTX2_MANIFEST_PATH = path.join(
  ROOT,
  'src',
  'components',
  'solar-system',
  'textures',
  'ktx2-manifest.json'
)

const BUDGETS = {
  largestJavaScriptChunk: 2_000_000,
  totalJavaScript: 12_000_000,
  initialRouteJavaScript: 3_500_000,
  textureTier: {
    512: 12_000_000,
    1024: 20_000_000,
    2048: 36_000_000,
  },
  ktx2CatalogueTier: {
    512: 4_000_000,
    1024: 12_000_000,
    2048: 32_000_000,
  },
}

function formatBytes(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
  return `${(bytes / 1_000).toFixed(1)} kB`
}

async function exists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function collectFiles(directory, extension) {
  if (!(await exists(directory))) return []
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, extension))
    } else if (entry.name.endsWith(extension)) {
      files.push(absolutePath)
    }
  }

  return files
}

async function totalSize(files) {
  const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size))
  return sizes.reduce((sum, size) => sum + size, 0)
}

async function routeFiles() {
  const manifestPath = path.join(ROOT, '.next', 'app-build-manifest.json')
  if (!(await exists(manifestPath))) return []

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const pages = manifest.pages ?? {}
  const routeKey = Object.keys(pages).find((key) => key === '/page')
    ?? Object.keys(pages).find((key) => key.endsWith('/page') && !key.includes('_not-found'))

  if (!routeKey || !Array.isArray(pages[routeKey])) return []
  return [...new Set(pages[routeKey])]
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(ROOT, '.next', file))
}

async function main() {
  const failures = []
  const ktx2Manifest = JSON.parse(await readFile(KTX2_MANIFEST_PATH, 'utf8'))
  const expectedKtx2Textures = ktx2Manifest.textures.length
  const chunks = await collectFiles(CHUNKS_ROOT, '.js')
  const chunkStats = await Promise.all(chunks.map(async (file) => ({
    file,
    size: (await stat(file)).size,
  })))
  const largestChunk = chunkStats.reduce(
    (largest, current) => current.size > largest.size ? current : largest,
    { file: '', size: 0 }
  )
  const totalJavaScript = chunkStats.reduce((sum, chunk) => sum + chunk.size, 0)
  const routeJavaScriptFiles = await routeFiles()
  const initialRouteJavaScript = await totalSize(
    routeJavaScriptFiles.filter((file) => chunks.includes(file))
  )

  console.log(`[budget] JavaScript chunks: ${chunks.length}`)
  console.log(`[budget] Largest chunk: ${formatBytes(largestChunk.size)} ${path.relative(ROOT, largestChunk.file)}`)
  console.log(`[budget] Total static JavaScript: ${formatBytes(totalJavaScript)}`)
  console.log(`[budget] Initial route JavaScript: ${formatBytes(initialRouteJavaScript)}`)

  if (largestChunk.size > BUDGETS.largestJavaScriptChunk) {
    failures.push(
      `largest JavaScript chunk ${formatBytes(largestChunk.size)} exceeds ${formatBytes(BUDGETS.largestJavaScriptChunk)}`
    )
  }
  if (totalJavaScript > BUDGETS.totalJavaScript) {
    failures.push(
      `total JavaScript ${formatBytes(totalJavaScript)} exceeds ${formatBytes(BUDGETS.totalJavaScript)}`
    )
  }
  if (initialRouteJavaScript > BUDGETS.initialRouteJavaScript) {
    failures.push(
      `initial route JavaScript ${formatBytes(initialRouteJavaScript)} exceeds ${formatBytes(BUDGETS.initialRouteJavaScript)}`
    )
  }

  const textureFiles = await collectFiles(OPTIMIZED_TEXTURE_ROOT, '.webp')
  for (const width of [512, 1024, 2048]) {
    const tierFiles = textureFiles.filter((file) => file.endsWith(`-${width}.webp`))
    const tierSize = await totalSize(tierFiles)
    const budget = BUDGETS.textureTier[width]
    console.log(`[budget] ${width}px WebP tier: ${formatBytes(tierSize)} across ${tierFiles.length} files`)
    if (tierSize > budget) {
      failures.push(
        `${width}px WebP tier ${formatBytes(tierSize)} exceeds ${formatBytes(budget)}`
      )
    }
  }

  const ktx2Files = await collectFiles(KTX2_TEXTURE_ROOT, '.ktx2')
  for (const width of [512, 1024, 2048]) {
    const tierDirectory = `${path.sep}${width}${path.sep}`
    const tierFiles = ktx2Files.filter((file) => file.includes(tierDirectory))
    const tierSize = await totalSize(tierFiles)
    const budget = BUDGETS.ktx2CatalogueTier[width]
    console.log(`[budget] ${width}px KTX2 catalogue: ${formatBytes(tierSize)} across ${tierFiles.length} files`)

    if (tierFiles.length !== expectedKtx2Textures) {
      failures.push(
        `${width}px KTX2 catalogue contains ${tierFiles.length} files; expected ${expectedKtx2Textures}`
      )
    }
    if (tierSize > budget) {
      failures.push(
        `${width}px KTX2 catalogue ${formatBytes(tierSize)} exceeds ${formatBytes(budget)}`
      )
    }
  }

  if (failures.length > 0) {
    console.error('\n[budget] performance budget failed:')
    failures.forEach((failure) => console.error(`  - ${failure}`))
    process.exitCode = 1
    return
  }

  console.log('[budget] production artifact budgets passed')
}

main().catch((error) => {
  console.error('[budget] failed to inspect production artifacts')
  console.error(error)
  process.exitCode = 1
})
