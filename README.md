# Solar System Explorer 🪐

An interactive 3D Solar System experience built with **Next.js**, **React Three Fiber (Three.js)**, and **Tailwind CSS**.

## Features 🚀

- **Ephemeris-Driven Solar System:** One authoritative date drives planets, moons, dwarf planets, comets, orbit paths, camera tracking, measurements, and Sandbox collisions.
- **Three Experience Modes:** Explore a cinematic learning view, inspect orbital telemetry in Scientific mode, or experiment with spawned objects in Sandbox mode.
- **Mission Control:** Choose an exact date, step day-by-day, jump to time-warp presets, switch modes, and launch guided learning tracks from a responsive control surface.
- **Scientific Layers:** Inspect velocity vectors, inclined orbital planes, perihelion/aphelion markers, Julian dates, orbital elements, and selected-body telemetry.
- **Guided Learning:** Follow focused tours through the inner worlds, giant planets, and small-body frontier with an observation prompt at every stop.
- **Full 3D System:** Explore the Sun, planets, moons, dwarf planets, asteroid belts, Centaurs, scattered-disc objects, interstellar visitors, and human artifacts.
- **Interactive Camera:** Zoom, pan, orbit, focus, and continuously follow celestial bodies using the same position engine that renders them.
- **Information and Comparison Tools:** Review physical facts, compare worlds, measure separation, use the responsive navigator, save bookmarks, and capture screenshots.
- **Command Palette:** Search the complete body and mission catalogue with keyboard navigation using `Ctrl/⌘ K` or `/`.
- **Adaptive Rendering:** Auto, Eco, Balanced, and Ultra profiles scale pixel density, geometry, textures, and particle populations for the current device.
- **Adaptive KTX2 Pilot:** Earth, Moon, cloud, and ring textures can upgrade from WebP to GPU-compressed KTX2 with automatic fallback and visible diagnostics.
- **Production Recovery:** WebGL startup and live context-loss failures provide a clear recovery path instead of leaving a black or frozen canvas.
- **Reduced Motion:** A persistent accessibility preference slows decorative fields and disables automatic camera motion.

## Simulation Architecture 🛰️

### One clock and one position API

`SimulationController` advances one mutable simulation clock before orbital components render. The scene mirrors that clock to Zustand at a lower frequency for the HTML interface, avoiding a React state update on every frame.

The ephemeris API is shared by:

- planet, moon, dwarf-planet, comet, Centaur, scattered-disc, and interstellar-object rendering
- camera focus and follow mode
- orbit curves, velocity vectors, and telemetry
- the distance ruler
- spawned Sandbox objects and collision detection
- mission-control date and time-warp controls

### Scientific model and accuracy

The eight major planets use the low-precision **JPL Solar System Dynamics J2000 Keplerian element set**, including the long-range correction terms for the outer planets:

- [JPL Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- Approximate validity: **3000 BC through 3000 AD**
- Intended for education and visualization, not spacecraft navigation or occultation prediction

Dwarf planets, comets, Centaurs, and scattered-disc objects use deterministic two-body educational orbits based on the local catalogue. Interstellar objects use illustrative hyperbolic paths anchored near their documented perihelion epoch. Visual distances remain compressed so the complete system is explorable on one screen; the scientific inspector reports physical units separately.

For high-precision or observer-specific results, use [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/).

## Performance Architecture ⚡

The explorer preserves visual richness without making every device render the same workload:

- Large asteroid, Kuiper, Centaur, Trojan, scattered-disc, and Oort populations use **static GPU instancing**. Their transforms are generated once, then whole fields rotate instead of rewriting tens of thousands of matrices every frame.
- Planet, moon, atmosphere, helper, and Sun sphere geometry uses **screen-space LOD**. Distant bodies switch to lighter geometry while close-up views retain the original detail.
- The core Sun, planets, stars, and camera load first. Backgrounds, phenomena, small bodies, outer fields, artifacts, and Sandbox systems are separate lazy chunks staged during browser idle time.
- Optional search, comparison, bookmarks, settings, history, and screenshot surfaces also load only when opened; catalogue search is prefetched during idle time.
- Solar-wind motion runs in a shader, avoiding continuous JavaScript buffer mutation.
- Meteor pools update active trails only and stop when phenomena are disabled or the simulation is paused.
- When the simulation is paused and the camera is idle, React Three Fiber switches to **demand rendering**, allowing the GPU to sleep until interaction resumes.
- Local textures are generated into 512 px, 1K, and 2K WebP tiers. Eco, Balanced, and Ultra choose the matching tier automatically.
- The KTX2 pilot uses those same quality tiers, loading WebP immediately and upgrading supported textures asynchronously through Three.js `KTX2Loader`.
- Common legacy third-party texture URLs are routed to self-hosted assets, including a local Earth cloud layer.
- Quality, texture-backend, motion, and experience-mode preferences persist locally.

Use the render-engine pill near the top-right to select a quality profile or leave it on **Auto**. The same panel displays the active `KTX2`, `MIXED`, or `WEBP` texture backend and can switch GPU-compressed textures off for direct comparison. Mission control is available near the lower-left edge.

## KTX2/Basis Texture Pilot 🗜️

The optional texture experiment covers four representative assets at 512, 1024, and 2048 pixel tiers:

- Earth albedo — BasisLZ/ETC1S
- Moon albedo — BasisLZ/ETC1S
- Earth cloud alpha layer — UASTC plus Zstandard
- Saturn/Uranus ring alpha strip — UASTC plus Zstandard

A material always receives its quality-tiered WebP first. The shared loader then detects the current WebGL 2 renderer's supported transcode target and replaces the pilot map only after a successful KTX2 load. Missing files, unsupported capabilities, Basis WebAssembly failures, network failures, and transcode failures all keep WebP active.

Compare the two paths with the in-app rendering panel or URL overrides:

```text
?textures=ktx2
?textures=webp
```

Detailed architecture, generation, and validation notes are available in [the KTX2 texture guide](docs/KTX2_TEXTURES.md).

## Interface Architecture 🧭

The active interface is composed by `UIOverlayV4`; the previous multi-thousand-line interface and pre-ephemeris scene were removed after an import-graph audit.

The interface is separated into focused modules:

- **Explorer header:** current mode, selected destination, ephemeris time, search, history, bookmarks, display controls, and screenshot entry.
- **Body catalogue and command palette:** one deduplicated index for planets, moons, missions, small bodies, exotic Sandbox objects, and spawned objects.
- **Live body inspector:** physical facts, current ephemeris distance and speed, Scientific-mode orbital telemetry, focus, bookmarks, measurement, and comparison actions.
- **Comparison workspace:** side-by-side facts, shared metrics, relative diameter, body swapping, and camera focus.
- **Display settings:** camera presets, orbit/label aids, belts, outer-system layers, motion, and phenomena controls.
- **Responsive navigator:** fast Sun/planet/Pluto navigation on desktop and touch devices.
- **Bookmark library and history timeline:** browser-local destinations and mission-history navigation.
- **Renderer screenshot bridge:** performs an explicit WebGL render and captures a compressed WebP immediately.
- **First-run guide and tour surface:** lightweight onboarding without blocking the 3D scene bundle.

The interface remains semantic HTML above the canvas. Three.js renders the Solar System, while forms, search, scrolling, keyboard focus, and accessibility remain native browser UI.

## Screenshot and Renderer Resilience 📸

- Screenshot mode explicitly renders the Three.js scene before capture.
- Captures use compressed WebP blobs rather than base64 PNG strings.
- The session gallery retains the newest 12 captures and revokes discarded object URLs.
- Captures remain local to the browser and are never uploaded by the application.
- A renderer boundary handles WebGL startup failures.
- `webglcontextlost` and `webglcontextrestored` are monitored after startup.
- Rebuilding in Eco mode remounts the canvas while preserving simulation and interface state.

## Keyboard Controls ⌨️

| Key | Action |
| --- | --- |
| `Ctrl/⌘ K` or `/` | Open catalogue search |
| `B` | Open bookmarks |
| `H` | Open space-history timeline |
| `,` | Open display settings |
| `1` / `2` / `3` | Explore / Scientific / Sandbox mode |
| `Space` | Pause or resume while remembering the previous warp speed |
| `+` / `-` | Move through time-warp presets |
| `[` / `]` | Step backward or forward one simulated day |
| Arrow keys | Previous or next body; move through an active tour |
| `F` | Follow the selected body |
| `M` | Switch orbit/fly camera mode |
| `R` | Toggle camera auto-rotation |
| `T` | Start or stop the classic guided tour |
| `S` | Enter or leave screenshot mode |
| `Escape` | Close a surface, stop a tour, or reset the camera |

## Tech Stack 🛠️

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **3D Rendering:** [React Three Fiber](https://r3f.docs.pmnd.rs/) and [Three.js](https://threejs.org/)
- **Stable GPU Backend:** WebGL 2
- **Compressed Textures:** KTX2/Basis pilot with WebP fallback
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Components:** shadcn/ui / Radix UI
- **State Management:** Zustand
- **Icons:** Lucide React

## Getting Started 🏁

### Prerequisites

Install [Bun](https://bun.sh/) (recommended) or Node.js/npm.

### Installation

```bash
git clone https://github.com/YrFnS/Solar-System-Explorer.git
cd Solar-System-Explorer
bun install
```

### Development

```bash
bun run dev
```

The pre-development hook regenerates WebP texture tiers and copies the matching Basis JavaScript/WASM transcoder from the installed Three.js package. Open `http://localhost:3000`.

The native Khronos encoder is needed only when changing committed KTX2 assets:

```bash
bun run textures:ktx2:encode
bun run textures:ktx2:verify
```

## Validation and Production Build ✅

The production build is strict: Next.js no longer ignores TypeScript failures, React Strict Mode is enabled, and `noImplicitAny` is enforced.

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

The checks cover:

- import reachability and dependency reporting
- ESLint and React 19 purity rules
- strict TypeScript compilation
- orbital positions and paths across multiple epochs and all three experience modes
- automatic WebP generation, Basis runtime packaging, KTX2 verification, and optimized Next.js compilation
- JavaScript, WebP-tier, and KTX2-tier budgets
- live Three.js draw-call, triangle, program, texture, geometry, and scene-object budgets
- desktop WebGL 2, KTX2 transcode, WebP fallback, search, navigation, modes, screenshot capture, and renderer recovery
- mobile touch navigation, inspector layout, mission-control scrolling, orientation changes, and accessible names

Run the standalone output:

```bash
bun run start
```

## Release and Asset Documentation 📚

- [Changelog](CHANGELOG.md)
- [KTX2/Basis texture pilot](docs/KTX2_TEXTURES.md)
- [Asset sources and redistribution notes](ASSET_SOURCES.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

The project MIT license applies to project-authored code. It does not automatically relicense third-party source textures; verify every source asset before commercial redistribution.

## Architecture Notes 📝

- The application is client-side and requires no persistent database. Bookmarks, quality, texture backend, motion, onboarding, and experience preferences are stored in the browser.
- Simulation state, experience state, rendering-quality state, and texture-runtime diagnostics are separate Zustand stores, while the high-frequency orbital clock remains outside React state.
- Broken Git LFS pointer files previously stored under model paths were removed; lightweight project-authored procedural renderers remain active.
- Committed `.ktx2` assets are ordinary binary Git payloads rather than LFS pointers so static deployments receive real files.
- The stable production renderer remains WebGL 2. A future WebGPU/TSL migration should remain isolated and benchmarked rather than replacing the renderer without evidence.
- Fictional or speculative features such as traversable wormholes are confined to Sandbox-oriented presentation and are not part of the scientific ephemeris model.

## License 📄

MIT
