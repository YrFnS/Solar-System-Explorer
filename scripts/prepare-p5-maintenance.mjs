import { readFile, writeFile } from 'node:fs/promises'

const unusedRuntimeDependencies = [
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
  '@hookform/resolvers',
  '@mdxeditor/editor',
  '@react-three/postprocessing',
  '@reactuses/core',
  '@tanstack/react-query',
  '@tanstack/react-table',
  'date-fns',
  'framer-motion',
  'next-auth',
  'next-intl',
  'react-markdown',
  'react-syntax-highlighter',
  'uuid',
  'z-ai-web-dev-sdk',
  'zod',
]

async function patchEphemeris() {
  const filePath = 'src/components/solar-system/ephemeris.ts'
  let source = await readFile(filePath, 'utf8')

  const signatureBefore = `export function getBodyVisualPosition(
  bodyId: string,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {`
  const signatureAfter = `export function getBodyVisualPosition(
  bodyId: string,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
): THREE.Vector3 {`

  if (!source.includes(signatureBefore)) {
    throw new Error('Could not locate getBodyVisualPosition signature')
  }

  source = source.replace(signatureBefore, signatureAfter)
  source = source.replace(
    '    const parent = getBodyVisualPosition(moonMatch.parent.id, dateMs, mode, target)',
    '    const parent: THREE.Vector3 = getBodyVisualPosition(moonMatch.parent.id, dateMs, mode, target)'
  )

  await writeFile(filePath, source)
}

async function patchStoreContract() {
  const filePath = 'src/components/solar-system/store.ts'
  let source = await readFile(filePath, 'utf8')
  const before = `  setShowCentaurs: (show: boolean) => void
  setShowScatteredDisc: (show: boolean) => void
}`
  const after = `  setShowCentaurs: (show: boolean) => void
  setShowScatteredDisc: (show: boolean) => void
  setCameraMode: (mode: 'orbit' | 'fly') => void
  setRealisticDistances: (show: boolean) => void
  setRealisticSizes: (show: boolean) => void
  setShowPhenomena: (show: boolean) => void
  setShowSolarWind: (show: boolean) => void
  setShowZodiacalLight: (show: boolean) => void
  addExplosion: (position: [number, number, number], color: string) => void
  spawnObject: (type: 'comet' | 'asteroid' | 'interstellar') => void
  removeSpawnedObject: (id: string) => void
}`

  if (!source.includes(before)) {
    throw new Error('Could not locate SolarSystemState action boundary')
  }

  source = source.replace(before, after)
  await writeFile(filePath, source)
}

async function trimDependencies() {
  const filePath = 'package.json'
  const manifest = JSON.parse(await readFile(filePath, 'utf8'))

  for (const dependency of unusedRuntimeDependencies) {
    delete manifest.dependencies?.[dependency]
  }
  delete manifest.devDependencies?.['tw-animate-css']

  await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`)
}

await patchEphemeris()
await patchStoreContract()
await trimDependencies()
console.log('[p5-maintenance] prepared ephemeris, store contract, and dependency changes')
