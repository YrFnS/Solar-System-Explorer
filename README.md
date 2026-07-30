# Solar System Explorer 🪐

An interactive 3D Solar System experience built with **Next.js**, **React Three Fiber (Three.js)**, and **Tailwind CSS**.

## Features 🚀

- **Ephemeris-Driven Solar System:** One authoritative date drives planets, moons, dwarf planets, comets, orbit paths, camera tracking, measurements, and sandbox collisions.
- **Three Experience Modes:** Explore a cinematic learning view, inspect orbital telemetry in Scientific mode, or experiment with spawned objects in Sandbox mode.
- **Mission Control:** Choose an exact date, step day-by-day, jump to time-warp presets, switch modes, and launch guided learning tracks from a responsive control surface.
- **Scientific Layers:** Inspect velocity vectors, inclined orbital planes, perihelion/aphelion markers, Julian dates, orbital elements, and selected-body telemetry.
- **Guided Learning:** Follow focused tours through the inner worlds, giant planets, and small-body frontier with an observation prompt at every stop.
- **Full 3D System:** Explore the Sun, planets, moons, dwarf planets, asteroid belts, Centaurs, scattered-disc objects, interstellar visitors, and human artifacts.
- **Interactive Camera:** Zoom, pan, orbit, focus, and continuously follow celestial bodies using the same position engine that renders them.
- **Information and Comparison Tools:** Review physical facts, compare worlds, measure separation, use the minimap, save bookmarks, and capture screenshots.
- **Adaptive Rendering:** Auto, Eco, Balanced, and Ultra profiles scale pixel density, geometry, textures, and particle populations for the current device.
- **Live Performance Guardrails:** The renderer monitors frame rate, changes detail gracefully, sleeps while paused and idle, and suspends WebGL while the tab is hidden.
- **Reduced Motion:** A persistent accessibility preference slows decorative fields and disables automatic camera motion.

## Simulation Architecture 🛰️

### One clock and one position API

`SimulationController` advances one mutable simulation clock before orbital components render. The scene mirrors that clock to Zustand at a lower frequency for the HTML interface, avoiding a React state update on every frame.

The ephemeris API is shared by:

- planet, moon, dwarf-planet, comet, Centaur, scattered-disc, and interstellar-object rendering
- camera focus and follow mode
- orbit curves, velocity vectors, and telemetry
- the distance ruler
- spawned sandbox objects and collision detection
- mission-control date and time-warp controls

### Scientific model and accuracy

The eight major planets use the low-precision **JPL Solar System Dynamics J2000 Keplerian element set**, including the long-range correction terms for the outer planets:

- [JPL Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- Approximate validity: **3000 BC through 3000 AD**
- Intended for education and visualization, not spacecraft navigation or occultation prediction

Dwarf planets, comets, Centaurs, and scattered-disc objects use deterministic two-body educational orbits based on the local catalogue. Interstellar objects use illustrative hyperbolic paths anchored near their documented perihelion epoch. Visual distances remain compressed so the complete system is explorable on one screen; the scientific HUD reports physical units separately.

For high-precision or observer-specific results, use [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/).

## Performance Architecture ⚡

The explorer preserves visual richness without making every device render the same workload:

- Large asteroid, Kuiper, Centaur, Trojan, scattered-disc, and Oort populations use **static GPU instancing**. Their transforms are generated once, then whole fields rotate instead of rewriting tens of thousands of matrices every frame.
- Planet, moon, atmosphere, helper, and Sun sphere geometry uses **screen-space LOD**. Distant bodies switch to lighter geometry while close-up views retain the original detail.
- Optional belts, effects, and exotic objects are restored over several startup frames instead of initializing the entire universe in one blocking burst.
- Solar-wind motion runs in a shader, avoiding continuous JavaScript buffer mutation.
- Meteor pools update active trails only and stop when phenomena are disabled or the simulation is paused.
- When the simulation is paused and the camera is idle, React Three Fiber switches to **demand rendering**, allowing the GPU to sleep until interaction resumes.
- Local textures are generated into 512 px, 1K, and 2K WebP tiers. Eco, Balanced, and Ultra choose the matching tier automatically.
- Common legacy third-party texture URLs are routed to self-hosted assets, including a local Earth cloud layer.
- The large HTML interface bundle loads after the core scene becomes interactive.
- Quality, motion, and experience-mode preferences persist locally.

Use the render-engine pill near the top-right to select a quality profile or leave it on **Auto**. Mission control is available near the lower-left edge.

## Keyboard Controls ⌨️

| Key | Action |
| --- | --- |
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
| `Escape` | Stop a tour or reset the camera |

## Tech Stack 🛠️

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **3D Rendering:** [React Three Fiber](https://r3f.docs.pmnd.rs/) and [Three.js](https://threejs.org/)
- **Stable GPU Backend:** WebGL 2
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Components:** [shadcn/ui](https://ui.shadcn.com/) / Radix UI
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

The pre-development hook regenerates optimized texture tiers when a source texture is new or changed. Open `http://localhost:3000`.

## Validation and Production Build ✅

Validate the orbital engine independently:

```bash
bun run ephemeris:validate
```

The validation suite checks major and small-body positions across multiple epochs and all three experience modes, verifies plausible J2000 distance ranges, confirms finite orbit paths, and guards against runaway coordinates.

Create the optimized production build:

```bash
bun run build
```

The pre-build hook generates quality-tiered WebP assets automatically. It can also be run directly:

```bash
bun run textures:optimize
```

Run the standalone output:

```bash
bun run start
```

The GitHub Actions `Quality` workflow installs frozen dependencies, validates the ephemeris, and compiles the optimized Next.js application on every PR and agent-branch update.

## Architecture Notes 📝

- The application is client-side and requires no persistent database. Bookmarks, quality, motion, and experience preferences are stored in the browser.
- Simulation state, experience state, and rendering-quality state are separate Zustand stores, while the high-frequency orbital clock remains outside React state.
- The stable production renderer remains WebGL 2. A future WebGPU/TSL migration should remain isolated and benchmarked rather than replacing the renderer without evidence.
- Fictional or speculative features such as traversable wormholes are confined to Sandbox-oriented presentation and are not part of the scientific ephemeris model.

## License 📄

MIT
