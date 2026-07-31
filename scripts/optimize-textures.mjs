import { mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const textureRoot = path.join(projectRoot, 'public', 'textures')
const outputRoot = path.join(textureRoot, 'optimized')
const textureExtensions = new Set(['.jpg', '.jpeg', '.png', '.svg'])
const widths = [512, 1024, 2048]

async function collectTextures(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === 'optimized' || entry.name === 'ktx2') continue

    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectTextures(absolutePath))
      continue
    }

    if (textureExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath)
    }
  }

  return files
}

async function outputIsCurrent(sourcePath, outputPath) {
  try {
    const [sourceStats, outputStats] = await Promise.all([
      stat(sourcePath),
      stat(outputPath),
    ])
    return outputStats.mtimeMs >= sourceStats.mtimeMs
  } catch {
    return false
  }
}

async function optimizeTexture(sourcePath) {
  const relativePath = path.relative(textureRoot, sourcePath)
  const extension = path.extname(relativePath)
  const relativeBase = relativePath.slice(0, -extension.length)
  const metadata = await sharp(sourcePath).metadata()
  const sourceWidth = metadata.width ?? widths.at(-1)
  let generated = 0

  for (const width of widths) {
    const outputPath = path.join(outputRoot, `${relativeBase}-${width}.webp`)
    if (await outputIsCurrent(sourcePath, outputPath)) continue

    await mkdir(path.dirname(outputPath), { recursive: true })

    await sharp(sourcePath, { limitInputPixels: false })
      .resize({
        width: Math.min(width, sourceWidth ?? width),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: width <= 512 ? 76 : width <= 1024 ? 82 : 86,
        alphaQuality: 90,
        effort: 4,
        smartSubsample: true,
      })
      .toFile(outputPath)

    generated += 1
  }

  return generated
}

async function main() {
  await mkdir(outputRoot, { recursive: true })
  const textures = await collectTextures(textureRoot)
  let generated = 0

  for (const texture of textures) {
    generated += await optimizeTexture(texture)
  }

  const suffix = generated === 1 ? '' : 's'
  console.log(`[textures] ${textures.length} sources checked; ${generated} optimized asset${suffix} generated.`)
}

main().catch((error) => {
  console.error('[textures] optimization failed')
  console.error(error)
  process.exitCode = 1
})
