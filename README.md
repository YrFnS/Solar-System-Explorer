# Solar System Explorer 🪐

An interactive 3D Solar System experience built with **Next.js**, **React Three Fiber / Three.js**, and **Tailwind CSS**.

## Highlights

- **Ephemeris-driven simulation:** one authoritative date drives planets, moons, dwarf planets, comets, orbit paths, camera tracking, measurements, and Sandbox collisions.
- **Three experiences:** Explore, Scientific, and Sandbox modes separate cinematic learning, orbital inspection, and fictional experiments.
- **Mission control:** exact date selection, day stepping, time-warp presets, guided learning tracks, camera controls, and keyboard navigation.
- **Scientific layers:** inclined orbital planes, velocity vectors, perihelion/aphelion markers, Julian date, and live orbital telemetry.
- **Modular interface:** catalogue search, responsive inspector, comparison, bookmarks, display settings, history, tours, and screenshot tools.
- **Adaptive rendering:** Auto, Eco, Balanced, and Ultra profiles scale DPR, geometry, textures, and particle populations for the current device.
- **Full KTX2/Basis catalogue:** every active authored surface map can use GPU-compressed KTX2 while WebP remains an immediate and permanent fallback.
- **Production resilience:** strict builds, artifact budgets, WebGL context recovery, mobile/browser smoke tests, and accessibility checks.

## Simulation architecture

### One clock and one position API

`SimulationController` advances a mutable simulation clock before orbital components render. Zustand receives lower-frequency date updates for the HTML interface, avoiding a React rerender on every frame.

The shared ephemeris API powers:

- major planets, moons, dwarf planets, comets, Centaurs, scattered-disc objects, and interstellar visitors
- camera focus and follow mode
- orbit curves, velocity vectors, and telemetry
- the distance ruler
- spawned Sandbox objects and collision detection
- mission-control date and time-warp controls

### Scientific accuracy boundary

The eight major planets use the low-precision **NASA/JPL Solar System Dynamics J2000 Keplerian element set**, including long-range correction terms for the outer planets:

- [JPL approximate positions of the planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- Approximate range used here: **3000 BC through 3000 AD**
- Intended for education and visualization—not spacecraft navigation or occultation prediction

Dwarf planets, comets, Centaurs, scattered-disc objects, and interstellar visitors use deterministic educational approximations. Visual distances are compressed so the complete system remains explorable; the inspector reports physical units separately.

Use [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) for high-precision or observer-specific ephemerides.

## Performance architecture

The scene avoids assigning the same workload to every device:

- Large asteroid, Kuiper, Centaur, Trojan, scattered-disc, and Oort populations use **static GPU instancing** rather than per-frame matrix rewrites.
- Planet, moon, atmosphere, helper, and Sun spheres use **screen-space LOD**.
- Core Sun, planets, stars, and camera load first; backgrounds, phenomena, small bodies, outer fields, artifacts, and Sandbox systems are separate lazy chunks.
- Search, comparison, bookmarks, settings, history, and screenshot surfaces also load only when opened.
- Solar-wind motion runs in a shader.
- Meteor pools update active trails only and stop when disabled or paused.
- Paused, camera-idle scenes use demand rendering so the GPU can sleep.
- Quality, texture backend, reduced motion, and experience mode persist locally.

## KTX2/Basis texture catalogue

### Coverage

The active manifest contains 13 unique authored maps at 512, 1024, and 2048 pixel tiers—39 committed KTX2 files:

```text
Sun
Mercury · Venus · Earth · Mars
Jupiter · Saturn · Uranus · Neptune
Moon · Pluto
Earth clouds
Shared Saturn/Uranus ring map
```

Colour maps use BasisLZ/ETC1S. Earth clouds and the radial ring strip use UASTC with Zstandard supercompression.

### Safe runtime replacement

Each material receives its quality-tiered WebP immediately. A shared Three.js `KTX2Loader` then:

1. detects the active WebGL renderer's supported transcode targets
2. loads the matching KTX2 tier
3. replaces the material only after successful transcoding
4. releases the WebP GPU allocation after every consumer of that shared source has switched

The decoded WebP image remains cached, allowing immediate restoration if KTX2 is disabled. Missing assets, unsupported formats, WebAssembly failures, network errors, and transcode failures all remain on WebP.

Shared sources are coordinated correctly: the Moon and near-Earth rocks share one map, and Saturn and Uranus share one ring map.

### Measured results

| Tier | KTX2 files | KTX2 total | WebP fallback total |
| --- | ---: | ---: | ---: |
| 512 | 13 | 349.2 kB | 234.3 kB across 17 files |
| 1024 | 13 | 1.03 MB | 1.07 MB across 17 files |
| 2048 | 13 | 3.32 MB | 4.74 MB across 17 files |

KTX2 is not always the smallest download—particularly at 512 px. Its main value is keeping supported maps compressed on the GPU and reducing upload/memory pressure.

A real WebGL 2 browser test loaded all 13 IDs with zero failures using `RGB_ETC2` and `RGBA_ASTC_4x4`. Renderer texture residency remained **15**, equal to the pre-KTX2 baseline. An earlier double-residency implementation reached 28 and is now guarded against in CI.

### Comparison controls

The render-engine panel reports `KTX2`, `MIXED`, or `WEBP`, along with loaded/requested coverage. It also provides a **GPU-compressed textures** switch.

Direct comparison routes:

```text
?textures=ktx2
?textures=webp
```

Runtime diagnostics:

```js
window.__SOLAR_TEXTURE_DIAGNOSTICS__
```

See [the KTX2/Basis guide](docs/KTX2_TEXTURES.md) for generation, validation, fallback, and residency details.

## Interface architecture

`UIOverlayV4` composes focused modules instead of one monolithic overlay:

- explorer header
- command palette and body catalogue
- responsive body inspector
- comparison workspace
- bookmark library
- camera/display/layer controls
- touch-friendly celestial navigator
- tour and first-run surfaces
- space-history timeline
- renderer-side screenshot bridge and gallery

The interface remains semantic HTML above the WebGL canvas. Three.js renders the Solar System; forms, search, scrolling, keyboard focus, and accessibility remain native browser UI.

## Renderer and screenshot resilience

- Screenshot mode explicitly renders the Three.js scene before capture.
- Captures use compressed WebP blobs and remain local to the session.
- The gallery keeps the newest 12 captures and revokes discarded object URLs.
- A renderer boundary handles WebGL startup failures.
- `webglcontextlost` and `webglcontextrestored` are monitored after startup.
- Eco-mode reconstruction remounts the canvas while preserving simulation and interface state.

## Keyboard controls

| Key | Action |
| --- | --- |
| `Ctrl/⌘ K` or `/` | Open catalogue search |
| `B` | Open bookmarks |
| `H` | Open space-history timeline |
| `,` | Open display settings |
| `1` / `2` / `3` | Explore / Scientific / Sandbox |
| `Space` | Pause or resume |
| `+` / `-` | Change time-warp preset |
| `[` / `]` | Step one simulated day |
| Arrow keys | Navigate bodies or active tour |
| `F` | Follow selected body |
| `M` | Switch orbit/fly camera mode |
| `R` | Toggle camera auto-rotation |
| `T` | Start or stop classic tour |
| `S` | Enter or leave screenshot mode |
| `Escape` | Close, stop, or reset current interaction |

## Tech stack

- Next.js 16, React 19, and TypeScript
- React Three Fiber, Drei, and Three.js
- Stable renderer: **WebGL 2**
- Compressed textures: **KTX2/Basis Universal with WebP fallback**
- Tailwind CSS and Radix/shadcn-style components
- Zustand state management
- Sharp asset generation
- Puppeteer browser validation

## Getting started

### Prerequisites

Install [Bun](https://bun.sh/) or a compatible Node.js/npm environment.

```bash
git clone https://github.com/YrFnS/Solar-System-Explorer.git
cd Solar-System-Explorer
bun install
bun run dev
```

Open `http://localhost:3000`.

The development hook regenerates WebP tiers and copies the matching Basis JavaScript/WASM transcoder from the installed Three.js package.

### Regenerating KTX2 assets

Native Khronos KTX Software is needed only when the source catalogue changes:

```bash
bun run textures:ktx2:encode
bun run textures:ktx2:verify
```

Normal builds verify committed KTX2 payloads and do not require the native encoder.

## Validation and production build

Run individual checks:

```bash
bun run audit
bun run lint
bun run typecheck
bun run ephemeris:validate
bun run textures:ktx2:verify
bun run build
bun run performance:budget
bun run ui:smoke
```

Or run the complete local release gate:

```bash
bun run quality:local
```

The release gate covers:

- import reachability and dependency reporting
- ESLint and React 19 purity rules
- strict TypeScript
- orbital positions across epochs and all three modes
- WebP generation, Basis runtime packaging, and all 39 KTX2 payloads
- JavaScript, WebP, KTX2, and live Three.js budgets
- all 13 active KTX2 IDs plus forced WebP fallback
- desktop/mobile layout and orientation
- search, modes, screenshots, renderer recovery, and accessibility

Run the standalone production output:

```bash
bun run start
```

## Documentation

- [Changelog](CHANGELOG.md)
- [KTX2/Basis texture catalogue](docs/KTX2_TEXTURES.md)
- [Asset sources and redistribution notes](ASSET_SOURCES.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

The MIT license covers project-authored code. It does not automatically relicense third-party source textures; WebP and KTX2 derivatives retain their source-asset constraints.

## Architecture notes

- The app is client-side and requires no persistent database.
- Simulation, experience, performance, and texture-runtime state are separate; the high-frequency orbital clock remains outside React state.
- Broken historical Git LFS model pointers were removed; project-authored procedural renderers remain active.
- Committed `.ktx2` files are ordinary Git binaries so static deployments receive real payloads.
- WebGL 2 remains the stable production backend. WebGPU/TSL work belongs in a separate benchmarked laboratory route.
- Fictional systems such as traversable wormholes are confined to Sandbox-oriented presentation.

## License

MIT
