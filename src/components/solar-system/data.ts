export interface MoonData {
  name: string
  radius: number // visual radius (scaled for display)
  orbitRadius: number // distance from parent planet (visual units)
  orbitSpeed: number // orbital speed factor
  color: string
  diameter: number // real diameter in km
  distanceFromPlanet: number // real distance in thousand km
  orbitalPeriod: number // in Earth days
  funFact: string
  textureUrl?: string
}

export interface PlanetData {
  id: string
  name: string
  type: string
  radius: number // visual radius (scaled for display)
  orbitRadius: number // visual distance from sun
  orbitSpeed: number // speed factor
  rotationSpeed: number // relative to Earth=1.0
  initialAngle: number // starting orbital angle in radians (deterministic)
  color: string
  emissiveColor?: string
  emissiveIntensity?: number
  hasAtmosphere: boolean
  atmosphereColor?: string
  atmosphereScale?: number
  hasRings?: boolean
  ringColor?: string
  ringInnerRadius?: number
  ringOuterRadius?: number
  ringOpacity?: number
  diameter: number // real diameter in km
  distanceFromSun: number // real distance in million km
  orbitalPeriod: number // in Earth days
  rotationPeriod: number // in hours
  numberOfMoons: number
  surfaceTemperature: string
  mass: string
  surfaceGravity: string
  escapeVelocity: string
  atmosphere: string
  axialTilt: number // axial tilt in degrees
  funFacts: string[]
  moons: MoonData[]
  textureUrl?: string
  bumpMapUrl?: string
  cloudMapUrl?: string
  ringTextureUrl?: string
}

export interface HumanArtifactData {
  id: string
  name: string
  type: string
  parentId: string // which planet it orbits near
  orbitRadius: number
  orbitSpeed: number
  size: number
  color: string
  funFact: string
  launchYear: number
  distance: string
  modelUrl?: string
}

// Scale factors for visualization
// We use logarithmic-ish scaling so everything is visible
const SUN_RADIUS = 2.5

export const sunData = {
  id: 'sun',
  name: 'Sun',
  type: 'Star',
  radius: SUN_RADIUS,
  color: '#FDB813',
  diameter: 1392700,
  surfaceTemperature: '5,500°C (surface)',
  coreTemperature: '15,000,000°C (core)',
  funFacts: [
    'The Sun contains 99.86% of all mass in the Solar System',
    'Light from the Sun takes about 8 minutes to reach Earth',
    'The Sun is about 4.6 billion years old',
    'About 1 million Earths could fit inside the Sun',
    'The Sun generates energy through nuclear fusion of hydrogen into helium',
  ],
  textureUrl: '/textures/sun.jpg',
}

export const planets: PlanetData[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    type: 'Terrestrial Planet',
    radius: 0.25,
    orbitRadius: 5.4,
    orbitSpeed: 4.15,
    rotationSpeed: 0.017,
    initialAngle: 4.40,
    color: '#8C7E6D',
    hasAtmosphere: false,
    axialTilt: 0.03,
    diameter: 4879,
    distanceFromSun: 57.9,
    orbitalPeriod: 88,
    rotationPeriod: 1407.6,
    numberOfMoons: 0,
    surfaceTemperature: '-180°C to 430°C',
    mass: '3.285 × 10²³ kg',
    surfaceGravity: '3.7 m/s²',
    escapeVelocity: '4.3 km/s',
    atmosphere: 'Minimal (O₂, Na, H₂)',
    funFacts: [
      'Mercury is the smallest planet in our solar system',
      'A day on Mercury lasts 59 Earth days',
      'Mercury has no atmosphere to retain heat',
      'It has a massive iron core that takes up 75% of the planet\'s radius',
    ],
    textureUrl: '/textures/mercury.jpg',
    moons: [],
  },
  {
    id: 'venus',
    name: 'Venus',
    type: 'Terrestrial Planet',
    radius: 0.45,
    orbitRadius: 7.2,
    orbitSpeed: 1.62,
    rotationSpeed: -0.004,
    initialAngle: 3.18,
    color: '#C4A882',
    hasAtmosphere: true,
    atmosphereColor: '#E8D5A3',
    atmosphereScale: 1.08,
    axialTilt: 177.4,
    diameter: 12104,
    distanceFromSun: 108.2,
    orbitalPeriod: 225,
    rotationPeriod: 5832.5,
    numberOfMoons: 0,
    surfaceTemperature: '462°C (average)',
    mass: '4.867 × 10²⁴ kg',
    surfaceGravity: '8.87 m/s²',
    escapeVelocity: '10.36 km/s',
    atmosphere: 'CO₂, N₂',
    funFacts: [
      'Venus rotates backwards compared to most planets',
      'A day on Venus is longer than its year',
      'Venus is the hottest planet despite not being closest to the Sun',
      'Its atmospheric pressure is 90 times that of Earth',
    ],
    textureUrl: '/textures/venus.jpg',
    moons: [],
  },
  {
    id: 'earth',
    name: 'Earth',
    type: 'Terrestrial Planet',
    radius: 0.5,
    orbitRadius: 8.5,
    orbitSpeed: 1.0,
    rotationSpeed: 1.0,
    initialAngle: 1.75,
    color: '#4B7BE5',
    hasAtmosphere: true,
    atmosphereColor: '#87CEEB',
    atmosphereScale: 1.06,
    axialTilt: 23.5,
    diameter: 12756,
    distanceFromSun: 149.6,
    orbitalPeriod: 365.25,
    rotationPeriod: 24,
    numberOfMoons: 1,
    surfaceTemperature: '-88°C to 58°C',
    mass: '5.972 × 10²⁴ kg',
    surfaceGravity: '9.81 m/s²',
    escapeVelocity: '11.19 km/s',
    atmosphere: 'N₂, O₂, Ar',
    funFacts: [
      'Earth is the only planet not named after a god',
      '70% of Earth\'s surface is covered in water',
      'Earth\'s rotation is gradually slowing down',
      'Earth has a powerful magnetic field that protects us from solar radiation',
    ],
    textureUrl: '/textures/earth.jpg',
    cloudMapUrl: '/textures/earth_clouds.jpg',
    moons: [
      {
        name: 'Moon',
        radius: 0.14,
        orbitRadius: 1.2,
        orbitSpeed: 13.0,
        color: '#CCCCCC',
        diameter: 3475,
        distanceFromPlanet: 384.4,
        orbitalPeriod: 27.3,
        funFact: 'The Moon is slowly drifting away from Earth at about 3.8 cm per year',
        textureUrl: '/textures/moon.jpg',
      },
    ],
  },
  {
    id: 'mars',
    name: 'Mars',
    type: 'Terrestrial Planet',
    radius: 0.35,
    orbitRadius: 10.2,
    orbitSpeed: 0.53,
    rotationSpeed: 0.97,
    initialAngle: 6.20,
    color: '#C1440E',
    hasAtmosphere: true,
    atmosphereColor: '#D4856A',
    atmosphereScale: 1.04,
    axialTilt: 25.2,
    diameter: 6792,
    distanceFromSun: 227.9,
    orbitalPeriod: 687,
    rotationPeriod: 24.6,
    numberOfMoons: 2,
    surfaceTemperature: '-140°C to 20°C',
    mass: '6.39 × 10²³ kg',
    surfaceGravity: '3.72 m/s²',
    escapeVelocity: '5.03 km/s',
    atmosphere: 'CO₂, N₂, Ar',
    funFacts: [
      'Mars has the largest volcano in the solar system — Olympus Mons',
      'Mars has two small, irregular moons that may be captured asteroids',
      'A year on Mars is almost twice as long as an Earth year',
      'Mars has seasons similar to Earth due to its axial tilt',
    ],
    textureUrl: '/textures/mars.jpg',
    moons: [
      {
        name: 'Phobos',
        radius: 0.06,
        orbitRadius: 0.7,
        orbitSpeed: 40.0,
        color: '#8B7D6B',
        diameter: 22.4,
        distanceFromPlanet: 9.4,
        orbitalPeriod: 0.32,
        funFact: 'Phobos is gradually spiraling inward and will crash into Mars in about 50 million years',
      },
      {
        name: 'Deimos',
        radius: 0.04,
        orbitRadius: 1.0,
        orbitSpeed: 20.0,
        color: '#9B8E7B',
        diameter: 12.4,
        distanceFromPlanet: 23.5,
        orbitalPeriod: 1.26,
        funFact: 'Deimos is one of the smallest moons in the solar system',
      },
    ],
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    type: 'Gas Giant',
    radius: 1.2,
    orbitRadius: 15.9,
    orbitSpeed: 0.084,
    rotationSpeed: 2.4,
    initialAngle: 0.60,
    color: '#C88B3A',
    hasAtmosphere: true,
    atmosphereColor: '#D4A04A',
    atmosphereScale: 1.05,
    axialTilt: 3.1,
    diameter: 142984,
    distanceFromSun: 778.6,
    orbitalPeriod: 4331,
    rotationPeriod: 9.9,
    numberOfMoons: 95,
    surfaceTemperature: '-108°C (cloud tops)',
    mass: '1.898 × 10²⁷ kg',
    surfaceGravity: '24.79 m/s²',
    escapeVelocity: '59.5 km/s',
    atmosphere: 'H₂, He',
    funFacts: [
      'Jupiter is the largest planet — more than 1,300 Earths could fit inside it',
      'The Great Red Spot is a storm that has raged for at least 350 years',
      'Jupiter has the shortest day of all planets — just under 10 hours',
      'Jupiter\'s magnetic field is 20,000 times stronger than Earth\'s',
    ],
    textureUrl: '/textures/jupiter.jpg',
    moons: [
      {
        name: 'Io',
        radius: 0.15,
        orbitRadius: 2.0,
        orbitSpeed: 15.0,
        color: '#E8D44D',
        diameter: 3643,
        distanceFromPlanet: 421.7,
        orbitalPeriod: 1.77,
        funFact: 'Io is the most volcanically active body in the solar system',
      },
      {
        name: 'Europa',
        radius: 0.13,
        orbitRadius: 2.6,
        orbitSpeed: 10.0,
        color: '#C8B89A',
        diameter: 3122,
        distanceFromPlanet: 671.1,
        orbitalPeriod: 3.55,
        funFact: 'Europa may have a subsurface ocean that could harbor life',
      },
      {
        name: 'Ganymede',
        radius: 0.18,
        orbitRadius: 3.2,
        orbitSpeed: 6.0,
        color: '#A09080',
        diameter: 5268,
        distanceFromPlanet: 1070.4,
        orbitalPeriod: 7.15,
        funFact: 'Ganymede is the largest moon in the solar system — bigger than Mercury',
      },
      {
        name: 'Callisto',
        radius: 0.16,
        orbitRadius: 3.8,
        orbitSpeed: 4.0,
        color: '#6B6050',
        diameter: 4821,
        distanceFromPlanet: 1882.7,
        orbitalPeriod: 16.69,
        funFact: 'Callisto is the most heavily cratered object in the solar system',
      },
    ],
  },
  {
    id: 'saturn',
    name: 'Saturn',
    type: 'Gas Giant',
    radius: 1.0,
    orbitRadius: 20.9,
    orbitSpeed: 0.034,
    rotationSpeed: 2.25,
    initialAngle: 1.40,
    color: '#EAD6A6',
    hasAtmosphere: true,
    atmosphereColor: '#F0E0B0',
    atmosphereScale: 1.04,
    axialTilt: 26.7,
    hasRings: true,
    ringColor: '#D4C090',
    ringInnerRadius: 1.3,
    ringOuterRadius: 2.4,
    ringOpacity: 0.85,
    diameter: 120536,
    distanceFromSun: 1433.5,
    orbitalPeriod: 10747,
    rotationPeriod: 10.7,
    numberOfMoons: 146,
    surfaceTemperature: '-139°C (cloud tops)',
    mass: '5.683 × 10²⁶ kg',
    surfaceGravity: '10.44 m/s²',
    escapeVelocity: '35.5 km/s',
    atmosphere: 'H₂, He',
    funFacts: [
      'Saturn\'s rings are made mostly of ice particles with some rocky debris',
      'Saturn is the least dense planet — it would float in water',
      'Winds on Saturn can reach 1,800 km/h',
      'Saturn\'s rings span up to 282,000 km but are only about 10 meters thick',
    ],
    textureUrl: '/textures/saturn.jpg',
    ringTextureUrl: '/textures/saturn_ring.png',
    moons: [
      {
        name: 'Titan',
        radius: 0.18,
        orbitRadius: 2.8,
        orbitSpeed: 5.0,
        color: '#D4A030',
        diameter: 5150,
        distanceFromPlanet: 1221.9,
        orbitalPeriod: 15.95,
        funFact: 'Titan is the only moon with a thick atmosphere and surface liquid (methane lakes)',
      },
      {
        name: 'Enceladus',
        radius: 0.08,
        orbitRadius: 2.0,
        orbitSpeed: 12.0,
        color: '#F0F0F0',
        diameter: 504,
        distanceFromPlanet: 238.0,
        orbitalPeriod: 1.37,
        funFact: 'Enceladus has geysers that spray water ice into space from a subsurface ocean',
      },
      {
        name: 'Rhea',
        radius: 0.09,
        orbitRadius: 2.4,
        orbitSpeed: 7.0,
        color: '#D0C8C0',
        diameter: 1528,
        distanceFromPlanet: 527.1,
        orbitalPeriod: 4.52,
        funFact: 'Rhea is Saturn\'s second-largest moon and may have a faint ring system of its own',
      },
      {
        name: 'Dione',
        radius: 0.08,
        orbitRadius: 2.1,
        orbitSpeed: 9.0,
        color: '#C8C0B8',
        diameter: 1123,
        distanceFromPlanet: 377.4,
        orbitalPeriod: 2.74,
        funFact: 'Dione has bright ice cliffs on its surface that may indicate geological activity',
      },
      {
        name: 'Mimas',
        radius: 0.06,
        orbitRadius: 1.6,
        orbitSpeed: 18.0,
        color: '#C8C8C8',
        diameter: 396,
        distanceFromPlanet: 185.5,
        orbitalPeriod: 0.94,
        funFact: 'Mimas has a giant impact crater that makes it look like the Death Star',
      },
    ],
  },
  {
    id: 'uranus',
    name: 'Uranus',
    type: 'Ice Giant',
    radius: 0.7,
    orbitRadius: 28.2,
    orbitSpeed: 0.012,
    rotationSpeed: -1.4,
    initialAngle: 5.13,
    color: '#9FC4C7',
    hasAtmosphere: true,
    atmosphereColor: '#B0D8DB',
    atmosphereScale: 1.04,
    axialTilt: 97.8,
    hasRings: true,
    ringColor: '#88AABB',
    ringInnerRadius: 0.9,
    ringOuterRadius: 1.2,
    ringOpacity: 0.2,
    diameter: 51118,
    distanceFromSun: 2872.5,
    orbitalPeriod: 30589,
    rotationPeriod: 17.2,
    numberOfMoons: 28,
    surfaceTemperature: '-224°C',
    mass: '8.681 × 10²⁵ kg',
    surfaceGravity: '8.69 m/s²',
    escapeVelocity: '21.3 km/s',
    atmosphere: 'H₂, He, CH₄',
    funFacts: [
      'Uranus rotates on its side with an axial tilt of 98°',
      'Uranus was the first planet discovered with a telescope (1781)',
      'Its blue-green color comes from methane in the atmosphere',
      'Uranus has 13 known rings',
    ],
    textureUrl: '/textures/uranus.jpg',
    ringTextureUrl: '/textures/saturn_ring.png',
    moons: [
      {
        name: 'Titania',
        radius: 0.1,
        orbitRadius: 1.5,
        orbitSpeed: 8.0,
        color: '#B0A090',
        diameter: 1578,
        distanceFromPlanet: 436.3,
        orbitalPeriod: 8.71,
        funFact: 'Titania is the largest moon of Uranus',
      },
      {
        name: 'Oberon',
        radius: 0.09,
        orbitRadius: 1.8,
        orbitSpeed: 6.0,
        color: '#A09080',
        diameter: 1523,
        distanceFromPlanet: 583.5,
        orbitalPeriod: 13.46,
        funFact: 'Oberon has a dark, heavily cratered surface',
      },
      {
        name: 'Miranda',
        radius: 0.06,
        orbitRadius: 1.1,
        orbitSpeed: 14.0,
        color: '#C0B8B0',
        diameter: 472,
        distanceFromPlanet: 129.9,
        orbitalPeriod: 1.41,
        funFact: 'Miranda has one of the most extreme and varied landscapes in the solar system',
      },
    ],
  },
  {
    id: 'neptune',
    name: 'Neptune',
    type: 'Ice Giant',
    radius: 0.65,
    orbitRadius: 34.3,
    orbitSpeed: 0.006,
    rotationSpeed: 1.49,
    initialAngle: 4.80,
    color: '#3E54E8',
    hasAtmosphere: true,
    atmosphereColor: '#5070FF',
    atmosphereScale: 1.04,
    axialTilt: 28.3,
    hasRings: true,
    ringColor: '#5566CC',
    ringInnerRadius: 0.85,
    ringOuterRadius: 1.1,
    ringOpacity: 0.15,
    diameter: 49528,
    distanceFromSun: 4495.1,
    orbitalPeriod: 59800,
    rotationPeriod: 16.1,
    numberOfMoons: 16,
    surfaceTemperature: '-214°C',
    mass: '1.024 × 10²⁶ kg',
    surfaceGravity: '11.15 m/s²',
    escapeVelocity: '23.5 km/s',
    atmosphere: 'H₂, He, CH₄',
    funFacts: [
      'Neptune has the strongest winds in the solar system — up to 2,100 km/h',
      'Neptune was the first planet located through mathematical prediction',
      'It takes Neptune 165 Earth years to orbit the Sun',
      'Neptune has completed only one orbit since its discovery in 1846',
    ],
    textureUrl: '/textures/neptune.jpg',
    moons: [
      {
        name: 'Triton',
        radius: 0.1,
        orbitRadius: 1.5,
        orbitSpeed: -8.0,
        color: '#C8C0D0',
        diameter: 2707,
        distanceFromPlanet: 354.8,
        orbitalPeriod: 5.88,
        funFact: 'Triton orbits Neptune in retrograde and may be a captured Kuiper Belt object',
      },
    ],
  },
]

export const humanArtifacts: HumanArtifactData[] = [
  {
    id: 'iss',
    name: 'ISS',
    type: 'Space Station',
    parentId: 'earth',
    orbitRadius: 0.8,
    orbitSpeed: 25.0,
    size: 0.06,
    color: '#CCCCCC',
    funFact: 'The ISS orbits Earth at 28,000 km/h and has been continuously occupied since 2000',
    launchYear: 1998,
    distance: '408 km above Earth',
  },
  {
    id: 'hubble',
    name: 'Hubble Space Telescope',
    type: 'Space Telescope',
    parentId: 'earth',
    orbitRadius: 0.9,
    orbitSpeed: 22.0,
    size: 0.04,
    color: '#AABBCC',
    funFact: 'Hubble has made over 1.5 million observations since its launch in 1990',
    launchYear: 1990,
    distance: '547 km above Earth',
  },
  {
    id: 'voyager1',
    name: 'Voyager 1',
    type: 'Space Probe',
    parentId: 'saturn',
    orbitRadius: 50,
    orbitSpeed: 0.001,
    size: 0.04,
    color: '#D4A050',
    funFact: 'Voyager 1 is the most distant human-made object, over 24 billion km from Earth',
    launchYear: 1977,
    distance: '24.4 billion km from Sun',
  },
  {
    id: 'voyager2',
    name: 'Voyager 2',
    type: 'Space Probe',
    parentId: 'neptune',
    orbitRadius: 45,
    orbitSpeed: 0.001,
    size: 0.04,
    color: '#D4A050',
    funFact: 'Voyager 2 is the only spacecraft to visit all four gas giants',
    launchYear: 1977,
    distance: '20.3 billion km from Sun',
  },
  {
    id: 'jwst',
    name: 'James Webb Space Telescope',
    type: 'Space Telescope',
    parentId: 'earth',
    orbitRadius: 1.5,
    orbitSpeed: 0.05,
    size: 0.05,
    color: '#DAA520',
    funFact: 'JWST peers into the universe with its 6.5m gold-coated mirror, seeing the earliest galaxies',
    launchYear: 2021,
    distance: '1.5 million km from Earth (L2 point)',
  },
  {
    id: 'parker',
    name: 'Parker Solar Probe',
    type: 'Space Probe',
    parentId: 'sun',
    orbitRadius: 4,
    orbitSpeed: 5.0,
    size: 0.03,
    color: '#FF6347',
    funFact: 'Parker Solar Probe is the fastest human-made object, reaching speeds over 635,000 km/h',
    launchYear: 2018,
    distance: 'Closest: 6.9 million km from Sun',
  },
  {
    id: 'juno',
    name: 'Juno',
    type: 'Space Probe',
    parentId: 'jupiter',
    orbitRadius: 2.5,
    orbitSpeed: 3.0,
    size: 0.04,
    color: '#B8860B',
    funFact: 'Juno has revealed Jupiter\'s deep atmosphere and massive polar cyclones',
    launchYear: 2011,
    distance: 'Orbiting Jupiter since 2016',
  },
  {
    id: 'newhorizons',
    name: 'New Horizons',
    type: 'Space Probe',
    parentId: 'pluto',
    orbitRadius: 2,
    orbitSpeed: 0.002,
    size: 0.04,
    color: '#CD853F',
    funFact: 'New Horizons gave us our first close-up look at Pluto in 2015',
    launchYear: 2006,
    distance: 'Flew past Pluto in 2015',
  },
  {
    id: 'cassini',
    name: 'Cassini-Huygens',
    type: 'Space Probe',
    parentId: 'saturn',
    orbitRadius: 2.5,
    orbitSpeed: 2.5,
    size: 0.04,
    color: '#D2691E',
    funFact: 'Cassini orbited Saturn for 13 years and its Huygens probe landed on Titan',
    launchYear: 1997,
    distance: 'Orbited Saturn 2004-2017',
  },
]

export const ASTEROID_BELT_INNER = 12
export const ASTEROID_BELT_OUTER = 15
export const ASTEROID_COUNT = 2000

export const KUIPER_BELT_INNER = 46
export const KUIPER_BELT_OUTER = 55
export const KUIPER_COUNT = 1500

export interface DwarfPlanetData {
  id: string
  name: string
  type: string
  radius: number
  orbitRadius: number
  orbitSpeed: number
  rotationSpeed: number
  color: string
  orbitInclination: number // degrees
  initialAngle: number // starting orbital angle in radians
  diameter: number
  distanceFromSun: number
  orbitalPeriod: number
  funFacts: string[]
  textureUrl?: string
}

export interface CometData {
  id: string
  name: string
  type: string
  radius: number
  orbitRadius: number // semi-major axis
  orbitEccentricity: number
  orbitSpeed: number
  orbitInclination: number
  color: string
  tailColor: string
  diameter: number
  orbitalPeriod: number
  funFacts: string[]
}

export const dwarfPlanets: DwarfPlanetData[] = [
  {
    id: 'pluto',
    name: 'Pluto',
    type: 'Dwarf Planet',
    radius: 0.15,
    orbitRadius: 53.5,
    orbitSpeed: 0.004,
    rotationSpeed: -0.15,
    color: '#C4A882',
    orbitInclination: 17,
    initialAngle: 3.90,
    diameter: 2377,
    distanceFromSun: 5906.4,
    orbitalPeriod: 90560,
    textureUrl: '/textures/pluto.jpg',
    funFacts: [
      'Pluto was reclassified from planet to dwarf planet in 2006',
      'Pluto has a heart-shaped nitrogen ice glacier called Tombaugh Regio',
      'Pluto is smaller than Earth\'s Moon',
      'NASA\'s New Horizons flew past Pluto in 2015, revealing stunning details',
    ],
  },
  {
    id: 'ceres',
    name: 'Ceres',
    type: 'Dwarf Planet',
    radius: 0.1,
    orbitRadius: 12.9,
    orbitSpeed: 0.21,
    rotationSpeed: 0.38,
    color: '#8B8682',
    orbitInclination: 10.6,
    initialAngle: 2.10,
    diameter: 940,
    distanceFromSun: 413.7,
    orbitalPeriod: 1682,
    funFacts: [
      'Ceres is the largest object in the asteroid belt',
      'Ceres was the first asteroid ever discovered (1801)',
      'It has bright spots that are likely salt deposits',
      'Ceres may have a subsurface ocean of liquid water',
    ],
  },
  {
    id: 'eris',
    name: 'Eris',
    type: 'Dwarf Planet',
    radius: 0.14,
    orbitRadius: 68.9,
    orbitSpeed: 0.012,
    rotationSpeed: 0.08,
    color: '#D4D0C8',
    orbitInclination: 44,
    initialAngle: 1.20,
    diameter: 2326,
    distanceFromSun: 10125,
    orbitalPeriod: 204199,
    funFacts: [
      'Eris\'s discovery led to the reclassification of Pluto',
      'Eris is the most massive dwarf planet in the Solar System',
      'It takes Eris 559 years to orbit the Sun',
      'Eris has one known moon named Dysnomia',
    ],
  },
  {
    id: 'makemake',
    name: 'Makemake',
    type: 'Dwarf Planet',
    radius: 0.11,
    orbitRadius: 58.3,
    orbitSpeed: 0.015,
    rotationSpeed: 0.3,
    color: '#B8A898',
    orbitInclination: 29,
    initialAngle: 4.50,
    diameter: 1430,
    distanceFromSun: 6850,
    orbitalPeriod: 111845,
    funFacts: [
      'Makemake is named after the Rapa Nui creation deity',
      'It is one of the brightest Kuiper Belt objects',
      'Makemake has no known atmosphere',
      'It was discovered in 2005',
    ],
  },
  {
    id: 'haumea',
    name: 'Haumea',
    type: 'Dwarf Planet',
    radius: 0.12,
    orbitRadius: 56.7,
    orbitSpeed: 0.015,
    rotationSpeed: 1.6, // Very fast rotation — 3.9h period
    color: '#E8E0D0',
    orbitInclination: 28.2,
    initialAngle: 0.80,
    diameter: 1560,
    distanceFromSun: 6452,
    orbitalPeriod: 103774,
    funFacts: [
      'Haumea is shaped like an elongated ellipsoid due to its rapid rotation',
      'It completes one rotation every 3.9 hours — the fastest in the Solar System',
      'Haumea has two known moons and a ring system',
      'It is named after the Hawaiian goddess of fertility',
    ],
  },
]

export const comets: CometData[] = [
  {
    id: 'halley',
    name: "Halley's Comet",
    type: 'Short-Period Comet',
    radius: 0.04,
    orbitRadius: 17.8, // average distance
    orbitEccentricity: 0.967,
    orbitSpeed: 0.02,
    orbitInclination: 162, // retrograde!
    color: '#B0C4DE',
    tailColor: '#87CEEB',
    diameter: 11,
    orbitalPeriod: 27510, // 75.3 years in days
    funFacts: [
      "Halley's Comet is visible from Earth every 75-79 years",
      'It was first recorded by astronomers in 240 BC',
      'The comet is named after Edmond Halley who predicted its return',
      'Next perihelion passage: July 2061',
    ],
  },
  {
    id: 'hale-bopp',
    name: 'Hale-Bopp',
    type: 'Long-Period Comet',
    radius: 0.05,
    orbitRadius: 186, // very elongated
    orbitEccentricity: 0.995,
    orbitSpeed: 0.001,
    orbitInclination: 89,
    color: '#E0E8F0',
    tailColor: '#B0D0FF',
    diameter: 60,
    orbitalPeriod: 912500, // ~2500 years in days
    funFacts: [
      'Hale-Bopp was one of the most widely observed comets of the 20th century',
      'It was visible to the naked eye for a record 18 months in 1996-1997',
      'Its nucleus is estimated at 40-80 km across',
      'It was discovered independently by Alan Hale and Thomas Bopp',
    ],
  },
  {
    id: 'neowise',
    name: 'NEOWISE',
    type: 'Long-Period Comet',
    radius: 0.04,
    orbitRadius: 110,
    orbitEccentricity: 0.999,
    orbitSpeed: 0.002,
    orbitInclination: 129,
    color: '#F0E8D0',
    tailColor: '#FFD080',
    diameter: 5,
    orbitalPeriod: 2470000, // ~6800 years in days
    funFacts: [
      'Comet NEOWISE was discovered on March 27, 2020 by the NEOWISE space telescope',
      'It was one of the brightest comets visible from the Northern Hemisphere since Hale-Bopp',
      'Its spectacular dual tail — one of dust, one of ions — was visible to the naked eye',
      'It will not return for approximately 6,800 years',
    ],
  },
  {
    id: 'encke',
    name: "Encke's Comet",
    type: 'Short-Period Comet',
    radius: 0.03,
    orbitRadius: 12,
    orbitEccentricity: 0.848,
    orbitSpeed: 0.05,
    orbitInclination: 11.8,
    color: '#C8D0D8',
    tailColor: '#A0C0E0',
    diameter: 4.8,
    orbitalPeriod: 1204, // 3.3 years in days
    funFacts: [
      "Encke's Comet has the shortest orbital period of any known comet at just 3.3 years",
      'It was the second periodic comet discovered after Halley\'s Comet',
      'It is the source of the Taurid meteor shower',
      'Johann Franz Encke computed its orbit in 1819',
    ],
  },
  {
    id: 'tempel1',
    name: 'Tempel 1',
    type: 'Short-Period Comet',
    radius: 0.03,
    orbitRadius: 4.5,
    orbitEccentricity: 0.517,
    orbitSpeed: 0.07,
    orbitInclination: 10.5,
    color: '#C8B8A0',
    tailColor: '#A0B0C0',
    diameter: 6,
    orbitalPeriod: 2020, // 5.5 years in days
    funFacts: [
      'Comet Tempel 1 was the target of NASA\'s Deep Impact mission in 2005',
      'Deep Impact launched an impactor that struck the comet to study its interior composition',
      'The impact crater was about 150 meters wide and 30 meters deep',
      'It was revisited by the Stardust-NExT mission in 2011, which observed the impact crater',
    ],
  },
  {
    id: 'wild2',
    name: 'Wild 2',
    type: 'Short-Period Comet',
    radius: 0.03,
    orbitRadius: 7.8,
    orbitEccentricity: 0.539,
    orbitSpeed: 0.04,
    orbitInclination: 3.2,
    color: '#D0C8B0',
    tailColor: '#B0C8D0',
    diameter: 5.5,
    orbitalPeriod: 2409, // 6.6 years in days
    funFacts: [
      'Comet Wild 2 was the target of NASA\'s Stardust mission',
      'Stardust collected dust samples from Wild 2\'s coma and returned them to Earth in 2006',
      'It was the first mission to return cometary material to Earth',
      'Analysis revealed minerals that formed near the Sun, suggesting large-scale mixing in the early Solar System',
    ],
  },
]

export interface InterstellarObjectData {
  id: string
  name: string
  type: 'Interstellar Object'
  radius: number
  orbitRadius: number // perihelion distance
  orbitEccentricity: number
  orbitSpeed: number
  orbitInclination: number
  color: string
  tailColor?: string
  diameter: number
  funFacts: string[]
}

export interface CentaurData {
  id: string
  name: string
  type: 'Centaur'
  radius: number
  orbitRadius: number
  orbitEccentricity: number
  orbitSpeed: number
  orbitInclination: number
  color: string
  hasRings?: boolean
  diameter: number
  funFacts: string[]
}

export interface ScatteredDiscObjectData {
  id: string
  name: string
  type: 'Scattered Disc Object'
  radius: number
  orbitRadius: number
  orbitEccentricity: number
  orbitSpeed: number
  orbitInclination: number
  color: string
  hasRings?: boolean
  diameter: number
  funFacts: string[]
}

export const interstellarObjects: InterstellarObjectData[] = [
  {
    id: 'oumuamua',
    name: "'Oumuamua",
    type: 'Interstellar Object',
    radius: 0.04,
    orbitRadius: 5, // perihelion ~0.26 AU
    orbitEccentricity: 1.2, // hyperbolic
    orbitSpeed: 0.03,
    orbitInclination: 0,
    color: '#C89080',
    diameter: 230, // ~230m long
    funFacts: [
      "'Oumuamua was the first confirmed interstellar object to pass through our Solar System",
      "Its elongated, cigar-like shape is unlike anything seen in our Solar System",
      "It tumbled end over end, completing a rotation every 7-8 hours",
      "Its extreme eccentricity of ~1.2 confirms it originated outside our Solar System",
      "The name means 'scout' or 'messenger' in Hawaiian",
    ],
  },
  {
    id: 'borisov',
    name: 'Borisov',
    type: 'Interstellar Object',
    radius: 0.06,
    orbitRadius: 4, // perihelion ~2 AU
    orbitEccentricity: 3.3, // extremely hyperbolic
    orbitSpeed: 0.02,
    orbitInclination: 15,
    color: '#8090C8',
    tailColor: '#8090C8',
    diameter: 1000, // ~1km
    funFacts: [
      "Borisov was the second confirmed interstellar object, discovered in 2019",
      "Unlike 'Oumuamua, Borisov looked like a typical comet with a visible tail",
      "Its extreme eccentricity of ~3.3 proves it came from another star system",
      "It was discovered by amateur astronomer Gennadiy Borisov",
      "Analysis suggests it formed around a red dwarf star",
    ],
  },
]

export const centaurs: CentaurData[] = [
  {
    id: 'chiron',
    name: 'Chiron',
    type: 'Centaur',
    radius: 0.06,
    orbitRadius: 25.1,
    orbitEccentricity: 0.38,
    orbitSpeed: 0.02,
    orbitInclination: 6.9,
    color: '#9090A0',
    diameter: 218,
    funFacts: [
      "Chiron was the first identified centaur, discovered in 1977",
      "It displays characteristics of both asteroids and comets — it has a coma",
      "Its orbit crosses those of both Saturn and Uranus",
      "Named after the wisest of the centaurs in Greek mythology",
    ],
  },
  {
    id: 'chariklo',
    name: 'Chariklo',
    type: 'Centaur',
    radius: 0.07,
    orbitRadius: 27.2,
    orbitEccentricity: 0.17,
    orbitSpeed: 0.02,
    orbitInclination: 23.4,
    color: '#A0A0B0',
    hasRings: true,
    diameter: 258,
    funFacts: [
      "Chariklo is the first known centaur — and smallest object — to have rings!",
      "It has two thin, dense rings named Oiapoque and Chuí after Brazilian rivers",
      "The rings were discovered in 2013 during a stellar occultation",
      "Chariklo is the largest known centaur",
    ],
  },
]

export const scatteredDiscObjects: ScatteredDiscObjectData[] = [
  {
    id: 'sedna',
    name: 'Sedna',
    type: 'Scattered Disc Object',
    radius: 0.1,
    orbitRadius: 65,
    orbitEccentricity: 0.85,
    orbitSpeed: 0.015,
    orbitInclination: 11.9,
    color: '#C09070',
    diameter: 995,
    funFacts: [
      "Sedna has one of the most extreme orbits known — its year is about 11,400 Earth years",
      "At its farthest, Sedna is about 937 AU from the Sun",
      "It is one of the reddest objects in the Solar System",
      "Sedna may have originated from the inner Oort Cloud",
      "Named after the Inuit goddess of the sea",
    ],
  },
  {
    id: 'gonggong',
    name: 'Gonggong',
    type: 'Scattered Disc Object',
    radius: 0.12,
    orbitRadius: 60,
    orbitEccentricity: 0.19,
    orbitSpeed: 0.015,
    orbitInclination: 30.7,
    color: '#C08080',
    diameter: 1535,
    funFacts: [
      "Gonggong is named after a Chinese water god who caused floods",
      "It has a pinkish-red color due to methane and ethane ices on its surface",
      "Gonggong has one known moon named Xiangliu, after a nine-headed snake",
      "Its high orbital inclination of 30.7° suggests a chaotic past",
    ],
  },
  {
    id: 'quaoar',
    name: 'Quaoar',
    type: 'Scattered Disc Object',
    radius: 0.09,
    orbitRadius: 54,
    orbitEccentricity: 0.04,
    orbitSpeed: 0.018,
    orbitInclination: 8.0,
    color: '#B0A090',
    hasRings: true,
    diameter: 1110,
    funFacts: [
      "Quaoar has a ring that exists at a distance that defies current ring formation theories",
      "Its ring is much farther out than the Roche limit, where rings should normally form",
      "Quaoar is named after the creation deity of the Tongva people",
      "It was discovered in 2002 and is one of the largest known trans-Neptunian objects",
    ],
  },
  {
    id: 'orcus',
    name: 'Orcus',
    type: 'Scattered Disc Object',
    radius: 0.08,
    orbitRadius: 50,
    orbitEccentricity: 0.22,
    orbitSpeed: 0.018,
    orbitInclination: 20.6,
    color: '#909080',
    diameter: 917,
    funFacts: [
      "Orcus is considered Pluto's 'anti-twin' — it's on the opposite side of the Sun",
      "When Pluto is at perihelion, Orcus is near aphelion and vice versa",
      "Named after the Etruscan god of the underworld, counterpart to Roman Pluto",
      "Orcus has one known moon, Vanth, named after an Etruscan underworld demon",
    ],
  },
]

// ─── Black Hole Data ────────────────────────────────────────────
export interface BlackHoleData {
  id: string
  name: string
  position: [number, number, number]
  mass: number // in solar masses
  eventHorizonRadius: number // visual radius
  description: string
  funFacts: string[]
}

export const blackHoles: BlackHoleData[] = [
  {
    id: 'sagittarius-a',
    name: 'Sagittarius A*',
    position: [95, 8, -60],
    mass: 4000000, // 4 million solar masses
    eventHorizonRadius: 1.2, // visual radius for display
    description: 'The supermassive black hole at the center of the Milky Way galaxy, approximately 26,000 light-years from Earth.',
    funFacts: [
      "Sagittarius A* has a mass of about 4 million times that of our Sun",
      "Its event horizon is about 12 million km across — roughly the size of Mercury's orbit",
      "In May 2022, the Event Horizon Telescope captured the first image of Sgr A*",
      "Matter falling into Sgr A* takes millions of years to cross the event horizon",
      "The black hole's accretion disk glows at millions of degrees due to friction",
    ],
  },
]

// ─── Wormhole Data ──────────────────────────────────────────────
export interface WormholeData {
  id: string
  name: string
  position: [number, number, number]
  throatRadius: number
  mouthRadius: number
  description: string
  funFacts: string[]
}

export const wormholes: WormholeData[] = [
  {
    id: 'wormhole',
    name: 'Einstein-Rosen Bridge',
    position: [-85, -12, 75],
    throatRadius: 1.2,
    mouthRadius: 3.0,
    description: 'A traversable wormhole based on the Morris-Thorne metric. Exotic matter with negative energy density stabilises the throat, allowing theoretical passage between two distant regions of spacetime.',
    funFacts: [
      "The Morris-Thorne metric (1987) describes a theoretically traversable wormhole that requires exotic matter with negative energy density to keep the throat open.",
      "Frame-dragging in a rotating wormhole causes the spiral pattern visible at each mouth — space itself is twisted by the rotation.",
      "Einstein-Rosen bridges were first described in 1935 as solutions to the Einstein field equations, though the original solutions were not traversable.",
      "The exotic matter stabilising this wormhole violates the null energy condition — something only possible quantum-mechanically via the Casimir effect.",
    ],
  },
]

// All selectable body IDs for the dropdown
export const allBodyIds = [
  'sun',
  ...planets.map((p) => p.id),
  ...dwarfPlanets.map((d) => d.id),
  ...comets.map((c) => c.id),
  ...interstellarObjects.map((o) => o.id),
  ...centaurs.map((c) => c.id),
  ...scatteredDiscObjects.map((s) => s.id),
  ...blackHoles.map((b) => b.id),
  ...wormholes.map((w) => w.id),
  ...planets.flatMap((p) => p.moons.map((m) => `${p.id}-${m.name.toLowerCase()}`)),
  ...humanArtifacts.map((a) => a.id),
]

export function getBodyInfo(id: string): {
  name: string
  type: string
  details: Record<string, string | number>
  funFacts: string[]
  physicsNote?: string
} | null {
  if (id === 'sun') {
    return {
      name: sunData.name,
      type: sunData.type,
      details: {
        'Diameter': `${sunData.diameter.toLocaleString()} km`,
        'Surface Temperature': sunData.surfaceTemperature,
        'Core Temperature': sunData.coreTemperature,
        'Age': '~4.6 billion years',
        'Spectral Type': 'G2V (Yellow Dwarf)',
        'Mass': '1.989 × 10³⁰ kg',
      },
      funFacts: sunData.funFacts,
    }
  }

  const planet = planets.find((p) => p.id === id)
  if (planet) {
    return {
      name: planet.name,
      type: planet.type,
      details: {
        'Diameter': `${planet.diameter.toLocaleString()} km`,
        'Distance from Sun': `${planet.distanceFromSun} million km`,
        'Orbital Period': `${planet.orbitalPeriod.toLocaleString()} Earth days`,
        'Rotation Period': `${planet.rotationPeriod} hours`,
        'Known Moons': planet.numberOfMoons,
        'Axial Tilt': `${planet.axialTilt}°`,
        'Surface Temperature': planet.surfaceTemperature,
        'Mass': planet.mass,
        'Surface Gravity': planet.surfaceGravity,
        'Escape Velocity': planet.escapeVelocity,
        'Atmosphere': planet.atmosphere,
      },
      funFacts: planet.funFacts,
    }
  }

  // Check moons
  for (const planet of planets) {
    const moon = planet.moons.find(
      (m) => `${planet.id}-${m.name.toLowerCase()}` === id
    )
    if (moon) {
      return {
        name: moon.name,
        type: 'Moon',
        details: {
          'Parent Planet': planet.name,
          'Diameter': `${moon.diameter.toLocaleString()} km`,
          'Distance from Planet': `${moon.distanceFromPlanet} thousand km`,
          'Orbital Period': `${moon.orbitalPeriod} Earth days`,
        },
        funFacts: [moon.funFact],
      }
    }
  }

  // Check human artifacts
  const artifact = humanArtifacts.find((a) => a.id === id)
  if (artifact) {
    return {
      name: artifact.name,
      type: artifact.type,
      details: {
        'Launch Year': artifact.launchYear,
        'Distance': artifact.distance,
        'Type': artifact.type,
      },
      funFacts: [artifact.funFact],
    }
  }

  // Check dwarf planets
  const dwarfPlanet = dwarfPlanets.find((d) => d.id === id)
  if (dwarfPlanet) {
    return {
      name: dwarfPlanet.name,
      type: dwarfPlanet.type,
      details: {
        'Diameter': `${dwarfPlanet.diameter.toLocaleString()} km`,
        'Distance from Sun': `${dwarfPlanet.distanceFromSun.toLocaleString()} million km`,
        'Orbital Period': `${dwarfPlanet.orbitalPeriod.toLocaleString()} Earth days`,
        'Orbit Inclination': `${dwarfPlanet.orbitInclination}°`,
      },
      funFacts: dwarfPlanet.funFacts,
    }
  }

  // Check comets
  const comet = comets.find((c) => c.id === id)
  if (comet) {
    return {
      name: comet.name,
      type: comet.type,
      details: {
        'Nucleus Diameter': `${comet.diameter} km`,
        'Orbital Period': `${(comet.orbitalPeriod / 365.25).toFixed(1)} years`,
        'Orbit Eccentricity': comet.orbitEccentricity.toFixed(3),
        'Orbit Inclination': `${comet.orbitInclination}°`,
      },
      funFacts: comet.funFacts,
    }
  }

  // Check interstellar objects
  const interstellarObj = interstellarObjects.find((o) => o.id === id)
  if (interstellarObj) {
    return {
      name: interstellarObj.name,
      type: interstellarObj.type,
      details: {
        'Estimated Diameter': interstellarObj.diameter >= 1000 ? `${(interstellarObj.diameter / 1000).toFixed(1)} km` : `${interstellarObj.diameter} m`,
        'Orbit Eccentricity': interstellarObj.orbitEccentricity.toFixed(1),
        'Perihelion Distance': `${interstellarObj.orbitRadius} AU (visual)`,
        'Orbit Inclination': `${interstellarObj.orbitInclination}°`,
      },
      funFacts: interstellarObj.funFacts,
    }
  }

  // Check centaurs
  const centaur = centaurs.find((c) => c.id === id)
  if (centaur) {
    return {
      name: centaur.name,
      type: centaur.type,
      details: {
        'Diameter': `${centaur.diameter} km`,
        'Orbit Radius': `${centaur.orbitRadius} AU (visual)`,
        'Orbit Eccentricity': centaur.orbitEccentricity.toFixed(2),
        'Orbit Inclination': `${centaur.orbitInclination}°`,
        'Has Rings': centaur.hasRings ? 'Yes' : 'No',
      },
      funFacts: centaur.funFacts,
    }
  }

  // Check scattered disc objects
  const sdo = scatteredDiscObjects.find((s) => s.id === id)
  if (sdo) {
    return {
      name: sdo.name,
      type: sdo.type,
      details: {
        'Diameter': `${sdo.diameter.toLocaleString()} km`,
        'Orbit Radius': `${sdo.orbitRadius} AU (visual)`,
        'Orbit Eccentricity': sdo.orbitEccentricity.toFixed(2),
        'Orbit Inclination': `${sdo.orbitInclination}°`,
        'Has Rings': sdo.hasRings ? 'Yes' : 'No',
      },
      funFacts: sdo.funFacts,
    }
  }

  // Check black holes
  const blackHole = blackHoles.find((b) => b.id === id)
  if (blackHole) {
    // Physics calculations for Sgr A*
    // G = 6.674e-11 m³/(kg·s²), M_sun = 1.989e30 kg, c = 2.998e8 m/s
    const G = 6.674e-11
    const M_sun = 1.989e30
    const c = 2.998e8
    const hbar = 1.055e-34
    const k_B = 1.381e-23
    const M = blackHole.mass * M_sun // kg
    // Schwarzschild Radius: Rs = 2GM/c²
    const Rs = (2 * G * M) / (c * c) // meters
    const Rs_km = Rs / 1000
    // Photon Sphere: 1.5 × Rs
    const photonSphere_km = 1.5 * Rs_km
    // ISCO: 3 × Rs
    const isco_km = 3 * Rs_km
    // Hawking Temperature: T = ℏc³/(8πGMk_B)
    const T_hawking = (hbar * c * c * c) / (8 * Math.PI * G * M * k_B)

    return {
      name: blackHole.name,
      type: 'Supermassive Black Hole',
      details: {
        'Mass': `${(blackHole.mass / 1000000).toFixed(1)} million solar masses`,
        'Event Horizon Radius': `${blackHole.eventHorizonRadius} (visual units)`,
        'Schwarzschild Radius': `~${Rs_km >= 1e6 ? `${(Rs_km / 1e6).toFixed(1)} million` : Rs_km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`,
        'Photon Sphere': `~${photonSphere_km >= 1e6 ? `${(photonSphere_km / 1e6).toFixed(1)} million` : photonSphere_km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`,
        'ISCO': `~${isco_km >= 1e6 ? `${(isco_km / 1e6).toFixed(1)} million` : isco_km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`,
        'Hawking Temperature': T_hawking.toExponential(2) + ' K',
        'Accretion Disk Temp': '~10⁷ K (inner) to ~10⁴ K (outer)',
        'Jet Speed': '~0.99c (relativistic)',
        'Position': `(${blackHole.position[0]}, ${blackHole.position[1]}, ${blackHole.position[2]})`,
        'Description': blackHole.description,
      },
      funFacts: blackHole.funFacts,
      physicsNote: '⚠️ Relativistic Object — General Relativity',
    }
  }

  // Check wormholes
  const wormhole = wormholes.find((w) => w.id === id)
  if (wormhole) {
    // Throat circumference from throat radius
    const throatCircumference = 2 * Math.PI * wormhole.throatRadius

    return {
      name: wormhole.name,
      type: 'Einstein-Rosen Bridge',
      details: {
        'Throat Radius': `${wormhole.throatRadius} (visual units)`,
        'Mouth Radius': `${wormhole.mouthRadius} (visual units)`,
        'Throat Circumference': `${throatCircumference.toFixed(2)} (visual units)`,
        'Exotic Matter Density': 'Negative (violates null energy condition)',
        'Traversability': 'Theoretically possible (Morris-Thorne metric)',
        'Frame Dragging': 'Present (rotating wormhole)',
        'Position': `(${wormhole.position[0]}, ${wormhole.position[1]}, ${wormhole.position[2]})`,
        'Description': wormhole.description,
      },
      funFacts: wormhole.funFacts,
      physicsNote: '⚠️ Theoretical Object — Morris-Thorne Metric',
    }
  }

  return null
}
