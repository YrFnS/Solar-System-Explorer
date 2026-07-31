import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const manifestPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'textures',
  'ktx2-manifest.json'
)
const outputRoot = path.join(root, 'public', 'textures', 'ktx2')
const tempRoot = path.join(root, '.cache', 'ktx2')
const ktxBinary = process.env.KTX_BIN || 'ktx'

function runKtx(args) {
  const result = spawnSync(ktxBinary, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${ktxBinary} ${args.join(' ')} exited with ${result.status}`)
  }
}

function selectedTextureIds() {
  const value = process.env.KTX2_TEXTURES?.trim()
  if (!value) return null
  return new Set(value.split(',').map((id) => id.trim()).filter(Boolean))
}

async function encodeTexture(entry, width) {
  const sourcePath = path.join(root, 'public', entry.input.replace(/^\/+/, ''))
  const metadata = await sharp(sourcePath, { limitInputPixels: false }).metadata()
  const sourceWidth = metadata.width ?? width
  const targetWidth = Math.min(width, sourceWidth)
  const tempPath = path.join(tempRoot, `${entry.id}-${width}.png`)
  const outputDirectory = path.join(outputRoot, String(width))
  const outputPath = path.join(outputDirectory, `${entry.id}.ktx2`)

  await mkdir(tempRoot, { recursive: true })
  await mkdir(outputDirectory, { recursive: true })

  let image = sharp(sourcePath, { limitInputPixels: false }).resize({
    width: targetWidth,
    fit: 'inside',
    withoutEnlargement: true,
  })
  image = entry.alpha ? image.ensureAlpha() : image.removeAlpha()
  await image.png({ compressionLevel: 9, palette: false }).toFile(tempPath)

  const format = entry.alpha
    ? entry.colorSpace === 'srgb'
      ? 'R8G8B8A8_SRGB'
      : 'R8G8B8A8_UNORM'
    : entry.colorSpace === 'srgb'
      ? 'R8G8B8_SRGB'
      : 'R8G8B8_UNORM'

  const args = [
    'create',
    '--format',
    format,
    '--encode',
    entry.codec,
    '--generate-mipmap',
    '--mipmap-filter',
    'lanczos4',
    '--assign-texcoord-origin',
    'top-left',
    '--threads',
    '2',
  ]

  if (entry.codec === 'basis-lz') {
    args.push(
      '--qlevel',
      String(entry.qlevel ?? 176),
      '--clevel',
      String(entry.clevel ?? 3)
    )
  } else {
    args.push(
      '--uastc-quality',
      String(entry.uastcQuality ?? 2),
      '--uastc-rdo',
      '--uastc-rdo-l',
      String(entry.uastcRdoLambda ?? 0.7),
      '--uastc-rdo-m',
      '--zstd',
      String(entry.zstd ?? 18)
    )
  }

  args.push(tempPath, outputPath)
  runKtx(args)
  runKtx(['validate', '--gltf-basisu', outputPath])

  const outputStats = await stat(outputPath)
  console.log(
    `[ktx2] ${entry.id} ${width}px ${entry.codec}: ${(outputStats.size / 1024).toFixed(1)} KiB`
  )
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const selected = selectedTextureIds()
  const textures = selected
    ? manifest.textures.filter((entry) => selected.has(entry.id))
    : manifest.textures

  if (textures.length === 0) {
    throw new Error('No KTX2 textures matched KTX2_TEXTURES.')
  }

  const version = spawnSync(ktxBinary, ['--version'], { encoding: 'utf8' })
  if (version.error || version.status !== 0) {
    throw new Error(
      `The Khronos KTX command line tool was not found at ${ktxBinary}. `
      + 'Install KTX-Software 4.4.2 or set KTX_BIN.'
    )
  }
  console.log(`[ktx2] encoder ${String(version.stdout || version.stderr).trim()}`)

  await rm(tempRoot, { recursive: true, force: true })
  for (const entry of textures) {
    for (const width of manifest.tiers) {
      await encodeTexture(entry, width)
    }
  }
  await rm(tempRoot, { recursive: true, force: true })

  console.log(
    `[ktx2] encoded ${textures.length * manifest.tiers.length} pilot texture files`
  )
}

main().catch((error) => {
  console.error('[ktx2] encoding failed')
  console.error(error)
  process.exitCode = 1
})
