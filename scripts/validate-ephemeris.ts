import {
  getBodyTelemetry,
  getBodyVisualPosition,
  getOrbitPoints,
} from '../src/components/solar-system/ephemeris'
import type { ExperienceMode } from '../src/components/solar-system/experience-store'

const modes: ExperienceMode[] = ['explore', 'scientific', 'sandbox']
const sampleDates = [
  Date.UTC(-1000, 0, 1, 12, 0, 0),
  Date.UTC(2000, 0, 1, 12, 0, 0),
  Date.UTC(2026, 6, 30, 12, 0, 0),
  Date.UTC(2999, 11, 31, 12, 0, 0),
]
const bodies = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'ceres',
  'halley',
  'chiron',
  'sedna',
  'oumuamua',
]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertFiniteVector(label: string, vector: { x: number; y: number; z: number }) {
  assert(Number.isFinite(vector.x), `${label}: x is not finite`)
  assert(Number.isFinite(vector.y), `${label}: y is not finite`)
  assert(Number.isFinite(vector.z), `${label}: z is not finite`)
}

for (const mode of modes) {
  for (const dateMs of sampleDates) {
    for (const bodyId of bodies) {
      const position = getBodyVisualPosition(bodyId, dateMs, mode)
      assertFiniteVector(`${mode}/${bodyId}/${new Date(dateMs).toISOString()}`, position)
      assert(position.length() < 20_000, `${bodyId}: runaway visual position`)
    }
  }
}

const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0)
const mercury = getBodyTelemetry('mercury', j2000, 'scientific')
const earth = getBodyTelemetry('earth', j2000, 'scientific')
const jupiter = getBodyTelemetry('jupiter', j2000, 'scientific')
const neptune = getBodyTelemetry('neptune', j2000, 'scientific')

assert(
  mercury.distanceFromSunAu !== null &&
    mercury.distanceFromSunAu > 0.3 &&
    mercury.distanceFromSunAu < 0.5,
  'Mercury is outside its expected heliocentric range at J2000'
)
assert(
  earth.distanceFromSunAu !== null &&
    earth.distanceFromSunAu > 0.98 &&
    earth.distanceFromSunAu < 1.02,
  'Earth is outside its expected heliocentric range at J2000'
)
assert(
  jupiter.distanceFromSunAu !== null &&
    jupiter.distanceFromSunAu > 4.9 &&
    jupiter.distanceFromSunAu < 5.5,
  'Jupiter is outside its expected heliocentric range at J2000'
)
assert(
  neptune.distanceFromSunAu !== null &&
    neptune.distanceFromSunAu > 29 &&
    neptune.distanceFromSunAu < 31,
  'Neptune is outside its expected heliocentric range at J2000'
)

for (const bodyId of ['earth', 'mars', 'jupiter', 'pluto', 'halley', 'oumuamua']) {
  const points = getOrbitPoints(bodyId, j2000, 'scientific', 96)
  assert(points.length >= 90, `${bodyId}: orbit path is unexpectedly short`)
  points.forEach((point, index) =>
    assertFiniteVector(`${bodyId} orbit point ${index}`, point)
  )
}

const earthAtJ2000 = getBodyVisualPosition('earth', j2000, 'scientific')
const earthOneMonthLater = getBodyVisualPosition(
  'earth',
  Date.UTC(2000, 1, 1, 12, 0, 0),
  'scientific'
)
assert(
  earthAtJ2000.distanceTo(earthOneMonthLater) > 0.5,
  'Earth did not advance meaningfully over one month'
)

console.log(
  `[ephemeris] ${bodies.length} bodies validated across ${sampleDates.length} epochs and ${modes.length} modes.`
)
