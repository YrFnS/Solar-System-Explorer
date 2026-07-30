export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS
export const JULIAN_DATE_UNIX_EPOCH = 2_440_587.5
export const J2000_JULIAN_DATE = 2_451_545.0
export const J2000_UNIX_MS = Date.UTC(2000, 0, 1, 12, 0, 0)

export interface SimulationClockSnapshot {
  dateMs: number
  julianDate: number
  daysSinceJ2000: number
  revision: number
}

let currentDateMs = Date.now()
let revision = 0

function sanitizeDateMs(value: number) {
  if (!Number.isFinite(value)) return Date.now()

  // JPL's low-precision element set used by the explorer is intended for
  // approximately 3000 BC through 3000 AD. JavaScript can represent dates
  // beyond that range, but clamping protects the orbital solver from runaway
  // values after an accidental extreme time-warp.
  const minimum = Date.UTC(-2999, 0, 1, 0, 0, 0)
  const maximum = Date.UTC(3000, 11, 31, 23, 59, 59)
  return Math.min(maximum, Math.max(minimum, value))
}

export function setSimulationDateMs(dateMs: number) {
  currentDateMs = sanitizeDateMs(dateMs)
  revision += 1
  return currentDateMs
}

export function resetSimulationDateToNow() {
  return setSimulationDateMs(Date.now())
}

/**
 * The legacy UI describes `timeSpeed` as a multiplier and advances its clock by
 * one simulated minute per real second at 1x. P3 keeps that public contract so
 * the old controls, new mission control, and ephemeris engine stay in sync.
 * High warp presets simply use larger multipliers (1440x = one day/second).
 */
export function advanceSimulationClock(
  deltaSeconds: number,
  timeSpeed: number,
  paused: boolean
) {
  if (
    paused ||
    !Number.isFinite(deltaSeconds) ||
    deltaSeconds <= 0 ||
    deltaSeconds > 1 ||
    !Number.isFinite(timeSpeed) ||
    timeSpeed === 0
  ) {
    return currentDateMs
  }

  currentDateMs = sanitizeDateMs(
    currentDateMs + deltaSeconds * timeSpeed * MINUTE_MS
  )
  return currentDateMs
}

export function getSimulationDateMs() {
  return currentDateMs
}

export function getSimulationDate() {
  return new Date(currentDateMs)
}

export function dateMsToJulianDate(dateMs: number) {
  return dateMs / DAY_MS + JULIAN_DATE_UNIX_EPOCH
}

export function julianDateToDateMs(julianDate: number) {
  return (julianDate - JULIAN_DATE_UNIX_EPOCH) * DAY_MS
}

export function getJulianDate(dateMs = currentDateMs) {
  return dateMsToJulianDate(dateMs)
}

export function getDaysSinceJ2000(dateMs = currentDateMs) {
  return (dateMs - J2000_UNIX_MS) / DAY_MS
}

export function getJulianCenturiesSinceJ2000(dateMs = currentDateMs) {
  return (getJulianDate(dateMs) - J2000_JULIAN_DATE) / 36_525
}

export function getSimulationClockSnapshot(): SimulationClockSnapshot {
  return {
    dateMs: currentDateMs,
    julianDate: getJulianDate(),
    daysSinceJ2000: getDaysSinceJ2000(),
    revision,
  }
}

export function formatTimeWarp(timeSpeed: number) {
  const absolute = Math.abs(timeSpeed)
  const direction = timeSpeed < 0 ? 'reverse · ' : ''

  if (absolute === 0) return 'paused'
  if (absolute < 60) return `${direction}${absolute.toFixed(absolute < 10 ? 1 : 0)} min/s`

  const hoursPerSecond = absolute / 60
  if (hoursPerSecond < 24) return `${direction}${hoursPerSecond.toFixed(hoursPerSecond < 10 ? 1 : 0)} hr/s`

  const daysPerSecond = hoursPerSecond / 24
  if (daysPerSecond < 365.25) return `${direction}${daysPerSecond.toFixed(daysPerSecond < 10 ? 1 : 0)} day/s`

  const yearsPerSecond = daysPerSecond / 365.25
  return `${direction}${yearsPerSecond.toFixed(yearsPerSecond < 10 ? 1 : 0)} yr/s`
}
