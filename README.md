# Solar System Explorer 🪐

An interactive, 3D web-based visualization of our Solar System built with **Next.js**, **React Three Fiber (Three.js)**, and **Tailwind CSS**.

## Features 🚀

- **Full 3D Solar System:** Explore the Sun, planets, moons, dwarf planets, asteroid belts, and even human artifacts (like the ISS and Voyager probes).
- **Interactive Camera:** Seamlessly zoom, pan, and orbit around any celestial body. Click on a planet to focus the camera directly on it.
- **Time Simulation:** Control the speed of time to watch orbits in action, from real-time to drastically sped-up orbital mechanics.
- **Information Panel:** Discover detailed facts, real-world diameter, distance from the Sun, and atmospheric composition for every object in the system.
- **Minimap Navigation:** Quickly locate and jump to distant planets and dwarf planets using the interactive 2D minimap.
- **Bookmarks:** Save your favorite camera angles and focused bodies to easily return to them later (saved locally in your browser).
- **Space Events:** A dynamic timeline highlighting major historical space exploration events as they align with your current simulated time.
- **Adaptive Rendering:** Auto, Eco, Balanced, and Ultra quality profiles scale pixel density, geometry, textures, and particle populations for the current device.
- **Live Performance Guardrails:** The renderer monitors frame rate, gracefully changes quality when needed, and suspends WebGL while the tab is hidden.
- **Reduced Motion:** A persistent accessibility setting slows decorative fields and disables automatic camera motion.

## Performance Architecture ⚡

The explorer is designed to preserve visual richness without making every device render the same workload:

- Large asteroid, Kuiper, Centaur, Trojan, scattered-disc, and Oort populations use **static GPU instancing**. Their transforms are generated once, then entire fields rotate as groups instead of rewriting tens of thousands of matrices every frame.
- Planet, moon, atmosphere, helper, and Sun sphere geometry uses **screen-space LOD**. Distant bodies automatically switch to lighter geometry while close-up views retain the original detail.
- Optional belts, effects, and exotic objects are restored over several startup frames instead of initializing the entire universe in one blocking burst.
- Solar wind movement runs in a shader, avoiding continuous JavaScript buffer mutation.
- Meteor pools update only active trails and completely stop when phenomena are disabled or the simulation is paused.
- When the simulation is paused and the camera is idle, React Three Fiber switches to **demand rendering**, allowing the GPU to sleep until interaction resumes.
- Local planet textures are generated into 512 px, 1K, and 2K WebP tiers before development and production builds. Eco, Balanced, and Ultra select the matching tier automatically.
- Legacy third-party texture URLs are routed to self-hosted assets, including a locally generated Earth cloud layer.
- The large interface bundle is loaded after the core scene becomes interactive.
- Quality and reduced-motion preferences are saved locally and restored on the next visit.

Use the render-engine pill near the top-right of the explorer to select a fixed profile or leave it on **Auto**.

## Tech Stack 🛠️

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **3D Rendering:** [React Three Fiber](https://r3f.docs.pmnd.rs/) & [Three.js](https://threejs.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Components:** [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **State Management:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Icons:** [Lucide React](https://lucide.dev/)

## Getting Started 🏁

### Prerequisites

Ensure you have [Bun](https://bun.sh/) (recommended) or `npm` installed on your machine.

### Installation

1. Clone the repository and navigate into the project directory.
2. Install the dependencies:
```bash
bun install
# or
npm install
```

### Running the Development Server

Start the local development server:
```bash
bun run dev
# or
npm run dev
```

The pre-development hook generates the optimized texture tiers when a source texture is new or has changed.

Open [http://localhost:3000](http://localhost:3000) in your browser to start exploring!

## Building for Production 🏗️

To create an optimized production build:
```bash
bun run build
# or
npm run build
```

The pre-build hook creates the quality-tiered WebP assets automatically. It can also be run directly:

```bash
bun run textures:optimize
```

This project is configured to build as a `standalone` Next.js application, which is highly optimized for Docker deployments. To run the standalone server after building:
```bash
bun run start
# or
npm run start
```

## Architecture Notes 📝

- The application is a purely client-side simulation (`'use client'`). No persistent database is required. All user-specific data (like bookmarks, quality, and motion preferences) is stored in local browser storage.
- 3D elements are integrated with the React lifecycle via `@react-three/fiber`, while frequently animated high-volume fields keep their work on the GPU or at group level.
- The Zustand stores separate simulation state from rendering-quality state so performance can adapt without changing the scientific/navigation controls.
- The stable renderer remains WebGL 2. The scene architecture is being prepared for a later, isolated WebGPU/TSL migration rather than forcing an unsafe renderer swap.

## License 📄
MIT
