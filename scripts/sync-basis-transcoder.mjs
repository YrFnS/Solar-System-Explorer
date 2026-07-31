import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(
  root,
  'node_modules',
  'three',
  'examples',
  'jsm',
  'libs',
  'basis'
)
const outputRoot = path.join(root, 'public', 'basis')
const requiredFiles = ['basis_transcoder.js', 'basis_transcoder.wasm']

async function main() {
  await mkdir(outputRoot, { recursive: true })

  for (const file of requiredFiles) {
    await copyFile(path.join(sourceRoot, file), path.join(outputRoot, file))
  }

  const packageJson = JSON.parse(
    await readFile(path.join(root, 'node_modules', 'three', 'package.json'), 'utf8')
  )
  await writeFile(
    path.join(outputRoot, 'version.json'),
    `${JSON.stringify({ three: packageJson.version, files: requiredFiles }, null, 2)}\n`
  )

  console.log(
    `[basis] copied ${requiredFiles.length} transcoder files from three@${packageJson.version}`
  )
}

main().catch((error) => {
  console.error('[basis] unable to prepare the KTX2 transcoder')
  console.error(error)
  process.exitCode = 1
})
