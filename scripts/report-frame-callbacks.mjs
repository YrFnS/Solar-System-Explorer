import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('src')
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const matches = []

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(absolute)
      return
    }
    if (!extensions.has(path.extname(entry.name))) return

    const source = await readFile(absolute, 'utf8')
    const callCount = (source.match(/\buseFrame\s*\(/g) ?? []).length
    if (callCount === 0) return

    matches.push({
      file: path.relative(process.cwd(), absolute).replaceAll('\\', '/'),
      callCount,
    })
  }))
}

await walk(root)
matches.sort((left, right) => left.file.localeCompare(right.file))

const total = matches.reduce((sum, match) => sum + match.callCount, 0)
console.log(`[frame-callback-report] ${total} direct useFrame callback(s) across ${matches.length} file(s)`)
for (const match of matches) {
  console.log(`[frame-callback-report] ${String(match.callCount).padStart(2, ' ')} ${match.file}`)
}
