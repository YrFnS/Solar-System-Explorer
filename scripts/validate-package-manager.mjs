import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const failures = []
const validationCommand = 'bun run package-manager:validate'
const requiredInstallCommand = 'bun install --frozen-lockfile'
const requiredBuildCommand = 'bun run build'
const conflictingLockfiles = [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]

async function pathExists(relativePath) {
  try {
    await access(path.join(root, relativePath))
    return true
  } catch {
    return false
  }
}

function requireContract(condition, message) {
  if (!condition) failures.push(message)
}

const packageJson = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8')
)
const packageManager = packageJson.packageManager ?? ''
const bunVersion = /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager)?.[1] ?? null

requireContract(
  Boolean(bunVersion),
  'package.json must pin one exact Bun version through packageManager.'
)
requireContract(
  await pathExists('bun.lock'),
  'bun.lock is required and must remain the only dependency lockfile.'
)

for (const lockfile of conflictingLockfiles) {
  requireContract(
    !(await pathExists(lockfile)),
    `${lockfile} conflicts with the authoritative Bun dependency graph and must be removed.`
  )
}

requireContract(
  packageJson.scripts?.['package-manager:validate']
    === 'node scripts/validate-package-manager.mjs',
  'package.json must expose package-manager:validate.'
)
for (const scriptName of ['predev', 'build', 'quality:local']) {
  requireContract(
    packageJson.scripts?.[scriptName]?.startsWith(`${validationCommand} && `),
    `${scriptName} must validate the package-manager contract first.`
  )
}

const workflow = await readFile(
  path.join(root, '.github', 'workflows', 'quality.yml'),
  'utf8'
)
requireContract(
  workflow.includes(`run: ${validationCommand}`),
  'The Quality workflow must validate the package-manager contract.'
)

const vercelConfig = JSON.parse(
  await readFile(path.join(root, 'vercel.json'), 'utf8')
)
requireContract(
  vercelConfig.installCommand === requiredInstallCommand,
  `vercel.json must use "${requiredInstallCommand}".`
)
requireContract(
  vercelConfig.buildCommand === requiredBuildCommand,
  `vercel.json must use "${requiredBuildCommand}".`
)

if (failures.length > 0) {
  console.error('[package-manager] contract failed')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`[package-manager] Bun ${bunVersion} is the single dependency authority`)
  console.log(`[package-manager] install: ${requiredInstallCommand}`)
  console.log(`[package-manager] build: ${requiredBuildCommand}`)
}
