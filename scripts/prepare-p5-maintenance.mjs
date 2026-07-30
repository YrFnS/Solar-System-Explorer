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

  if (source.includes(signatureBefore)) {
    source = source.replace(signatureBefore, signatureAfter)
  } else if (!source.includes(signatureAfter)) {
    throw new Error('Could not locate getBodyVisualPosition signature')
  }

  const parentBefore = '    const parent = getBodyVisualPosition(moonMatch.parent.id, dateMs, mode, target)'
  const parentAfter = '    const parent: THREE.Vector3 = getBodyVisualPosition(moonMatch.parent.id, dateMs, mode, target)'
  if (source.includes(parentBefore)) {
    source = source.replace(parentBefore, parentAfter)
  } else if (!source.includes(parentAfter)) {
    throw new Error('Could not locate recursive parent position')
  }

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

  if (source.includes(before)) {
    source = source.replace(before, after)
  } else if (!source.includes("  setCameraMode: (mode: 'orbit' | 'fly') => void")) {
    throw new Error('Could not locate SolarSystemState action boundary')
  }

  const screenshotBefore = `  addScreenshot: (dataUrl) => set((s) => ({ screenshotGallery: [...s.screenshotGallery, dataUrl] })),
  clearScreenshots: () => set({ screenshotGallery: [] }),`
  const screenshotAfter = `  addScreenshot: (url) => set((state) => {
    const nextGallery = [...state.screenshotGallery, url]
    const overflow = Math.max(0, nextGallery.length - 12)
    const discarded = overflow > 0 ? nextGallery.slice(0, overflow) : []

    if (typeof URL !== 'undefined') {
      for (const discardedUrl of discarded) {
        if (discardedUrl.startsWith('blob:')) URL.revokeObjectURL(discardedUrl)
      }
    }

    return { screenshotGallery: nextGallery.slice(-12) }
  }),
  clearScreenshots: () => set((state) => {
    if (typeof URL !== 'undefined') {
      for (const url of state.screenshotGallery) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      }
    }

    return { screenshotGallery: [] }
  }),`

  if (source.includes(screenshotBefore)) {
    source = source.replace(screenshotBefore, screenshotAfter)
  } else if (!source.includes('const overflow = Math.max(0, nextGallery.length - 12)')) {
    throw new Error('Could not locate screenshot gallery actions')
  }

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
console.log('[p5-maintenance] prepared ephemeris, store contract, screenshot retention, and dependency changes')
