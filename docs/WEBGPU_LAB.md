# WebGPU / TSL Laboratory

The laboratory at `/lab/webgpu` evaluates Three.js's universal `WebGPURenderer` without changing the production explorer at `/`.

Production remains on the established `WebGLRenderer` / WebGL 2 architecture. The lab is an evidence-gathering route, not a renderer migration flag.

## Why the route is isolated

Three.js documents several important boundaries:

- `WebGPURenderer` initializes asynchronously.
- It attempts WebGPU first and can use a WebGL 2 backend when WebGPU is unavailable.
- `forceWebGL: true` deliberately selects the renderer's WebGL 2 backend for parity tests.
- legacy `ShaderMaterial`, `RawShaderMaterial`, and `onBeforeCompile()` customizations are not supported and must move to Node Materials and TSL.
- renderer maturity and performance remain scene-dependent, so WebGPU must be measured rather than assumed to be faster.

The production scene still contains several mature GLSL visual systems. Moving the whole application in one renderer swap would hide missing effects, mix unrelated regressions, and make performance results impossible to interpret.

## Current milestone status

| Milestone | Scope | Status |
| --- | --- | --- |
| W1 | Renderer, backend selection, ephemeris scene, TSL material foundation | Complete |
| W2 | KTX2 surfaces, atmospheres, Earth clouds, and rings | Complete |
| W3 | Deterministic TSL stars and solar wind | Complete |
| W4 | TSL Sun corona, outer glow, and restrained flare arcs | Complete |
| W5a | Restrained TSL nebula/background haze | Complete |
| W5b | Black-hole and wormhole presentation | Not started |
| W5c | Backend-neutral post-processing experiments | Not started |

## Backend modes

### Auto WebGPU

```text
/lab/webgpu
```

Auto mode performs an explicit adapter and device preflight. It distinguishes:

1. `navigator.gpu` is unavailable — use the WebGL 2 backend.
2. `navigator.gpu` exists but no usable adapter is returned — use the WebGL 2 backend and show the fallback reason.
3. a usable adapter and device are available — initialize `WebGPUBackend`.
4. adapter preflight succeeds but renderer initialization fails — retry safely with the WebGL 2 backend and expose the failure reason.

The UI reports the backend selected after `renderer.init()`; `navigator.gpu` alone is never treated as proof that WebGPU is active.

### Forced WebGL 2

```text
/lab/webgpu?backend=webgl
```

Creates the same `WebGPURenderer` with `forceWebGL: true`. The scene keeps the same:

- geometry
- KTX2 maps
- TSL graphs
- camera
- date and animation rate
- DPR bounds
- object counts
- controls

This is the main parity baseline for comparing the renderer's WebGPU and WebGL 2 backends.

## W1 — renderer and TSL foundation

W1 established:

- asynchronous React Three Fiber renderer initialization
- real backend inspection through `isWebGPUBackend` and `isWebGLBackend`
- ephemeris-driven Sun and eight planets
- shared production orbit calculations
- backend-neutral Node Materials instead of legacy `ShaderMaterial`
- one shared camera and control configuration
- live initialization, FPS, average-frame, P95-frame, longest-frame, sample-count, draw-call, and triangle diagnostics
- backend switching with complete Canvas remounts

## W2 — KTX2 surfaces and simple atmospheres

The laboratory uses a fixed 1K parity tier so backend comparisons do not accidentally measure different texture resolutions.

The active set contains 11 unique maps:

- Sun
- Mercury
- Venus
- Earth
- Earth clouds
- Mars
- Jupiter
- Saturn
- shared Saturn/Uranus ring map
- Uranus
- Neptune

The maps load through `KTX2Loader.detectSupport(WebGPURenderer)`. Procedural TSL colours remain visible while a map is loading and after any texture failure.

W2 also added:

- TSL texture sampling for planetary surfaces
- Fresnel-style TSL atmospheres
- a TSL Earth cloud layer
- radial UV reconstruction for the shared ring texture
- a TSL ring material
- post-load frame sampling that begins only after the full KTX2 set is ready

## W3 — deterministic TSL particles

W3 replaced the laboratory's CPU-created point field with two deterministic instanced Node Material systems:

- 1,600 stars
- 320 solar-wind particles

TSL evaluates:

- star position, colour, size, opacity, and twinkle
- solar-wind radial travel, spiral drift, colour transition, size, and fade

JavaScript does not rewrite particle positions every frame. The runtime contract is published as:

```js
window.__SOLAR_WEBGPU_LAB_EFFECTS__
```

It records the visual-system IDs, object counts, animation mode, and the zero-CPU-position-update guarantee.

## W4 — TSL Sun presentation

W4 adds three backend-neutral Sun systems:

1. **Corona** — a BackSide additive sphere using view-dependent rim intensity, an animated latitude wave, and a restrained pulse.
2. **Outer glow** — a larger additive rim layer with a slower pulse and lower opacity.
3. **Flare layer** — five fixed torus arcs whose colour and opacity sweep through TSL material graphs.

All animation occurs in Node Material graphs. JavaScript creates and disposes the geometry and materials but does not rewrite Sun vertices every frame.

The runtime contract is published as:

```js
window.__SOLAR_WEBGPU_LAB_SUN__
```

It records:

- `tsl-sun-corona`
- `tsl-sun-glow`
- `tsl-sun-flares`
- five flare arcs
- `material-tsl` animation
- `cpuVertexUpdates: false`

## W5a — restrained TSL nebula haze

W5a adds two deterministic BackSide haze shells around the existing W1–W4 scene:

- `tsl-nebula-inner`
- `tsl-nebula-outer`

The shells deliberately remain simple and restrained:

- two low-opacity sphere geometries rather than a volumetric raymarch
- additive Node Materials with depth writes disabled
- fixed radii, rotations, phases, colours, and animation rates
- position-derived wave fields evaluated from `positionLocal`
- slow material-time animation evaluated from the TSL `time` node
- no JavaScript vertex updates
- no post-processing dependency

The runtime contract is published only while the scene component is mounted:

```js
window.__SOLAR_WEBGPU_LAB_NEBULA__
```

It records:

- both exact visual-system IDs
- `shellCount: 2`
- `animationMode: 'material-tsl'`
- `cpuVertexUpdates: false`
- `postProcessing: false`

Publishing the object from the component lifecycle means the smoke test proves the haze scene mounted; importing the module alone is not enough to satisfy the gate.

The route displays a compact W5a status surface with the active Sun, flare, and haze counts. The main renderer-control component remains focused on backend, texture, particle, and frame diagnostics.

## Runtime diagnostics

The laboratory publishes five diagnostic objects:

```js
window.__SOLAR_WEBGPU_LAB__
window.__SOLAR_WEBGPU_LAB_TEXTURES__
window.__SOLAR_WEBGPU_LAB_EFFECTS__
window.__SOLAR_WEBGPU_LAB_SUN__
window.__SOLAR_WEBGPU_LAB_NEBULA__
```

Together they expose:

- requested backend
- actual backend and backend class
- WebGPU API availability
- adapter status and fallback reason
- renderer initialization time
- rolling frame metrics
- requested, loaded, failed, and transcoded KTX2 maps
- active GPU particle systems and counts
- active Sun systems and flare count
- active nebula systems and shell count
- CPU-update and post-processing contracts

## Strict browser gate

The WebGPU laboratory smoke test validates the production standalone build rather than a development server.

Before reporting success, it verifies:

- forced WebGL 2 initializes and remains interactive
- Auto selects the backend supported by the real adapter probe
- Auto → forced WebGL 2 → Auto survives renderer remounts
- all 11 expected KTX2 IDs are requested and loaded
- no KTX2 failures and at least one compressed transcode format
- both W3 particle-system IDs are present
- exactly 1,600 stars and 320 solar-wind particles are active
- particle animation is `vertex-tsl` with no CPU position updates
- all three W4 Sun-system IDs are present
- exactly five flare arcs are active
- Sun animation is `material-tsl` with no CPU vertex updates
- both W5a nebula-system IDs are present
- exactly two haze shells are active
- nebula animation is `material-tsl` with no CPU vertex updates
- W5a does not depend on post-processing
- the visible W5a status surface is present
- at least 30 frame samples are collected after KTX2 readiness
- no uncaught browser errors or invalid canvas layout

The complete repository gate also retains lint, strict TypeScript, ephemeris validation, all 39 production KTX2 assets, the optimized Next.js build, artifact budgets, and production desktop/mobile/recovery tests.

Hosted software-renderer frame rates are validation measurements, not physical-device performance claims.

## Hosted-runner WebGPU limitation

GitHub-hosted Chromium currently exposes `navigator.gpu` but returns no usable core or compatibility Dawn adapter in this workflow. The mandatory hosted gate therefore proves:

- correct adapter detection
- safe Auto fallback
- complete TSL/KTX2 parity on `WebGPURenderer`'s WebGL 2 backend
- stable backend remounts

A real device or self-hosted runner can require a genuine WebGPU result with:

```bash
WEBGPU_REQUIRE_REAL=1 bun run webgpu:smoke
```

When that flag is set, a fallback result fails the test instead of being accepted.

## Comparison rules

A valid backend comparison keeps these constant:

- Three.js and React Three Fiber versions
- viewport and DPR
- camera position
- date and time rate
- object count
- geometry detail
- TSL material graph
- lighting
- KTX2 tier and transcode workload
- browser and device

The software-renderer FPS printed in CI should not be compared with a physical GPU. Real-device decisions should use average frame time, P95 frame time, initialization cost, visual parity, and stability on the same device.

## Promotion boundary

Production must remain on WebGL 2 until the laboratory demonstrates:

1. visual parity for every migrated system
2. no silent WebGL fallback during claimed WebGPU tests
3. acceptable initialization and shader-compilation behaviour
4. stable camera, selection, KTX2, screenshots, and recovery
5. a measurable improvement or another concrete operational benefit on target devices
6. reliable WebGL 2 fallback
7. no significant regression on integrated graphics or mobile hardware

## Next migration order

W5 remains incremental rather than becoming one large effects rewrite:

```text
W5a  restrained TSL nebula/background haze        complete
W5b  black-hole and wormhole presentation         next
W5c  backend-neutral post-processing experiments  deferred
```

W5b must retain the complete W1–W5a workload, add effect-specific diagnostics, and repeat forced-WebGL, Auto-fallback, real-adapter, remount, KTX2, and post-load frame gates. Post-processing remains deferred until gravitational-object presentation passes without it.

## Official references

- Three.js WebGPURenderer manual: https://threejs.org/manual/en/webgpurenderer
- Three.js WebGPURenderer API: https://threejs.org/docs/pages/WebGPURenderer.html
- Three.js TSL specification: https://threejs.org/docs/TSL.html
- React Three Fiber Canvas WebGPU example: https://r3f.docs.pmnd.rs/api/canvas
