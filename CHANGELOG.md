# Changelog

All notable changes to Solar System Explorer are documented here.

## Unreleased — Full KTX2/Basis Texture Catalogue

### Added

- Manifest-driven KTX2 catalogue for all 13 active authored texture maps: Sun, eight planets, Moon, Pluto, Earth clouds, and the shared Saturn/Uranus ring map.
- Three quality tiers per texture for 39 committed KTX2 binaries.
- Pinned Khronos KTX Software 4.4.2 workflow that encodes, validates, and commits real `.ktx2` payloads.
- Shared Three.js `KTX2Loader` runtime with renderer capability detection, per-tier caching, and matching Basis WebAssembly packaging.
- Runtime diagnostics for requested, loaded, and failed IDs; active transcode formats; backend; and fallback errors.
- Accessible GPU-compressed texture control plus `?textures=ktx2` and `?textures=webp` comparison modes.
- Manifest-derived KTX2 file-count and artifact budgets.
- Browser validation that requires all 13 active IDs to transcode successfully.

### Changed

- Every active authored surface map now renders its quality-tiered WebP immediately and upgrades asynchronously to KTX2 when supported.
- Pluto, the Sun, and near-Earth rocky objects now use the adaptive texture path in addition to the major planets, Moon, clouds, and rings.
- BasisLZ/ETC1S is used for colour maps; UASTC with Zstandard is used for alpha-sensitive clouds and ring strips.
- Shared WebP GPU allocations are reference-coordinated and released only after every consumer has switched to KTX2.
- Disabling KTX2 re-uploads the cached WebP image without another network request.
- The rendering panel reports compressed coverage as loaded/requested counts.
- The WebP optimizer accepts the project-authored SVG cloud source and preserves a local fallback at every quality tier.

### Fixed

- Eliminated an early double-residency implementation that increased renderer texture count from the 15-texture baseline to 28.
- The final full-catalogue implementation returns texture residency to 15 while keeping all 13 KTX2 maps active.
- Shared Moon/near-Earth and Saturn/Uranus sources can no longer be disposed while another material still needs their fallback.
- KTX2 generation now handles the pinned CLI's UASTC alias, deterministic RDO settings, source-limited dimensions, and 4 × 4 block-aligned ring strips.
- Generation workflow writes are serialized and rebased rather than force-pushed.

### Validated measurements

- 512 px KTX2 catalogue: 349.2 kB across 13 files.
- 1K KTX2 catalogue: 1.03 MB across 13 files.
- 2K KTX2 catalogue: 3.32 MB across 13 files.
- 39/39 files pass signature validation; generation additionally runs `ktx validate --gltf-basisu`.
- Real WebGL 2 test loads all 13 IDs with zero failures using `RGB_ETC2` and `RGBA_ASTC_4x4` targets.
- Desktop, explicit WebP fallback, mobile, accessibility, screenshot, orientation, and context-recovery tests pass.

### Safety and compatibility

- WebGL 2 remains the stable production renderer.
- WebP remains the permanent fallback for missing assets, unsupported formats, WASM failures, network errors, and transcode errors.
- KTX2 files are committed as regular binary payloads rather than Git LFS pointers.
- WebGPU/TSL remains a separate follow-up laboratory.

## Production Candidate — P1 through P5

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

- Screenshot capture stores compressed WebP blobs instead of base64 PNG strings.
- The screenshot gallery retains at most 12 session captures and revokes discarded object URLs.
- Optional search, bookmarks, comparison, settings, history, screenshot, background, phenomena, outer-system, artifact, and Sandbox code loads only when needed.
- Production builds no longer ignore TypeScript errors.
- The Zustand store owns its complete public action interface directly.
- The dependency tree and Bun lockfile were reduced to packages used by the active application.
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
