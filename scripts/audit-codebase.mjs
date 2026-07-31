import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']
const SCANNED_ROOTS = ['src', 'scripts']
const ROOT_FILES = [
  'next.config.ts',
  'postcss.config.mjs',
  'eslint.config.mjs',
  'tailwind.config.ts',
]
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  'node_modules',
  'out',
  'build',
  'coverage',
  'public',
])
const IMPLICIT_PACKAGES = new Set([
  'next',
  'react',
  'react-dom',
  'typescript',
  'eslint',
  'eslint-config-next',
  'tailwindcss',
  '@tailwindcss/postcss',
  'bun-types',
  'sharp',
  'puppeteer',
])

const moduleImportPattern = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g
const stylesheetImportPattern = /@import\s+(?:url\(\s*)?['"]?([^'"\)\s;]+)['"]?\s*\)?\s*;/g

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

async function exists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function collectFiles(directory) {
  if (!(await exists(directory))) return []

  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue

    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath))
      continue
    }

    if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(absolutePath)
    }
  }

  return files
}

function parseImports(source) {
  const imports = []
  moduleImportPattern.lastIndex = 0
  stylesheetImportPattern.lastIndex = 0

  let match
  while ((match = moduleImportPattern.exec(source)) !== null) {
    imports.push(match[1] ?? match[2] ?? match[3])
  }
  while ((match = stylesheetImportPattern.exec(source)) !== null) {
    imports.push(match[1])
  }

  return imports.filter(Boolean)
}

function packageName(specifier) {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('node:') ||
    specifier.startsWith('@/')
  ) {
    return null
  }

  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    return name ? `${scope}/${name}` : specifier
  }

  return specifier.split('/')[0]
}

async function resolveRelativeImport(importer, specifier, sourceSet) {
  const basePath = path.resolve(path.dirname(importer), specifier)
  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(basePath, `index${extension}`)),
  ]

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate)
    if (sourceSet.has(normalized)) return normalized
  }

  return null
}

async function main() {
  const sourceFiles = []
  for (const root of SCANNED_ROOTS) {
    sourceFiles.push(...await collectFiles(path.join(ROOT, root)))
  }

  for (const rootFile of ROOT_FILES) {
    const absolutePath = path.join(ROOT, rootFile)
    if (await exists(absolutePath)) sourceFiles.push(absolutePath)
  }

  const normalizedFiles = [...new Set(sourceFiles.map((file) => path.normalize(file)))]
  const sourceSet = new Set(normalizedFiles)
  const importsByFile = new Map()
  const usedPackages = new Set()

  for (const file of normalizedFiles) {
    const source = await readFile(file, 'utf8')
    const imports = parseImports(source)
    importsByFile.set(file, imports)

    for (const specifier of imports) {
      const dependency = packageName(specifier)
      if (dependency) usedPackages.add(dependency)
    }
  }

  const graph = new Map()
  for (const [file, imports] of importsByFile) {
    const dependencies = []
    for (const specifier of imports) {
      if (!specifier.startsWith('.')) continue
      const resolved = await resolveRelativeImport(file, specifier, sourceSet)
      if (resolved) dependencies.push(resolved)
    }
    graph.set(file, dependencies)
  }

  const entryPoints = normalizedFiles.filter((file) => {
    const relative = toPosix(path.relative(ROOT, file))
    return (
      relative.startsWith('src/app/') ||
      relative === 'src/middleware.ts' ||
      relative === 'src/instrumentation.ts' ||
      relative === 'src/instrumentation-client.ts'
    )
  })

  const reachable = new Set()
  const queue = [...entryPoints]
  while (queue.length > 0) {
    const file = queue.pop()
    if (!file || reachable.has(file)) continue
    reachable.add(file)
    for (const dependency of graph.get(file) ?? []) queue.push(dependency)
  }

  const deadSolarFiles = normalizedFiles
    .filter((file) => {
      const relative = toPosix(path.relative(ROOT, file))
      return relative.startsWith('src/components/solar-system/') && !reachable.has(file)
    })
    .map((file) => toPosix(path.relative(ROOT, file)))
    .sort()

  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const dependencies = Object.keys(packageJson.dependencies ?? {})
  const devDependencies = Object.keys(packageJson.devDependencies ?? {})
  const unusedDependencies = dependencies
    .filter((dependency) => !usedPackages.has(dependency) && !IMPLICIT_PACKAGES.has(dependency))
    .sort()
  const unusedDevDependencies = devDependencies
    .filter((dependency) => {
      if (dependency.startsWith('@types/')) return false
      return !usedPackages.has(dependency) && !IMPLICIT_PACKAGES.has(dependency)
    })
    .sort()

  console.log(`[audit] scanned ${normalizedFiles.length} source/config files`)
  console.log(`[audit] ${entryPoints.length} application entry points; ${reachable.size} reachable modules`)
  console.log('\n[audit] unreachable solar-system modules:')
  if (deadSolarFiles.length === 0) console.log('  none')
  else deadSolarFiles.forEach((file) => console.log(`  ${file}`))

  console.log('\n[audit] unused runtime dependencies:')
  if (unusedDependencies.length === 0) console.log('  none')
  else unusedDependencies.forEach((dependency) => console.log(`  ${dependency}`))

  console.log('\n[audit] unused development dependencies:')
  if (unusedDevDependencies.length === 0) console.log('  none')
  else unusedDevDependencies.forEach((dependency) => console.log(`  ${dependency}`))

  console.log('\n[audit] report only; review results before deleting files or packages')
}

main().catch((error) => {
  console.error('[audit] failed')
  console.error(error)
  process.exitCode = 1
})
