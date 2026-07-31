# Changelog

All notable changes to Solar System Explorer are documented here.

The project follows a phase-based development history while the first major production release is prepared.

## Unreleased — Production Candidate

### P5 — Production hardening and release preparation

#### Added

- Codebase import-graph and dependency audit with `bun run audit`.
- Strict local build command that runs TypeScript before the optimized Next.js build.
- React Strict Mode and `noImplicitAny` enforcement.
- True lazy loading for optional interface panels and staged 3D scene groups.
- Live WebGL context-loss monitoring and Eco-mode renderer reconstruction.
- Build-artifact performance budgets for JavaScript chunks and texture tiers.
- Opt-in Three.js diagnostics for draw calls, triangles, programs, textures, geometries, and scene-object counts.
- Desktop and mobile production smoke tests covering WebGL 2, search, navigation, experience modes, screenshot capture, context recovery, responsive layout, and accessible names.
- `ASSET_SOURCES.md` and `THIRD_PARTY_NOTICES.md` for scientific-data and visual-asset provenance.

#### Changed

- Screenshot capture now stores compressed WebP blobs instead of base64 PNG strings.
- The screenshot gallery retains at most 12 session captures and revokes discarded object URLs.
- Optional search, bookmarks, comparison, settings, history, screenshot, background, phenomena, outer-system, artifact, and Sandbox code is loaded only when needed.
- Production builds no longer ignore TypeScript errors.
- The Zustand store owns its complete public action interface directly.
- The dependency tree and Bun lockfile were reduced to packages used by the active application.
- Near-Earth objects use an owned local texture clone with explicit cleanup.
- Meteor pools and velocity arrows comply with React 19 render-purity rules.

#### Removed

- The monolithic legacy interface and pre-ephemeris scene architecture.
- Legacy planet, moon, comet, orbit, spawned-object, and collision renderers superseded by the ephemeris scene.
- Invalid Git LFS pointer files masquerading as ISS, Hubble, Voyager, JWST, and ʻOumuamua GLB binaries.
- Eighteen unused runtime dependencies and one unused development dependency.

### P4 — Modular mission-control interface

- Replaced the runtime monolithic overlay with focused search, inspector, comparison, bookmarks, display settings, navigation, tour, onboarding, history, and screenshot modules.
- Added a keyboard-first celestial-body catalogue and command palette.
- Added responsive desktop inspector and mobile bottom sheet.
- Added reliable renderer-side screenshot capture and gallery.
- Added WebGL startup recovery and procedural fallbacks for unavailable historical models.
- Added strict TypeScript, ephemeris, production-build, and WebGL browser validation.

### P3 — Unified clock, ephemeris, and experience modes

- Added one authoritative simulation clock shared by rendering, camera tracking, orbit curves, measurements, telemetry, and Sandbox collisions.
- Added approximate JPL J2000 major-planet elements and deterministic educational small-body paths.
- Added Explore, Scientific, and Sandbox experiences.
- Added scientific orbit planes, velocity vectors, perihelion/aphelion markers, telemetry, date controls, and guided learning tracks.

### P2 — Progressive detail and local assets

- Added screen-space sphere LOD.
- Added progressive scene startup and demand rendering while paused.
- Added 512 px, 1K, and 2K local WebP texture tiers.
- Added label billboarding and distance/viewport culling.
- Removed common third-party runtime texture requests.

### P1 — Remove the largest frame costs

- Added Auto, Eco, Balanced, and Ultra render profiles.
- Replaced tens of thousands of per-frame instance-matrix rewrites with static GPU instancing and group-level motion.
- Moved solar-wind animation to a shader.
- Made meteor and near-Earth-object density quality aware.
- Suspended rendering while the browser tab is hidden.
