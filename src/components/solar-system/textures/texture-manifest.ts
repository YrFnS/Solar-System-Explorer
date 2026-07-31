import manifestJson from './ktx2-manifest.json'
import type { EffectiveQuality } from '../performance-store'

export type Ktx2Codec = 'basis-lz' | 'uastc-ldr-4x4'
export type TextureRole = 'albedo' | 'alpha'
export type TextureColorSpace = 'srgb' | 'linear'

export interface Ktx2TextureEntry {
  id: string
  input: string
  sources: string[]
  role: TextureRole
  colorSpace: TextureColorSpace
  alpha: boolean
  codec: Ktx2Codec
  qlevel?: number
  clevel?: number
  uastcQuality?: number
  uastcRdoLambda?: number
  zstd?: number
}

interface Ktx2Manifest {
  version: number
  tiers: number[]
  textures: Ktx2TextureEntry[]
}

export const KTX2_MANIFEST = manifestJson as Ktx2Manifest

const QUALITY_WIDTHS: Record<EffectiveQuality, number> = {
  eco: 512,
  balanced: 1024,
  ultra: 2048,
}

function stripUrlDecorations(url: string) {
  const index = url.search(/[?#]/)
  return index >= 0 ? url.slice(0, index) : url
}

export function normalizeTextureSource(url: string) {
  const normalized = stripUrlDecorations(url)

  if (normalized.includes('earth_clouds_1024.png')) {
    return '/textures/earth-clouds.svg'
  }
  if (normalized.includes('moonmap1k.jpg') || normalized.includes('moon_1024.jpg')) {
    return '/textures/moon.jpg'
  }

  return normalized
}

const ENTRY_BY_SOURCE = new Map<string, Ktx2TextureEntry>()
for (const entry of KTX2_MANIFEST.textures) {
  ENTRY_BY_SOURCE.set(normalizeTextureSource(entry.input), entry)
  for (const source of entry.sources) {
    ENTRY_BY_SOURCE.set(normalizeTextureSource(source), entry)
  }
}

export function getKtx2TextureEntry(sourceUrl: string) {
  return ENTRY_BY_SOURCE.get(normalizeTextureSource(sourceUrl)) ?? null
}

export function getTextureTierWidth(quality: EffectiveQuality) {
  return QUALITY_WIDTHS[quality]
}

export function getKtx2TextureUrl(entry: Ktx2TextureEntry, quality: EffectiveQuality) {
  return `/textures/ktx2/${getTextureTierWidth(quality)}/${entry.id}.ktx2`
}

export function getTextureFallbackUrl(sourceUrl: string) {
  const entry = getKtx2TextureEntry(sourceUrl)
  return entry?.input ?? normalizeTextureSource(sourceUrl)
}
