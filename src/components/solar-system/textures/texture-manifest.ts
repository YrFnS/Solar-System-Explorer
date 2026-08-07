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

const TEXTURE_SOURCE_PATTERN = /\.(?:jpe?g|png|svg)$/i

function stripUrlDecorations(url: string) {
  const index = url.search(/[?#]/)
  return index >= 0 ? url.slice(0, index) : url
}

export function normalizeTextureSource(url: string) {
  const normalized = stripUrlDecorations(url)

  if (normalized.includes('earth_clouds_1024.png')) {
    return '/textures/earth-clouds.svg'
  }
  if (
    normalized.includes('moonmap1k.jpg')
    || normalized.includes('moon_1024.jpg')
    || normalized.includes('moonbump1k.jpg')
  ) {
    return '/textures/moon.jpg'
  }
  if (normalized.includes('earth_specular_2048.jpg')) {
    return '/textures/earth.jpg'
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

/**
 * Returns a concrete generated WebP path for the requested quality. The tier is
 * part of the URL itself, so React Three Fiber's loader cache cannot reuse a
 * 2K image after the application has moved to Eco.
 */
export function getTextureFallbackUrl(
  sourceUrl: string,
  quality: EffectiveQuality
) {
  const entry = getKtx2TextureEntry(sourceUrl)
  const canonicalSource = normalizeTextureSource(entry?.input ?? sourceUrl)

  if (
    !canonicalSource.startsWith('/textures/')
    || canonicalSource.startsWith('/textures/optimized/')
    || !TEXTURE_SOURCE_PATTERN.test(canonicalSource)
  ) {
    return canonicalSource
  }

  const relativePath = canonicalSource
    .slice('/textures/'.length)
    .replace(TEXTURE_SOURCE_PATTERN, '')

  return `/textures/optimized/${relativePath}-${getTextureTierWidth(quality)}.webp`
}
