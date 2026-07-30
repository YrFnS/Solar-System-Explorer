import {
  blackHoles,
  centaurs,
  comets,
  dwarfPlanets,
  humanArtifacts,
  interstellarObjects,
  planets,
  scatteredDiscObjects,
  sunData,
  wormholes,
} from '../data'

export type BodyCategory =
  | 'star'
  | 'planet'
  | 'moon'
  | 'dwarf'
  | 'comet'
  | 'interstellar'
  | 'centaur'
  | 'scattered-disc'
  | 'artifact'
  | 'exotic'

export interface BodyCatalogEntry {
  id: string
  name: string
  type: string
  category: BodyCategory
  color: string
  diameterKm?: number
  parentId?: string
  searchText: string
}

function entry(
  value: Omit<BodyCatalogEntry, 'searchText'>
): BodyCatalogEntry {
  return {
    ...value,
    searchText: `${value.name} ${value.type} ${value.category}`.toLowerCase(),
  }
}

const rawEntries: BodyCatalogEntry[] = [
  entry({
    id: 'sun',
    name: sunData.name,
    type: sunData.type,
    category: 'star',
    color: sunData.color,
    diameterKm: sunData.diameter,
  }),
  ...planets.map((planet) => entry({
    id: planet.id,
    name: planet.name,
    type: planet.type,
    category: 'planet',
    color: planet.color,
    diameterKm: planet.diameter,
  })),
  ...planets.flatMap((planet) => planet.moons.map((moon) => entry({
    id: `${planet.id}-${moon.name.toLowerCase()}`,
    name: moon.name,
    type: `${planet.name} moon`,
    category: 'moon',
    color: moon.color,
    diameterKm: moon.diameter,
    parentId: planet.id,
  }))),
  ...dwarfPlanets.map((body) => entry({
    id: body.id,
    name: body.name,
    type: body.type,
    category: 'dwarf',
    color: body.color,
    diameterKm: body.diameter,
  })),
  ...comets.map((body) => entry({
    id: body.id,
    name: body.name,
    type: body.type,
    category: 'comet',
    color: body.tailColor || body.color,
    diameterKm: body.diameter,
  })),
  ...interstellarObjects.map((body) => entry({
    id: body.id,
    name: body.name,
    type: body.type,
    category: 'interstellar',
    color: body.color,
    diameterKm: body.diameter / 1000,
  })),
  ...centaurs.map((body) => entry({
    id: body.id,
    name: body.name,
    type: body.type,
    category: 'centaur',
    color: body.color,
    diameterKm: body.diameter,
  })),
  ...scatteredDiscObjects.map((body) => entry({
    id: body.id,
    name: body.name,
    type: body.type,
    category: 'scattered-disc',
    color: body.color,
    diameterKm: body.diameter,
  })),
  ...humanArtifacts.map((body) => entry({
    id: body.id,
    name: body.name,
    type: body.type,
    category: 'artifact',
    color: body.color,
    parentId: body.parentId,
  })),
  ...blackHoles.map((body) => entry({
    id: body.id,
    name: body.name,
    type: 'Black hole',
    category: 'exotic',
    color: '#fb923c',
  })),
  ...wormholes.map((body) => entry({
    id: body.id,
    name: body.name,
    type: 'Wormhole',
    category: 'exotic',
    color: '#818cf8',
  })),
]

const deduplicated = new Map<string, BodyCatalogEntry>()
for (const body of rawEntries) {
  if (!deduplicated.has(body.id)) deduplicated.set(body.id, body)
}

export const BODY_CATALOG = [...deduplicated.values()]
export const BODY_BY_ID = new Map(BODY_CATALOG.map((body) => [body.id, body]))

export const PRIMARY_NAVIGATION_IDS = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]

export const PRIMARY_NAVIGATION_BODIES = PRIMARY_NAVIGATION_IDS
  .map((id) => BODY_BY_ID.get(id))
  .filter((body): body is BodyCatalogEntry => Boolean(body))

export function getBodyCatalogEntry(id: string | null | undefined) {
  return id ? BODY_BY_ID.get(id) ?? null : null
}

export function searchBodyCatalog(query: string, limit = 16) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (terms.length === 0) return BODY_CATALOG.slice(0, limit)

  return BODY_CATALOG
    .map((body) => {
      let score = 0
      for (const term of terms) {
        if (body.name.toLowerCase() === term) score += 12
        else if (body.name.toLowerCase().startsWith(term)) score += 8
        else if (body.name.toLowerCase().includes(term)) score += 5
        else if (body.searchText.includes(term)) score += 2
        else return { body, score: -1 }
      }
      if (body.category === 'planet' || body.category === 'star') score += 1
      return { body, score }
    })
    .filter((result) => result.score >= 0)
    .sort((a, b) => b.score - a.score || a.body.name.localeCompare(b.body.name))
    .slice(0, limit)
    .map((result) => result.body)
}
