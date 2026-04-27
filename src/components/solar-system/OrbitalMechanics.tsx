import * as THREE from 'three'

/**
 * Solves Kepler's equation M = E - e*sin(E) using Newton-Raphson iteration
 * @param M Mean anomaly (radians)
 * @param e Orbital eccentricity
 * @param tolerance Convergence tolerance
 * @param maxIterations Maximum iterations (default 100)
 * @returns Eccentric anomaly E (radians)
 */
export function solveKeplerEquation(
  M: number,
  e: number,
  tolerance: number = 1e-8,
  maxIterations: number = 100
): number {
  // Handle hyperbolic case (e > 1)
  if (e >= 1) {
    return solveKeplerEquationHyperbolic(M, e, tolerance, maxIterations)
  }

  // Initial guess for eccentric anomaly
  let E = e > 0.8 ? Math.PI : M

  for (let i = 0; i < maxIterations; i++) {
    const sinE = Math.sin(E)
    const cosE = Math.cos(E)
    const f = E - e * sinE - M
    const fPrime = 1 - e * cosE

    const delta = f / fPrime
    E -= delta

    if (Math.abs(delta) < tolerance) {
      break
    }
  }

  return E
}

/**
 * Solves Kepler's equation for hyperbolic trajectories (e > 1)
 * M = e*sinh(H) - H
 * @param M Mean anomaly (radians)
 * @param e Orbital eccentricity (> 1)
 * @param tolerance Convergence tolerance
 * @param maxIterations Maximum iterations
 * @returns Hyperbolic eccentric anomaly H
 */
function solveKeplerEquationHyperbolic(
  M: number,
  e: number,
  tolerance: number = 1e-8,
  maxIterations: number = 100
): number {
  // Initial guess based on M
  let H = Math.sign(M) * Math.log(Math.abs(M) / (2 * e) + Math.sqrt(1 + (M / (2 * e)) ** 2))

  for (let i = 0; i < maxIterations; i++) {
    const sinhH = Math.sinh(H)
    const coshH = Math.cosh(H)
    const f = e * sinhH - H - M
    const fPrime = e * coshH - 1

    const delta = f / fPrime
    H -= delta

    if (Math.abs(delta) < tolerance) {
      break
    }
  }

  return H
}

/**
 * Calculates true anomaly from eccentric anomaly
 * @param E Eccentric anomaly (radians)
 * @param e Orbital eccentricity
 * @returns True anomaly (radians)
 */
export function calculateTrueAnomaly(E: number, e: number): number {
  if (e >= 1) {
    // Hyperbolic case: nu = 2 * arctan(sqrt((e+1)/(e-1)) * tanh(H/2))
    const H = E
    const coshH = Math.cosh(H)
    const sinhH = Math.sinh(H)
    return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * sinhH / (coshH + 1))
  }

  // Elliptical case: nu = 2 * arctan(sqrt((1+e)/(1-e)) * sin(E/2) / cos(E/2))
  const sinE = Math.sin(E)
  const cosE = Math.cos(E)
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * sinE,
    Math.sqrt(1 - e) * (cosE + 1)
  )
}

/**
 * Calculates the 3D orbital position using Kepler's equation
 * @param a Semi-major axis (AU, negative for hyperbolic)
 * @param e Orbital eccentricity
 * @param M Mean anomaly (radians)
 * @param inclination Orbital inclination (radians)
 * @param longitudeOfAscendingNode Longitude of ascending node (radians, default 0)
 * @param argumentOfPeriapsis Argument of periapsis (radians, default 0)
 * @returns THREE.Vector3 with x, y, z position (in AU)
 */
export function calculateOrbitalPosition(
  a: number,
  e: number,
  M: number,
  inclination: number,
  longitudeOfAscendingNode: number = 0,
  argumentOfPeriapsis: number = 0
): THREE.Vector3 {
  // Solve for eccentric anomaly
  const E = solveKeplerEquation(M, e)

  // Calculate true anomaly
  const nu = calculateTrueAnomaly(E, e)

  // Calculate distance from central body
  let r: number
  if (e >= 1) {
    // Hyperbolic trajectory: r = a * (1 - e^2) / (1 + e * cos(nu))
    r = Math.abs(a) * (e * e - 1) / (1 + e * Math.cos(nu))
  } else {
    // Elliptical orbit: r = a * (1 - e^2) / (1 + e * cos(nu))
    r = a * (1 - e * e) / (1 + e * Math.cos(nu))
  }

  // Position in orbital plane (perifocal coordinates)
  const xOrbital = r * Math.cos(nu)
  const yOrbital = r * Math.sin(nu)

  // Rotate by argument of periapsis
  const omega = argumentOfPeriapsis
  const x1 = xOrbital * Math.cos(omega) - yOrbital * Math.sin(omega)
  const y1 = xOrbital * Math.sin(omega) + yOrbital * Math.cos(omega)

  // Rotate by inclination
  const inc = inclination
  const x2 = x1
  const y2 = y1 * Math.cos(inc)
  const z2 = y1 * Math.sin(inc)

  // Rotate by longitude of ascending node
  const Omega = longitudeOfAscendingNode
  const x = x2 * Math.cos(Omega) - y2 * Math.sin(Omega)
  const y = x2 * Math.sin(Omega) + y2 * Math.cos(Omega)
  const z = z2

  return new THREE.Vector3(x, z, y) // Swap y/z for Three.js coordinate system
}

/**
 * Converts mean anomaly to time-based calculation
 * @param M Mean anomaly (radians)
 * @param a Semi-major axis (AU)
 * @param GM Gravitational parameter (AU^3/year^2, default is Sun's)
 * @returns Time in years from perihelion passage
 */
export function meanAnomalyToTime(M: number, a: number, GM: number = 1): number {
  // M = n * (t - tau) where n = sqrt(GM/a^3) is mean motion
  const n = Math.sqrt(GM / Math.pow(Math.abs(a), 3))
  return M / n
}

/**
 * Converts time to mean anomaly
 * @param t Time since perihelion (years)
 * @param a Semi-major axis (AU)
 * @param GM Gravitational parameter (AU^3/year^2, default is Sun's)
 * @returns Mean anomaly (radians)
 */
export function timeToMeanAnomaly(t: number, a: number, GM: number = 1): number {
  const n = Math.sqrt(GM / Math.pow(Math.abs(a), 3))
  return n * t
}