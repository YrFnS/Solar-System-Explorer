import * as THREE from 'three'
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
  type CentaurData,
  type CometData,
  type DwarfPlanetData,
  type HumanArtifactData,
  type InterstellarObjectData,
  type MoonData,
  type PlanetData,
  type ScatteredDiscObjectData,
} from './data'
import type { ExperienceMode } from './experience-store'
import {
  DAY_MS,
  J2000_UNIX_MS,
  dateMsToJulianDate,
  getDaysSinceJ2000,
} from './simulation-clock'
import type { SpawnedObject } from './store'

export const ASTRONOMICAL_UNIT_KM = 149_597_870.7
const SECONDS_PER_DAY = 86_400
const TAU = Math.PI * 2

export type MajorPlanetId =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'

interface ElementPair {
  base: number
  rate: number
}

interface PlanetElementSet {
  a: ElementPair
  e: ElementPair
  inclination: ElementPair
  meanLongitude: ElementPair
  longitudePerihelion: ElementPair
  longitudeAscendingNode: ElementPair
  correction?: {
    b: number
    c: number
    s: number
    f: number
  }
}

interface EvaluatedElements {
  semiMajorAxisAu: number
  eccentricity: number
  inclinationRad: number
  meanLongitudeRad: number
  longitudePerihelionRad: number
  longitudeAscendingNodeRad: number
  argumentPerihelionRad: number
  meanAnomalyRad: number
}

interface OrbitalStateAu extends EvaluatedElements {
  positionAu: THREE.Vector3
  eccentricAnomalyRad: number
  trueAnomalyRad: number
  distanceAu: number
}

/**
 * JPL Solar System Dynamics low-precision element set (Table 2a/2b), valid
 * approximately 3000 BC through 3000 AD. These are intentionally used for an
 * offline educational visualizer; high-precision work belongs in Horizons.
 * Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html
 */
const JPL_ELEMENTS: Record<MajorPlanetId, PlanetElementSet> = {
  mercury: {
    a: { base: 0.38709843, rate: 0 },
    e: { base: 0.20563661, rate: 0.00002123 },
    inclination: { base: 7.00559432, rate: -0.00590158 },
    meanLongitude: { base: 252.25166724, rate: 149472.67486623 },
    longitudePerihelion: { base: 77.45771895, rate: 0.15940013 },
    longitudeAscendingNode: { base: 48.33961819, rate: -0.12214182 },
  },
  venus: {
    a: { base: 0.72332102, rate: -0.00000026 },
    e: { base: 0.00676399, rate: -0.00005107 },
    inclination: { base: 3.39777545, rate: 0.00043494 },
    meanLongitude: { base: 181.9797085, rate: 58517.8156026 },
    longitudePerihelion: { base: 131.76755713, rate: 0.05679648 },
    longitudeAscendingNode: { base: 76.67261496, rate: -0.27274174 },
  },
  earth: {
    a: { base: 1.00000018, rate: -0.00000003 },
    e: { base: 0.01673163, rate: -0.00003661 },
    inclination: { base: -0.00054346, rate: -0.01337178 },
    meanLongitude: { base: 100.46691572, rate: 35999.37306329 },
    longitudePerihelion: { base: 102.93005885, rate: 0.3179526 },
    longitudeAscendingNode: { base: -5.11260389, rate: -0.24123856 },
  },
  mars: {
    a: { base: 1.52371243, rate: 0.00000097 },
    e: { base: 0.09336511, rate: 0.00009149 },
    inclination: { base: 1.85181869, rate: -0.00724757 },
    meanLongitude: { base: -4.56813164, rate: 19140.29934243 },
    longitudePerihelion: { base: -23.91744784, rate: 0.45223625 },
    longitudeAscendingNode: { base: 49.71320984, rate: -0.26852431 },
  },
  jupiter: {
    a: { base: 5.20248019, rate: -0.00002864 },
    e: { base: 0.0485359, rate: 0.00018026 },
    inclination: { base: 1.29861416, rate: -0.00322699 },
    meanLongitude: { base: 34.33479152, rate: 3034.90371757 },
    longitudePerihelion: { base: 14.27495244, rate: 0.18199196 },
    longitudeAscendingNode: { base: 100.29282654, rate: 0.13024619 },
    correction: { b: -0.00012452, c: 0.0606406, s: -0.35635438, f: 38.35125 },
  },
  saturn: {
    a: { base: 9.54149883, rate: -0.00003065 },
    e: { base: 0.05550825, rate: -0.00032044 },
    inclination: { base: 2.49424102, rate: 0.00451969 },
    meanLongitude: { base: 50.07571329, rate: 1222.11494724 },
    longitudePerihelion: { base: 92.86136063, rate: 0.54179478 },
    longitudeAscendingNode: { base: 113.63998702, rate: -0.25015002 },
    correction: { b: 0.00025899, c: -0.13434469, s: 0.87320147, f: 38.35125 },
  },
  uranus: {
    a: { base: 19.18797948, rate: -0.00020455 },
    e: { base: 0.0468574, rate: -0.0000155 },
    inclination: { base: 0.77298127, rate: -0.00180155 },
    meanLongitude: { base: 314.20276625, rate: 428.49512595 },
    longitudePerihelion: { base: 172.43404441, rate: 0.09266985 },
    longitudeAscendingNode: { base: 73.96250215, rate: 0.05739699 },
    correction: { b: 0.00058331, c: -0.97731848, s: 0.17689245, f: 7.67025 },
  },
  neptune: {
    a: { base: 30.06952752, rate: 0.00006447 },
    e: { base: 0.00895439, rate: 0.00000818 },
    inclination: { base: 1.7700552, rate: 0.000224 },
    meanLongitude: { base: 304.22289287, rate: 218.46515314 },
    longitudePerihelion: { base: 46.68158724, rate: 0.01009938 },
    longitudeAscendingNode: { base: 131.78635853, rate: -0.00606302 },
    correction: { b: -0.00041348, c: 0.68346318, s: -0.10162547, f: 7.67025 },
  },
}

const DWARF_ECCENTRICITY: Record<string, number> = {
  pluto: 0.2488,
  ceres: 0.0758,
  eris: 0.44,
  makemake: 0.159,
  haumea: 0.191,
  apophis: 0.191,
  bennu: 0.204,
  orcus: 0.227,
  salacia: 0.106,
}

const KNOWN_SEMI_MAJOR_AXIS_AU: Record<string, number> = {
  chiron: 13.7,
  chariklo: 15.8,
  sedna: 506,
  gonggong: 67.5,
  quaoar: 43.7,
  orcus: 39.2,
}

const INTERSTELLAR_PERIHELION_MS: Record<string, number> = {
  oumuamua: Date.UTC(2017, 8, 9, 0, 0, 0),
  borisov: Date.UTC(2019, 11, 8, 0, 0, 0),
}

const BODY_MAP = new Map<string, BodyData>([
  ...planets.map((body) => [body.id, body] as const),
  ...dwarfPlanets.map((body) => [body.id, body] as const),
  ...comets.map((body) => [body.id, body] as const),
  ...interstellarObjects.map((body) => [body.id, body] as const),
  ...centaurs.map((body) => [body.id, body] as const),
  ...scatteredDiscObjects.map((body) => [body.id, body] as const),
  ...humanArtifacts.map((body) => [body.id, body] as const),
])

type BoundSmallBody = DwarfPlanetData | CometData | CentaurData | ScatteredDiscObjectData
export type BodyData = PlanetData | BoundSmallBody | InterstellarObjectData | HumanArtifactData

export interface BodyTelemetry {
  id: string
  source: 'jpl-approximate' | 'two-body' | 'hyperbolic-illustration' | 'fixed'
  distanceFromSunAu: number | null
  distanceFromSunKm: number | null
  orbitalSpeedKms: number | null
  semiMajorAxisAu: number | null
  eccentricity: number | null
  inclinationDeg: number | null
  orbitalPeriodDays: number | null
  trueAnomalyDeg: number | null
  visualPosition: [number, number, number]
  note: string
}

function degreesToRadians(value: number) {
  return THREE.MathUtils.degToRad(value)
}

function radiansToDegrees(value: number) {
  return THREE.MathUtils.radToDeg(value)
}

function normalizeRadians(value: number) {
  let normalized = value % TAU
  if (normalized > Math.PI) normalized -= TAU
  if (normalized < -Math.PI) normalized += TAU
  return normalized
}

function evaluatePair(pair: ElementPair, centuries: number) {
  return pair.base + pair.rate * centuries
}

function solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number) {
  const mean = normalizeRadians(meanAnomalyRad)
  let eccentricAnomaly = mean + eccentricity * Math.sin(mean)

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const numerator = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - mean
    const denominator = 1 - eccentricity * Math.cos(eccentricAnomaly)
    const correction = numerator / Math.max(1e-9, denominator)
    eccentricAnomaly -= correction
    if (Math.abs(correction) < 1e-10) break
  }

  return eccentricAnomaly
}

function solveHyperbolicAnomaly(meanAnomaly: number, eccentricity: number) {
  let anomaly = Math.asinh(meanAnomaly / Math.max(1.0001, eccentricity))

  for (let iteration = 0; iteration < 16; iteration += 1) {
    const sinh = Math.sinh(anomaly)
    const cosh = Math.cosh(anomaly)
    const numerator = eccentricity * sinh - anomaly - meanAnomaly
    const denominator = eccentricity * cosh - 1
    const correction = numerator / Math.max(1e-9, denominator)
    anomaly -= correction
    if (Math.abs(correction) < 1e-9) break
  }

  return anomaly
}

function rotateOrbitalCoordinates(
  xPrime: number,
  yPrime: number,
  inclinationRad: number,
  argumentPerihelionRad: number,
  ascendingNodeRad: number,
  target = new THREE.Vector3()
) {
  const cosOmega = Math.cos(argumentPerihelionRad)
  const sinOmega = Math.sin(argumentPerihelionRad)
  const cosNode = Math.cos(ascendingNodeRad)
  const sinNode = Math.sin(ascendingNodeRad)
  const cosInclination = Math.cos(inclinationRad)
  const sinInclination = Math.sin(inclinationRad)

  const x =
    (cosOmega * cosNode - sinOmega * sinNode * cosInclination) * xPrime +
    (-sinOmega * cosNode - cosOmega * sinNode * cosInclination) * yPrime
  const y =
    (cosOmega * sinNode + sinOmega * cosNode * cosInclination) * xPrime +
    (-sinOmega * sinNode + cosOmega * cosNode * cosInclination) * yPrime
  const z =
    sinOmega * sinInclination * xPrime +
    cosOmega * sinInclination * yPrime

  return target.set(x, y, z)
}

function evaluateMajorPlanetElements(id: MajorPlanetId, dateMs: number): EvaluatedElements {
  const centuries = (dateMsToJulianDate(dateMs) - 2_451_545) / 36_525
  const source = JPL_ELEMENTS[id]
  const semiMajorAxisAu = evaluatePair(source.a, centuries)
  const eccentricity = evaluatePair(source.e, centuries)
  const inclinationDeg = evaluatePair(source.inclination, centuries)
  const meanLongitudeDeg = evaluatePair(source.meanLongitude, centuries)
  const longitudePerihelionDeg = evaluatePair(source.longitudePerihelion, centuries)
  const longitudeAscendingNodeDeg = evaluatePair(source.longitudeAscendingNode, centuries)
  const correction = source.correction
  const periodicArgument = correction ? degreesToRadians(correction.f * centuries) : 0
  const meanAnomalyDeg =
    meanLongitudeDeg -
    longitudePerihelionDeg +
    (correction
      ? correction.b * centuries * centuries +
        correction.c * Math.cos(periodicArgument) +
        correction.s * Math.sin(periodicArgument)
      : 0)

  const longitudePerihelionRad = degreesToRadians(longitudePerihelionDeg)
  const longitudeAscendingNodeRad = degreesToRadians(longitudeAscendingNodeDeg)

  return {
    semiMajorAxisAu,
    eccentricity,
    inclinationRad: degreesToRadians(inclinationDeg),
    meanLongitudeRad: degreesToRadians(meanLongitudeDeg),
    longitudePerihelionRad,
    longitudeAscendingNodeRad,
    argumentPerihelionRad: longitudePerihelionRad - longitudeAscendingNodeRad,
    meanAnomalyRad: normalizeRadians(degreesToRadians(meanAnomalyDeg)),
  }
}

function getMajorPlanetStateAu(id: MajorPlanetId, dateMs: number): OrbitalStateAu {
  const elements = evaluateMajorPlanetElements(id, dateMs)
  const eccentricAnomalyRad = solveEccentricAnomaly(
    elements.meanAnomalyRad,
    elements.eccentricity
  )
  const xPrime =
    elements.semiMajorAxisAu *
    (Math.cos(eccentricAnomalyRad) - elements.eccentricity)
  const yPrime =
    elements.semiMajorAxisAu *
    Math.sqrt(1 - elements.eccentricity * elements.eccentricity) *
    Math.sin(eccentricAnomalyRad)
  const positionAu = rotateOrbitalCoordinates(
    xPrime,
    yPrime,
    elements.inclinationRad,
    elements.argumentPerihelionRad,
    elements.longitudeAscendingNodeRad
  )
  const trueAnomalyRad = Math.atan2(
    Math.sqrt(1 - elements.eccentricity * elements.eccentricity) *
      Math.sin(eccentricAnomalyRad),
    Math.cos(eccentricAnomalyRad) - elements.eccentricity
  )

  return {
    ...elements,
    positionAu,
    eccentricAnomalyRad,
    trueAnomalyRad,
    distanceAu: positionAu.length(),
  }
}

function getInclinationScale(mode: ExperienceMode) {
  return mode === 'scientific' ? 1 : 0.32
}

function eclipticToScene(
  position: THREE.Vector3,
  scale: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  const inclinationScale = getInclinationScale(mode)
  return target.set(
    position.x * scale,
    position.z * scale * inclinationScale,
    position.y * scale
  )
}

export function getMajorPlanetVisualPosition(
  body: PlanetData,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  const state = getMajorPlanetStateAu(body.id as MajorPlanetId, dateMs)
  const scale = body.orbitRadius / state.semiMajorAxisAu
  return eclipticToScene(state.positionAu, scale, mode, target)
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function stableAngle(value: string, salt: string) {
  return ((stableHash(`${value}:${salt}`) % 1_000_000) / 1_000_000) * TAU
}

function getBoundOrbitDefinition(body: BoundSmallBody) {
  const eccentricity =
    'orbitEccentricity' in body
      ? body.orbitEccentricity
      : DWARF_ECCENTRICITY[body.id] ?? 0.08
  const inclinationRad = degreesToRadians(body.orbitInclination)
  const ascendingNodeRad = stableAngle(body.id, 'node')
  const argumentPerihelionRad = stableAngle(body.id, 'perihelion')
  const initialAngle =
    'initialAngle' in body ? body.initialAngle : stableAngle(body.id, 'phase')
  const knownSemiMajorAxisAu = KNOWN_SEMI_MAJOR_AXIS_AU[body.id]
  const semiMajorAxisAu =
    knownSemiMajorAxisAu ??
    ('distanceFromSun' in body
      ? body.distanceFromSun / (ASTRONOMICAL_UNIT_KM / 1_000_000)
      : 'orbitalPeriod' in body
        ? Math.cbrt(Math.pow(body.orbitalPeriod / 365.25, 2))
        : Math.max(0.1, body.orbitRadius / 3))
  const orbitalPeriodDays =
    'orbitalPeriod' in body
      ? body.orbitalPeriod
      : Math.sqrt(Math.pow(semiMajorAxisAu, 3)) * 365.25
  const direction = body.orbitInclination > 90 ? -1 : 1

  return {
    eccentricity: Math.min(0.98, Math.max(0, eccentricity)),
    inclinationRad,
    ascendingNodeRad,
    argumentPerihelionRad,
    initialAngle,
    semiMajorAxisAu,
    orbitalPeriodDays: Math.max(0.01, orbitalPeriodDays),
    direction,
  }
}

function getBoundBodyVisualPosition(
  body: BoundSmallBody,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  const definition = getBoundOrbitDefinition(body)
  const daysSinceJ2000 = getDaysSinceJ2000(dateMs)
  const meanAnomaly = normalizeRadians(
    definition.initialAngle +
      definition.direction *
        (daysSinceJ2000 / definition.orbitalPeriodDays) *
        TAU
  )
  const eccentricAnomaly = solveEccentricAnomaly(
    meanAnomaly,
    definition.eccentricity
  )
  const xPrime =
    body.orbitRadius *
    (Math.cos(eccentricAnomaly) - definition.eccentricity)
  const yPrime =
    body.orbitRadius *
    Math.sqrt(1 - definition.eccentricity * definition.eccentricity) *
    Math.sin(eccentricAnomaly)
  const ecliptic = rotateOrbitalCoordinates(
    xPrime,
    yPrime,
    definition.inclinationRad,
    definition.argumentPerihelionRad,
    definition.ascendingNodeRad
  )

  return eclipticToScene(ecliptic, 1, mode, target)
}

function getInterstellarVisualPosition(
  body: InterstellarObjectData,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  const perihelionMs = INTERSTELLAR_PERIHELION_MS[body.id] ?? J2000_UNIX_MS
  const daysFromPerihelion = (dateMs - perihelionMs) / DAY_MS
  const meanAnomaly = THREE.MathUtils.clamp(
    daysFromPerihelion * Math.max(0.0007, body.orbitSpeed * 0.08),
    -9,
    9
  )
  const hyperbolicAnomaly = solveHyperbolicAnomaly(
    meanAnomaly,
    body.orbitEccentricity
  )
  const xPrime =
    body.orbitRadius *
    (body.orbitEccentricity - Math.cosh(hyperbolicAnomaly))
  const yPrime =
    body.orbitRadius *
    Math.sqrt(body.orbitEccentricity * body.orbitEccentricity - 1) *
    Math.sinh(hyperbolicAnomaly)
  const ecliptic = rotateOrbitalCoordinates(
    xPrime,
    yPrime,
    degreesToRadians(body.orbitInclination),
    stableAngle(body.id, 'hyperbolic-perihelion'),
    stableAngle(body.id, 'hyperbolic-node')
  )
  const length = ecliptic.length()
  if (length > 125) ecliptic.multiplyScalar(125 / length)

  return eclipticToScene(ecliptic, 1, mode, target)
}

function findMoon(bodyId: string) {
  for (const planet of planets) {
    const prefix = `${planet.id}-`
    if (!bodyId.startsWith(prefix)) continue
    const moonId = bodyId.slice(prefix.length)
    const moon = planet.moons.find(
      (candidate) => candidate.name.toLowerCase().replace(/\s+/g, '-') === moonId
    )
    if (moon) return { parent: planet, moon }
  }

  for (const dwarf of dwarfPlanets) {
    const prefix = `${dwarf.id}-`
    if (!bodyId.startsWith(prefix)) continue
    const moonId = bodyId.slice(prefix.length)
    const moon = dwarf.moons?.find(
      (candidate) => candidate.name.toLowerCase().replace(/\s+/g, '-') === moonId
    )
    if (moon) return { parent: dwarf, moon }
  }

  return null
}

export function getMoonLocalPosition(
  moon: MoonData,
  parentId: string,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  const daysSinceJ2000 = getDaysSinceJ2000(dateMs)
  const direction = moon.orbitSpeed < 0 ? -1 : 1
  const angle =
    stableAngle(`${parentId}:${moon.name}`, 'moon-phase') +
    direction * (daysSinceJ2000 / Math.max(0.01, moon.orbitalPeriod)) * TAU
  const inclination = mode === 'scientific'
    ? degreesToRadians((stableHash(moon.name) % 700) / 100)
    : 0

  return target.set(
    Math.cos(angle) * moon.orbitRadius,
    Math.sin(angle) * Math.sin(inclination) * moon.orbitRadius,
    Math.sin(angle) * Math.cos(inclination) * moon.orbitRadius
  )
}

function getArtifactVisualPosition(
  body: HumanArtifactData,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  const parentPosition = getBodyVisualPosition(body.parentId, dateMs, mode, target)
  const local = new THREE.Vector3()
  const daysSinceJ2000 = getDaysSinceJ2000(dateMs)
  const angle = stableAngle(body.id, 'artifact-phase') + daysSinceJ2000 * body.orbitSpeed * 0.04
  local.set(
    Math.cos(angle) * body.orbitRadius,
    mode === 'scientific' ? Math.sin(angle * 0.37) * body.orbitRadius * 0.08 : 0,
    Math.sin(angle) * body.orbitRadius
  )

  if (body.parentId === 'sun') return target.copy(local)
  return target.add(local)
}

export function getBodyVisualPosition(
  bodyId: string,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  if (bodyId === 'sun') return target.set(0, 0, 0)

  const moonMatch = findMoon(bodyId)
  if (moonMatch) {
    const parent = getBodyVisualPosition(moonMatch.parent.id, dateMs, mode, target)
    return parent.add(
      getMoonLocalPosition(
        moonMatch.moon,
        moonMatch.parent.id,
        dateMs,
        mode,
        new THREE.Vector3()
      )
    )
  }

  const planet = planets.find((candidate) => candidate.id === bodyId)
  if (planet) return getMajorPlanetVisualPosition(planet, dateMs, mode, target)

  const dwarf = dwarfPlanets.find((candidate) => candidate.id === bodyId)
  if (dwarf) return getBoundBodyVisualPosition(dwarf, dateMs, mode, target)

  const comet = comets.find((candidate) => candidate.id === bodyId)
  if (comet) return getBoundBodyVisualPosition(comet, dateMs, mode, target)

  const interstellar = interstellarObjects.find((candidate) => candidate.id === bodyId)
  if (interstellar) return getInterstellarVisualPosition(interstellar, dateMs, mode, target)

  const centaur = centaurs.find((candidate) => candidate.id === bodyId)
  if (centaur) return getBoundBodyVisualPosition(centaur, dateMs, mode, target)

  const scattered = scatteredDiscObjects.find((candidate) => candidate.id === bodyId)
  if (scattered) return getBoundBodyVisualPosition(scattered, dateMs, mode, target)

  const artifact = humanArtifacts.find((candidate) => candidate.id === bodyId)
  if (artifact) return getArtifactVisualPosition(artifact, dateMs, mode, target)

  const blackHole = blackHoles.find((candidate) => candidate.id === bodyId)
  if (blackHole) return target.fromArray(blackHole.position)

  const wormhole = wormholes.find((candidate) => candidate.id === bodyId)
  if (wormhole) return target.fromArray(wormhole.position)

  return target.set(0, 0, 0)
}

export function getBodyVisualVelocity(
  bodyId: string,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  const moonMatch = findMoon(bodyId)
  const stepDays = moonMatch ? 0.005 : 0.25
  const before = getBodyVisualPosition(
    bodyId,
    dateMs - stepDays * DAY_MS,
    mode,
    new THREE.Vector3()
  )
  const after = getBodyVisualPosition(
    bodyId,
    dateMs + stepDays * DAY_MS,
    mode,
    new THREE.Vector3()
  )
  return target.copy(after).sub(before).divideScalar(stepDays * 2)
}

export function getBodyRadius(bodyId: string) {
  if (bodyId === 'sun') return sunData.radius

  const moonMatch = findMoon(bodyId)
  if (moonMatch) return moonMatch.moon.radius

  const body = BODY_MAP.get(bodyId)
  if (body && 'radius' in body) return body.radius

  const blackHole = blackHoles.find((candidate) => candidate.id === bodyId)
  if (blackHole) return blackHole.eventHorizonRadius

  const wormhole = wormholes.find((candidate) => candidate.id === bodyId)
  if (wormhole) return wormhole.mouthRadius

  return 0.5
}

export function getPlanetRotationAngle(body: PlanetData, dateMs: number) {
  const elapsedHours = ((dateMs - J2000_UNIX_MS) / DAY_MS) * 24
  const direction = body.rotationSpeed < 0 ? -1 : 1
  return normalizeRadians(
    direction * (elapsedHours / Math.max(0.01, body.rotationPeriod)) * TAU
  )
}

export function getMoonRotationAngle(moon: MoonData, dateMs: number) {
  const elapsedDays = getDaysSinceJ2000(dateMs)
  const direction = moon.orbitSpeed < 0 ? -1 : 1
  return normalizeRadians(
    direction * (elapsedDays / Math.max(0.01, moon.orbitalPeriod)) * TAU
  )
}

function getActualSemiMajorAxisAu(body: BoundSmallBody) {
  const definition = getBoundOrbitDefinition(body)
  return definition.semiMajorAxisAu
}

function getPhysicalSpeedKms(semiMajorAxisAu: number, distanceAu: number) {
  if (semiMajorAxisAu <= 0 || distanceAu <= 0) return null
  const factor = 2 / distanceAu - 1 / semiMajorAxisAu
  if (factor <= 0) return null
  return 29.7846918 * Math.sqrt(factor)
}

export function getBodyTelemetry(
  bodyId: string,
  dateMs: number,
  mode: ExperienceMode
): BodyTelemetry {
  const visualPosition = getBodyVisualPosition(bodyId, dateMs, mode)
  const visualTuple = visualPosition.toArray() as [number, number, number]

  if (bodyId === 'sun') {
    return {
      id: bodyId,
      source: 'fixed',
      distanceFromSunAu: 0,
      distanceFromSunKm: 0,
      orbitalSpeedKms: 0,
      semiMajorAxisAu: null,
      eccentricity: null,
      inclinationDeg: null,
      orbitalPeriodDays: null,
      trueAnomalyDeg: null,
      visualPosition: visualTuple,
      note: 'Heliocentric origin of the explorer scene.',
    }
  }

  const planet = planets.find((candidate) => candidate.id === bodyId)
  if (planet) {
    const state = getMajorPlanetStateAu(planet.id as MajorPlanetId, dateMs)
    const before = getMajorPlanetStateAu(
      planet.id as MajorPlanetId,
      dateMs - 0.5 * DAY_MS
    ).positionAu
    const after = getMajorPlanetStateAu(
      planet.id as MajorPlanetId,
      dateMs + 0.5 * DAY_MS
    ).positionAu
    const speedKms =
      after.distanceTo(before) * ASTRONOMICAL_UNIT_KM / SECONDS_PER_DAY

    return {
      id: bodyId,
      source: 'jpl-approximate',
      distanceFromSunAu: state.distanceAu,
      distanceFromSunKm: state.distanceAu * ASTRONOMICAL_UNIT_KM,
      orbitalSpeedKms: speedKms,
      semiMajorAxisAu: state.semiMajorAxisAu,
      eccentricity: state.eccentricity,
      inclinationDeg: radiansToDegrees(state.inclinationRad),
      orbitalPeriodDays: planet.orbitalPeriod,
      trueAnomalyDeg: radiansToDegrees(state.trueAnomalyRad),
      visualPosition: visualTuple,
      note: 'Approximate JPL J2000 Keplerian elements; the visual distance scale remains compressed.',
    }
  }

  const bound = [
    ...dwarfPlanets,
    ...comets,
    ...centaurs,
    ...scatteredDiscObjects,
  ].find((candidate) => candidate.id === bodyId) as BoundSmallBody | undefined

  if (bound) {
    const definition = getBoundOrbitDefinition(bound)
    const currentVisualDistance = visualPosition.length()
    const visualSemiMajorAxis = Math.max(0.001, bound.orbitRadius)
    const distanceAu =
      getActualSemiMajorAxisAu(bound) * (currentVisualDistance / visualSemiMajorAxis)

    return {
      id: bodyId,
      source: 'two-body',
      distanceFromSunAu: distanceAu,
      distanceFromSunKm: distanceAu * ASTRONOMICAL_UNIT_KM,
      orbitalSpeedKms: getPhysicalSpeedKms(definition.semiMajorAxisAu, distanceAu),
      semiMajorAxisAu: definition.semiMajorAxisAu,
      eccentricity: definition.eccentricity,
      inclinationDeg: radiansToDegrees(definition.inclinationRad),
      orbitalPeriodDays: definition.orbitalPeriodDays,
      trueAnomalyDeg: null,
      visualPosition: visualTuple,
      note: 'Illustrative two-body orbit derived from the local object catalogue.',
    }
  }

  const interstellar = interstellarObjects.find((candidate) => candidate.id === bodyId)
  if (interstellar) {
    return {
      id: bodyId,
      source: 'hyperbolic-illustration',
      distanceFromSunAu: null,
      distanceFromSunKm: null,
      orbitalSpeedKms: null,
      semiMajorAxisAu: null,
      eccentricity: interstellar.orbitEccentricity,
      inclinationDeg: interstellar.orbitInclination,
      orbitalPeriodDays: null,
      trueAnomalyDeg: null,
      visualPosition: visualTuple,
      note: 'Illustrative hyperbolic path anchored near the documented perihelion epoch.',
    }
  }

  return {
    id: bodyId,
    source: 'fixed',
    distanceFromSunAu: null,
    distanceFromSunKm: null,
    orbitalSpeedKms: null,
    semiMajorAxisAu: null,
    eccentricity: null,
    inclinationDeg: null,
    orbitalPeriodDays: null,
    trueAnomalyDeg: null,
    visualPosition: visualTuple,
    note: 'No orbital telemetry is available for this scene object.',
  }
}

function sampleMajorPlanetOrbit(
  body: PlanetData,
  dateMs: number,
  mode: ExperienceMode,
  segments: number
) {
  const elements = evaluateMajorPlanetElements(body.id as MajorPlanetId, dateMs)
  const scale = body.orbitRadius / elements.semiMajorAxisAu
  const points: THREE.Vector3[] = []

  for (let index = 0; index <= segments; index += 1) {
    const eccentricAnomaly = (index / segments) * TAU
    const xPrime =
      elements.semiMajorAxisAu *
      (Math.cos(eccentricAnomaly) - elements.eccentricity)
    const yPrime =
      elements.semiMajorAxisAu *
      Math.sqrt(1 - elements.eccentricity * elements.eccentricity) *
      Math.sin(eccentricAnomaly)
    const ecliptic = rotateOrbitalCoordinates(
      xPrime,
      yPrime,
      elements.inclinationRad,
      elements.argumentPerihelionRad,
      elements.longitudeAscendingNodeRad
    )
    points.push(eclipticToScene(ecliptic, scale, mode))
  }

  return points
}

function sampleBoundOrbit(
  body: BoundSmallBody,
  mode: ExperienceMode,
  segments: number
) {
  const definition = getBoundOrbitDefinition(body)
  const points: THREE.Vector3[] = []

  for (let index = 0; index <= segments; index += 1) {
    const eccentricAnomaly = (index / segments) * TAU
    const xPrime =
      body.orbitRadius *
      (Math.cos(eccentricAnomaly) - definition.eccentricity)
    const yPrime =
      body.orbitRadius *
      Math.sqrt(1 - definition.eccentricity * definition.eccentricity) *
      Math.sin(eccentricAnomaly)
    const ecliptic = rotateOrbitalCoordinates(
      xPrime,
      yPrime,
      definition.inclinationRad,
      definition.argumentPerihelionRad,
      definition.ascendingNodeRad
    )
    points.push(eclipticToScene(ecliptic, 1, mode))
  }

  return points
}

function sampleInterstellarPath(
  body: InterstellarObjectData,
  mode: ExperienceMode,
  segments: number
) {
  const points: THREE.Vector3[] = []
  const node = stableAngle(body.id, 'hyperbolic-node')
  const perihelion = stableAngle(body.id, 'hyperbolic-perihelion')
  const inclination = degreesToRadians(body.orbitInclination)

  for (let index = 0; index <= segments; index += 1) {
    const anomaly = THREE.MathUtils.lerp(-2.1, 2.1, index / segments)
    const xPrime =
      body.orbitRadius *
      (body.orbitEccentricity - Math.cosh(anomaly))
    const yPrime =
      body.orbitRadius *
      Math.sqrt(body.orbitEccentricity * body.orbitEccentricity - 1) *
      Math.sinh(anomaly)
    const ecliptic = rotateOrbitalCoordinates(
      xPrime,
      yPrime,
      inclination,
      perihelion,
      node
    )
    const length = ecliptic.length()
    if (length > 125) ecliptic.multiplyScalar(125 / length)
    points.push(eclipticToScene(ecliptic, 1, mode))
  }

  return points
}

export function getOrbitPoints(
  bodyId: string,
  dateMs: number,
  mode: ExperienceMode,
  segments = 192
) {
  const planet = planets.find((candidate) => candidate.id === bodyId)
  if (planet) return sampleMajorPlanetOrbit(planet, dateMs, mode, segments)

  const bound = [
    ...dwarfPlanets,
    ...comets,
    ...centaurs,
    ...scatteredDiscObjects,
  ].find((candidate) => candidate.id === bodyId) as BoundSmallBody | undefined
  if (bound) return sampleBoundOrbit(bound, mode, segments)

  const interstellar = interstellarObjects.find((candidate) => candidate.id === bodyId)
  if (interstellar) return sampleInterstellarPath(interstellar, mode, segments)

  return []
}

export function getSpawnedObjectVisualPosition(
  object: SpawnedObject,
  dateMs: number,
  mode: ExperienceMode,
  target = new THREE.Vector3()
) {
  const timestampMatch = object.id.match(/(\d{10,})$/)
  const createdAt = timestampMatch ? Number(timestampMatch[1]) : J2000_UNIX_MS
  const elapsedDays = (dateMs - createdAt) / DAY_MS
  const inclination = degreesToRadians(object.orbitInclination)
  const node = stableAngle(object.id, 'spawn-node')
  const perihelion = stableAngle(object.id, 'spawn-perihelion')

  if (object.orbitEccentricity >= 1) {
    const meanAnomaly = THREE.MathUtils.clamp(
      elapsedDays * Math.max(0.002, object.orbitSpeed * 30),
      -7,
      7
    )
    const anomaly = solveHyperbolicAnomaly(meanAnomaly, object.orbitEccentricity)
    const xPrime =
      object.orbitRadius *
      (object.orbitEccentricity - Math.cosh(anomaly))
    const yPrime =
      object.orbitRadius *
      Math.sqrt(object.orbitEccentricity * object.orbitEccentricity - 1) *
      Math.sinh(anomaly)
    const ecliptic = rotateOrbitalCoordinates(
      xPrime,
      yPrime,
      inclination,
      perihelion,
      node
    )
    return eclipticToScene(ecliptic, 1, mode, target)
  }

  const eccentricity = Math.min(0.95, Math.max(0, object.orbitEccentricity))
  const periodDays = Math.max(20, Math.sqrt(Math.pow(object.orbitRadius / 9.2, 3)) * 365.25)
  const meanAnomaly = object.initialAngle + (elapsedDays / periodDays) * TAU
  const anomaly = solveEccentricAnomaly(meanAnomaly, eccentricity)
  const xPrime = object.orbitRadius * (Math.cos(anomaly) - eccentricity)
  const yPrime =
    object.orbitRadius *
    Math.sqrt(1 - eccentricity * eccentricity) *
    Math.sin(anomaly)
  const ecliptic = rotateOrbitalCoordinates(
    xPrime,
    yPrime,
    inclination,
    perihelion,
    node
  )
  return eclipticToScene(ecliptic, 1, mode, target)
}
