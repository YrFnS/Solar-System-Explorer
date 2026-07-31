import { access, readFile, stat } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const manifestPath = path.join(
  root,
  'src',
  'components',
  'solar-system',
  'textures',
  'ktx2-manifest.json'
)
const ktxBinary = process.env.KTX_BIN || 'ktx'
const KTX2_IDENTIFIER = Buffer.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32,
  0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
])

function formatBytes(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
  return `${(bytes / 1_000).toFixed(1)} kB`
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function hasKtxCli() {
  const result = spawnSync(ktxBinary, ['--version'], { encoding: 'utf8' })
  return !result.error && result.status === 0
}

function validateWithCli(filePath) {
  const result = spawnSync(
    ktxBinary,
    ['validate', '--gltf-basisu', filePath],
    { cwd: root, encoding: 'utf8' }
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${path.relative(root, filePath)} failed ktx validate:\n${result.stderr || result.stdout}`
    )
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const failures = []
  const sizesByTier = new Map(manifest.tiers.map((tier) => [tier, 0]))
  const cliAvailable = hasKtxCli()
  let validated = 0

  for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
    const sourcePath = path.join(
      root,
      'node_modules',
      'three',
      'examples',
      'jsm',
      'libs',
      'basis',
      file
    )
    if (!(await exists(sourcePath))) {
      failures.push(`Three.js Basis transcoder source is missing: ${file}`)
    }
  }

  for (const entry of manifest.textures) {
    for (const tier of manifest.tiers) {
      const filePath = path.join(
        root,
        'public',
        'textures',
        'ktx2',
        String(tier),
        `${entry.id}.ktx2`
      )

      if (!(await exists(filePath))) {
        failures.push(`Missing ${path.relative(root, filePath)}`)
        continue
      }

      const file = await readFile(filePath)
      if (file.length < 68 || !file.subarray(0, 12).equals(KTX2_IDENTIFIER)) {
        failures.push(`Invalid KTX2 signature: ${path.relative(root, filePath)}`)
        continue
      }

      if (cliAvailable) {
        try {
          validateWithCli(filePath)
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error))
          continue
        }
      }

      const fileStats = await stat(filePath)
      sizesByTier.set(tier, (sizesByTier.get(tier) ?? 0) + fileStats.size)
      validated += 1
    }
  }

  for (const tier of manifest.tiers) {
    console.log(
      `[ktx2] ${tier}px pilot tier: ${formatBytes(sizesByTier.get(tier) ?? 0)}`
    )
  }
  console.log(
    `[ktx2] ${validated}/${manifest.textures.length * manifest.tiers.length} files verified`
  )
  console.log(
    `[ktx2] Khronos CLI validation ${cliAvailable ? 'enabled' : 'not installed; signature checks used'}`
  )

  if (failures.length > 0) {
    console.error('\n[ktx2] verification failed:')
    failures.forEach((failure) => console.error(`  - ${failure}`))
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('[ktx2] verification failed')
  console.error(error)
  process.exitCode = 1
})
