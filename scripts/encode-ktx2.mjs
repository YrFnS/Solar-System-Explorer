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

function cliCodec(codec) {
  // KTX Software 4.4.2 exposes the UASTC LDR 4x4 encoder through the
  // historical `uastc` alias. The manifest keeps the explicit semantic name
  // so it remains forward-compatible with the newer KTX tool vocabulary.
  return codec === 'uastc-ldr-4x4' ? 'uastc' : codec
}

function roundUpToBlock(value, blockSize = 4) {
  return Math.max(blockSize, Math.ceil(value / blockSize) * blockSize)
}

async function encodeTexture(entry, width) {
  const sourcePath = path.join(root, 'public', entry.input.replace(/^\/+/, ''))
  const metadata = await sharp(sourcePath, { limitInputPixels: false }).metadata()
  const sourceWidth = metadata.width ?? width
  const sourceHeight = metadata.height ?? sourceWidth
  const targetWidth = Math.max(1, Math.min(width, sourceWidth))
  const targetHeight = Math.max(
    1,
    Math.round(sourceHeight * (targetWidth / sourceWidth))
  )
  const encodedWidth = roundUpToBlock(targetWidth)
  const encodedHeight = roundUpToBlock(targetHeight)
  const tempPath = path.join(tempRoot, `${entry.id}-${width}.png`)
  const outputDirectory = path.join(outputRoot, String(width))
  const outputPath = path.join(outputDirectory, `${entry.id}.ktx2`)

  await mkdir(tempRoot, { recursive: true })
  await mkdir(outputDirectory, { recursive: true })

  let image = sharp(sourcePath, { limitInputPixels: false }).resize({
    width: targetWidth,
    height: targetHeight,
    fit: 'fill',
    withoutEnlargement: true,
  })

  const rightPadding = encodedWidth - targetWidth
  const bottomPadding = encodedHeight - targetHeight
  if (rightPadding > 0 || bottomPadding > 0) {
    // Copy only the final edge pixels. This satisfies the 4x4 block boundary
    // required by KHR_texture_basisu without introducing a transparent seam in
    // radial ring strips or equirectangular maps.
    image = image.extend({
      top: 0,
      left: 0,
      right: rightPadding,
      bottom: bottomPadding,
      extendWith: 'copy',
    })
  }

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
    cliCodec(entry.codec),
    '--generate-mipmap',
    '--mipmap-filter',
    'lanczos4',
    '--assign-tf',
    entry.colorSpace === 'srgb' ? 'srgb' : 'linear',
    '--assign-texcoord-origin',
    'top-left',
    // One encoder thread plus disabled UASTC RDO multithreading keeps the
    // pinned Linux asset build reproducible.
    '--threads',
    '1',
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
    `[ktx2] ${entry.id} ${width}px ${entry.codec} `
      + `${encodedWidth}x${encodedHeight}: ${(outputStats.size / 1024).toFixed(1)} KiB`
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
